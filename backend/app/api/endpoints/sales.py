from typing import List, Optional
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.core.ml_events import emit_ml_event
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.core.types import coerce_uuid, new_uuid
from app.models.accounting import AccountingTransactionModel
from app.models.inventory import Product
from app.models.partners import CustomerModel
from app.models.sales import SalesOrderLineModel, SalesOrderModel
from app.models.user import User
from app.schemas.sales import (
    SalesOrderCreate,
    SalesOrderLineOut,
    SalesOrderUpdate,
    SalesOrderResponse,
    SalesSummaryResponse,
)

router = APIRouter()

POSTED_STATUSES = ("posted", "completed", "paid", "fulfilled")


def _is_posted(status_value: str | None) -> bool:
    return bool(status_value and status_value.lower() in POSTED_STATUSES)


def _serialize_order(db: Session, order: SalesOrderModel) -> SalesOrderResponse:
    lines = (
        db.query(SalesOrderLineModel)
        .filter(SalesOrderLineModel.order_id == order.id)
        .order_by(SalesOrderLineModel.created_at.asc())
        .all()
    )
    return SalesOrderResponse(
        id=order.id,
        order_number=order.order_number,
        customer_name=order.customer_name,
        customer_id=order.customer_id,
        items_count=order.items_count,
        total_amount=order.total_amount,
        status=order.status,
        channel=order.channel,
        order_date=order.order_date,
        created_at=order.created_at,
        updated_at=order.updated_at,
        invoice_number=order.order_number,
        posted_at=order.posted_at if _is_posted(order.status) else None,
        lines=[SalesOrderLineOut.model_validate(line) for line in lines],
    )


def _apply_stock_deduction(
    db: Session,
    *,
    owner_id: str,
    lines: list[SalesOrderLineModel],
) -> None:
    for line in lines:
        if not line.product_id:
            continue
        product = (
            db.query(Product)
            .filter(Product.id == line.product_id, Product.business_id == owner_id)
            .first()
        )
        if not product:
            continue
        prev = product.stock
        product.stock = max(0, int(product.stock) - int(line.qty))
        threshold = product.low_stock_threshold or 15
        if product.stock <= 0:
            product.status = "Out of Stock"
        elif product.stock <= threshold:
            product.status = "Low Stock"
        else:
            product.status = "In Stock"
        emit_ml_event(
            db,
            business_id=owner_id,
            event_type="stock.adjusted",
            payload={
                "product_id": product.id,
                "sku": product.sku,
                "prev_stock": prev,
                "stock": product.stock,
                "price": product.price,
                "is_delta": True,
                "amount": -int(line.qty),
            },
        )


def _apply_customer_spend(
    db: Session,
    *,
    owner_id: str,
    customer_id: str | None,
    customer_name: str,
    amount: float,
    order_number: str,
) -> None:
    if amount <= 0:
        return
    customer = None
    if customer_id:
        customer = (
            db.query(CustomerModel)
            .filter(CustomerModel.id == customer_id, CustomerModel.business_id == owner_id)
            .first()
        )
    if not customer and customer_name.strip():
        customer = (
            db.query(CustomerModel)
            .filter(
                CustomerModel.business_id == owner_id,
                CustomerModel.name == customer_name.strip(),
            )
            .first()
        )
    if not customer:
        return
    customer.total_spent = float(customer.total_spent or 0) + float(amount)
    customer.last_order = order_number
    customer.last_order_ts = datetime.utcnow().timestamp() * 1000
    customer.is_new = False
    if customer.total_spent >= 1000:
        customer.high_value = True


