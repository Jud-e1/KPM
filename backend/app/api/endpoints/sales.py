from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.models.sales import SalesOrderModel
from app.schemas.sales import (
    SalesOrderCreate,
    SalesOrderUpdate,
    SalesOrderResponse,
    SalesSummaryResponse,
)

router = APIRouter()


@router.get("/summary", response_model=SalesSummaryResponse, summary="Get sales change token and totals")
def get_sales_summary(db: Session = Depends(get_db)):
    """Return a compact response so connected clients only download orders after a change."""
    row = db.query(
        func.count(SalesOrderModel.id),
        func.coalesce(
            func.sum(
                case(
                    (SalesOrderModel.status != "Cancelled", SalesOrderModel.total_amount),
                    else_=0.0,
                )
            ),
            0.0,
        ),
        func.coalesce(
            func.sum(
                case(
                    (SalesOrderModel.status == "Pending", SalesOrderModel.total_amount),
                    else_=0.0,
                )
            ),
            0.0,
        ),
        func.max(SalesOrderModel.updated_at),
    ).one()

    total_orders, total_revenue, outstanding_invoices, last_updated = row
    revision = "empty" if last_updated is None else f"{last_updated.isoformat()}:{total_orders}:{total_revenue}:{outstanding_invoices}"
    return SalesSummaryResponse(
        revision=revision,
        total_orders=total_orders or 0,
        total_revenue=float(total_revenue or 0),
        outstanding_invoices=float(outstanding_invoices or 0),
    )


@router.get("/", response_model=List[SalesOrderResponse], summary="List sales orders")
def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = None,
    channel: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(SalesOrderModel)
    if status and status.lower() != "all":
        query = query.filter(SalesOrderModel.status == status)
    if channel and channel.lower() != "all":
        query = query.filter(SalesOrderModel.channel == channel)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (SalesOrderModel.order_number.ilike(s)) | (SalesOrderModel.customer_name.ilike(s))
        )
    return query.order_by(SalesOrderModel.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED, summary="Create sales order")
def create_order(order_in: SalesOrderCreate, db: Session = Depends(get_db)):
    order_id = order_in.id or f"order-{uuid.uuid4().hex[:8]}"
    existing = db.query(SalesOrderModel).filter(SalesOrderModel.order_number == order_in.order_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order '{order_in.order_number}' already exists."
        )

    order = SalesOrderModel(
        id=order_id,
        order_number=order_in.order_number,
        customer_name=order_in.customer_name,
        customer_id=order_in.customer_id,
        items_count=order_in.items_count,
        total_amount=order_in.total_amount,
        status=order_in.status,
        channel=order_in.channel,
    )

    try:
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{order_id}/status", response_model=SalesOrderResponse, summary="Update order status")
def update_order_status(order_id: str, updates: SalesOrderUpdate, db: Session = Depends(get_db)):
    order = db.query(SalesOrderModel).filter(SalesOrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if updates.status:
        order.status = updates.status
    if updates.customer_name:
        order.customer_name = updates.customer_name
    if updates.total_amount is not None:
        order.total_amount = updates.total_amount

    try:
        db.commit()
        db.refresh(order)
        return order
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{order_id}", summary="Delete order")
def delete_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(SalesOrderModel).filter(SalesOrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    try:
        db.delete(order)
        db.commit()
        return {"message": f"Order {order_id} deleted successfully", "id": order_id}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