def _post_sale_income(
    db: Session,
    *,
    owner_id: str,
    order: SalesOrderModel,
) -> None:
    amount = float(order.total_amount or 0)
    if amount <= 0:
        return
    txn_id = f"txn-sale-{order.id}"
    existing = (
        db.query(AccountingTransactionModel)
        .filter(AccountingTransactionModel.id == txn_id, AccountingTransactionModel.business_id == owner_id)
        .first()
    )
    if existing:
        return
    db.add(
        AccountingTransactionModel(
            id=txn_id,
            business_id=owner_id,
            transaction_date=datetime.utcnow(),
            description=f"Sale {order.order_number}",
            reference=order.order_number,
            counterparty=order.customer_name or "Customer",
            category="Sales Revenue",
            account="Accounts Receivable",
            transaction_type="Income",
            amount=amount,
            status="Cleared",
        )
    )


def _on_order_posted(
    db: Session,
    *,
    owner_id: str,
    order: SalesOrderModel,
    lines: list[SalesOrderLineModel],
) -> None:
    if lines:
        _apply_stock_deduction(db, business_id=owner_id, lines=lines)
    _apply_customer_spend(
        db,
        business_id=owner_id,
        customer_id=order.customer_id,
        customer_name=order.customer_name or "",
        amount=float(order.total_amount or 0),
        order_number=order.order_number,
    )
    _post_sale_income(db, business_id=owner_id, order=order)


def _resolve_lines(
    db: Session,
    *,
    owner_id: str,
    order_id: str,
    order_in: SalesOrderCreate,
) -> tuple[list[SalesOrderLineModel], int, float]:
    raw_lines = order_in.lines or []
    if not raw_lines:
        return [], order_in.items_count, float(order_in.total_amount)

    built: list[SalesOrderLineModel] = []
    total_qty = 0
    total_amount = 0.0
    for raw in raw_lines:
        product = None
        if raw.product_id:
            product = (
                db.query(Product)
                .filter(Product.id == raw.product_id, Product.business_id == owner_id)
                .first()
            )
            if not product:
                raise HTTPException(status_code=400, detail=f"Product '{raw.product_id}' not found")
        sku = (raw.sku or (product.sku if product else "") or "").strip()
        name = (raw.product_name or (product.name if product else "") or sku or "Item").strip()
        unit = float(raw.unit_price if raw.unit_price is not None else (product.price if product else 0.0))
        qty = int(raw.qty)
        line_total = round(unit * qty, 2)
        total_qty += qty
        total_amount += line_total
        built.append(
            SalesOrderLineModel(
                id=new_uuid(),
                order_id=order_id,
                business_id=owner_id,
                product_id=product.id if product else raw.product_id,
                sku=sku,
                product_name=name,
                qty=qty,
                unit_price=unit,
                line_total=line_total,
            )
        )
    return built, max(1, total_qty), round(total_amount, 2)


@router.get("/summary", response_model=SalesSummaryResponse)
def get_sales_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(
            func.count(SalesOrderModel.id),
            func.coalesce(
                func.sum(case((SalesOrderModel.status != "Cancelled", SalesOrderModel.total_amount), else_=0.0)),
                0.0,
            ),
            func.coalesce(
                func.sum(case((SalesOrderModel.status == "Pending", SalesOrderModel.total_amount), else_=0.0)),
                0.0,
            ),
            func.max(SalesOrderModel.updated_at),
        )
        .filter(SalesOrderModel.business_id == require_business_id(current_user))
        .one()
    )
    total_orders, total_revenue, outstanding_invoices, last_updated = row
    revision = (
        "empty"
        if last_updated is None
        else f"{last_updated.isoformat()}:{total_orders}:{total_revenue}:{outstanding_invoices}"
    )
    return SalesSummaryResponse(
        revision=revision,
        total_orders=total_orders or 0,
        total_revenue=float(total_revenue or 0),
        outstanding_invoices=float(outstanding_invoices or 0),
    )


@router.get("/", response_model=List[SalesOrderResponse])
def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = None,
    channel: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(SalesOrderModel).filter(SalesOrderModel.business_id == require_business_id(current_user))
    if status and status.lower() != "all":
        query = query.filter(SalesOrderModel.status == status)
    if channel and channel.lower() != "all":
        query = query.filter(SalesOrderModel.channel == channel)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (SalesOrderModel.order_number.ilike(s)) | (SalesOrderModel.customer_name.ilike(s))
        )
    orders = query.order_by(SalesOrderModel.created_at.desc()).offset(skip).limit(limit).all()
    return [_serialize_order(db, order) for order in orders]


@router.post("/", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order_in: SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order_id = coerce_uuid(order_in.id)
    existing_id = db.query(SalesOrderModel).filter(SalesOrderModel.id == order_id).first()
    if existing_id and existing_id.business_id != require_business_id(current_user):
        order_id = new_uuid()
    elif existing_id and existing_id.business_id == require_business_id(current_user):
        return _serialize_order(db, existing_id)

    existing = (
        db.query(SalesOrderModel)
        .filter(SalesOrderModel.business_id == require_business_id(current_user), SalesOrderModel.order_number == order_in.order_number)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Order '{order_in.order_number}' already exists.")

    try:
        lines, items_count, total_amount = _resolve_lines(
            db, business_id=require_business_id(current_user), order_id=order_id, order_in=order_in
        )
        now = datetime.utcnow()
        posted = _is_posted(order_in.status)
        order = SalesOrderModel(
            id=order_id,
            business_id=require_business_id(current_user),
            order_number=order_in.order_number,
            customer_name=order_in.customer_name,
            customer_id=order_in.customer_id,
            items_count=items_count,
            total_amount=total_amount,
            status=order_in.status,
            channel=order_in.channel,
            posted_at=now if posted else None,
        )
        db.add(order)
        for line in lines:
            db.add(line)
        db.flush()

        if posted:
            _on_order_posted(db, business_id=require_business_id(current_user), order=order, lines=lines)

        emit_ml_event(
            db,
            business_id=require_business_id(current_user),
            event_type="order.created",
            payload={
                "order_id": order.id,
                "order_number": order.order_number,
                "customer_name": order.customer_name,
                "total_amount": order.total_amount,
                "items_count": order.items_count,
                "status": order.status,
                "channel": order.channel,
                "line_skus": [line.sku for line in lines],
            },
        )
        if posted:
            emit_ml_event(
                db,
                business_id=require_business_id(current_user),
                event_type="invoice.posted",
                payload={
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "invoice_number": order.order_number,
                    "total_amount": order.total_amount,
                    "status": order.status,
                },
            )
        db.commit()
        db.refresh(order)
        return _serialize_order(db, order)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{order_id}/status", response_model=SalesOrderResponse)
def update_order_status(
    order_id: str,
    updates: SalesOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = (
        db.query(SalesOrderModel)
        .filter(SalesOrderModel.id == order_id, SalesOrderModel.business_id == require_business_id(current_user))
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    was_posted = _is_posted(order.status)
    if updates.status:
        order.status = updates.status
    if updates.customer_name:
        order.customer_name = updates.customer_name
    if updates.total_amount is not None:
        order.total_amount = updates.total_amount
    try:
        now_posted = _is_posted(order.status)
        if now_posted and not was_posted:
            order.posted_at = datetime.utcnow()
            lines = (
                db.query(SalesOrderLineModel)
                .filter(SalesOrderLineModel.order_id == order.id)
                .all()
            )
            _on_order_posted(db, business_id=require_business_id(current_user), order=order, lines=lines)
            emit_ml_event(
                db,
                business_id=require_business_id(current_user),
                event_type="invoice.posted",
                payload={
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "invoice_number": order.order_number,
                    "total_amount": order.total_amount,
                    "status": order.status,
                },
            )
        db.commit()
        db.refresh(order)
        return _serialize_order(db, order)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{order_id}")
def delete_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = (
        db.query(SalesOrderModel)
        .filter(SalesOrderModel.id == order_id, SalesOrderModel.business_id == require_business_id(current_user))
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        db.query(SalesOrderLineModel).filter(SalesOrderLineModel.order_id == order.id).delete()
        db.delete(order)
        db.commit()
        return {"message": f"Order {order_id} deleted successfully", "id": order_id}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
