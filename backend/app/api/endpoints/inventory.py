from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel

from app.core.database import get_db
from app.core.ml_events import emit_ml_event
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.core.types import coerce_uuid, new_uuid
from app.core.cache import cache_delete_prefix, cache_get, cache_set, summary_key
from app.models.inventory import Product
from app.models.partners import SupplierRequestModel
from app.models.purchasing import PurchaseDraftModel
from app.models.user import User
from app.schemas.inventory import (
    ProductBulkCreate,
    ProductBulkCreateResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    StockAdjustRequest,
)

router = APIRouter()


def _invalidate_inv_cache(user: User) -> None:
    try:
        cache_delete_prefix(summary_key("inventory", str(require_business_id(user))))
    except Exception:
        pass


class InventorySummaryResponse(BaseModel):
    revision: str
    total_products: int
    total_stock_value: float


class PurchaseDraftOut(BaseModel):
    id: str
    product_id: str
    sku: str
    product_name: str
    qty: int
    reason: str
    status: str
    proposal_id: Optional[str] = None
    supplier_id: Optional[str] = None
    created_at: Optional[str] = None


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_inventory_endpoint(websocket: WebSocket):
    """
    Legacy inventory WebSocket. Live sync uses authenticated REST polling
    (inventoryStore.connectLive). Reject unauthenticated clients and do not
    relay unscoped client-originated events.
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return
    try:
        from app.core.security import decode_access_token
        from app.core.database import SessionLocal

        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=1008, reason="Invalid token")
            return
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
            if not user:
                await websocket.close(code=1008, reason="User not found")
                return
        finally:
            db.close()
    except HTTPException:
        await websocket.close(code=1008, reason="Invalid token")
        return
    except Exception:
        await websocket.close(code=1011, reason="Auth check failed")
        return

    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive only — do not broadcast client payloads (owner isolation).
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


def derive_status(stock: int, threshold: int, current_status: Optional[str] = None) -> str:
    if stock == 0:
        return "Out of Stock"
    if stock <= threshold:
        return "Low Stock"
    return "In Stock"


def owned_product(db: Session, product_id: str, user: User) -> Product:
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.business_id == user.id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def _draft_out(row: PurchaseDraftModel) -> PurchaseDraftOut:
    return PurchaseDraftOut(
        id=str(row.id),
        product_id=str(row.product_id),
        sku=row.sku,
        product_name=row.product_name,
        qty=row.qty,
        reason=row.reason,
        status=row.status,
        proposal_id=str(row.proposal_id) if row.proposal_id else None,
        supplier_id=str(row.supplier_id) if row.supplier_id else None,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


@router.get("/summary", response_model=InventorySummaryResponse)
def inventory_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bid = str(require_business_id(current_user))
    cached = cache_get(summary_key("inventory", bid))
    if cached:
        return InventorySummaryResponse(**cached)
    q = db.query(Product).filter(Product.business_id == require_business_id(current_user))
    total = q.count()
    updated_at = db.query(func.max(Product.updated_at)).filter(Product.business_id == require_business_id(current_user)).scalar()
    products = db.query(Product.stock, Product.price).filter(Product.business_id == require_business_id(current_user)).all()
    total_value = float(sum((p.stock or 0) * float(p.price or 0) for p in products))
    revision = "empty" if updated_at is None else f"{updated_at.isoformat()}:{total}:{total_value}"
    payload = {"revision": revision, "total_products": total, "total_stock_value": total_value}
    cache_set(summary_key("inventory", bid), payload)
    return InventorySummaryResponse(**payload)


@router.get("/purchase-drafts", response_model=List[PurchaseDraftOut])
def list_purchase_drafts(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(PurchaseDraftModel).filter(PurchaseDraftModel.business_id == require_business_id(current_user))
    if status_filter and status_filter.lower() != "all":
        q = q.filter(PurchaseDraftModel.status == status_filter)
    else:
        q = q.filter(PurchaseDraftModel.status.in_(["suggested", "draft", "accepted"]))
    rows = q.order_by(PurchaseDraftModel.created_at.desc()).limit(100).all()
    return [_draft_out(r) for r in rows]


@router.post("/purchase-drafts/{draft_id}/accept", response_model=PurchaseDraftOut)
def accept_purchase_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = (
        db.query(PurchaseDraftModel)
        .filter(PurchaseDraftModel.id == draft_id, PurchaseDraftModel.business_id == require_business_id(current_user))
        .first()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status == "cancelled":
        raise HTTPException(status_code=400, detail="Draft already cancelled")

    # Create a supplier request / stock note from the draft
    from datetime import datetime

    req = SupplierRequestModel(
        id=new_uuid(),
        business_id=require_business_id(current_user),
        need=f"Reorder {draft.product_name or draft.sku} × {draft.qty}",
        category="Reorder",
        budget=0.0,
        created_at=datetime.utcnow().strftime("%Y-%m-%d"),
        status="Open",
    )
    db.add(req)
    draft.status = "accepted"
    try:
        db.commit()
        db.refresh(draft)
        return _draft_out(draft)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[ProductResponse])
def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(250, ge=1, le=500),
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Product).filter(Product.business_id == require_business_id(current_user))
    if status_filter and status_filter.lower() != "all":
        query = query.filter(Product.status == status_filter)
    if category and category.lower() != "all":
        query = query.filter(Product.category == category)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Product.name.ilike(s)) | (Product.sku.ilike(s)) | (Product.subtitle.ilike(s)) | (Product.category.ilike(s))
        )
    return query.order_by(Product.created_at.desc()).offset(skip).limit(limit).all()


def _build_product(product_in: ProductCreate, owner_id: str, db: Session) -> Product:
    """Create a Product ORM row for this owner. Caller handles commit."""
    prod_id = coerce_uuid(product_in.id)
    existing_id = db.query(Product).filter(Product.id == prod_id).first()
    if existing_id and existing_id.business_id != owner_id:
        prod_id = new_uuid()
    elif existing_id and existing_id.business_id == owner_id:
        raise HTTPException(
            status_code=400,
            detail=f"Product id '{prod_id}' already exists.",
        )

    existing_sku = (
        db.query(Product)
        .filter(Product.business_id == owner_id, Product.sku == product_in.sku)
        .first()
    )
    if existing_sku:
        raise HTTPException(status_code=400, detail=f"Product with SKU '{product_in.sku}' already exists.")

    return Product(
        id=prod_id,
        business_id=owner_id,
        name=product_in.name,
        subtitle=product_in.subtitle,
        sku=product_in.sku,
        category=product_in.category,
        stock=product_in.stock,
        status=derive_status(product_in.stock, product_in.low_stock_threshold, product_in.status),
        price=product_in.price,
        low_stock_threshold=product_in.low_stock_threshold,
        image=product_in.image,
    )


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Omit client id so the DB assigns a fresh id; ignore accidental client ids.
    product_in = product_in.model_copy(update={"id": None})
    product = _build_product(product_in, require_business_id(current_user), db)
    try:
        db.add(product)
        db.commit()
        db.refresh(product)
        _invalidate_inv_cache(current_user)
        await manager.broadcast({"type": "PRODUCT_ADD", "ownerId": require_business_id(current_user), "productId": product.id})
        return product
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk", response_model=ProductBulkCreateResponse, status_code=status.HTTP_201_CREATED)
async def bulk_create_products(
    payload: ProductBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.products:
        return ProductBulkCreateResponse(created=[], count=0)

    # Detect duplicate SKUs inside the same upload before touching the DB.
    seen_skus: set[str] = set()
    for item in payload.products:
        sku = (item.sku or "").strip()
        if not sku:
            raise HTTPException(status_code=400, detail="Each product needs a SKU.")
        if sku in seen_skus:
            raise HTTPException(status_code=400, detail=f"Duplicate SKU in import: '{sku}'.")
        seen_skus.add(sku)

    created: List[Product] = []
    try:
        for item in payload.products:
            clean = item.model_copy(update={"id": None})
            product = _build_product(clean, require_business_id(current_user), db)
            db.add(product)
            created.append(product)
        db.commit()
        for product in created:
            db.refresh(product)
        _invalidate_inv_cache(current_user)
        await manager.broadcast(
            {"type": "PRODUCT_BULK_ADD", "ownerId": require_business_id(current_user), "count": len(created)}
        )
        return ProductBulkCreateResponse(created=created, count=len(created))
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return owned_product(db, product_id, current_user)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    updates: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = owned_product(db, product_id, current_user)
    data = updates.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(product, field, val)
    product.status = derive_status(product.stock, product.low_stock_threshold, updates.status)
    try:
        db.commit()
        db.refresh(product)
        _invalidate_inv_cache(current_user)
        await manager.broadcast({"type": "STOCK_UPDATE", "ownerId": require_business_id(current_user), "productId": product.id})
        return product
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{product_id}/adjust-stock", response_model=ProductResponse)
async def adjust_stock(
    product_id: str,
    req: StockAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = owned_product(db, product_id, current_user)
    prev_stock = product.stock
    product.stock = max(0, product.stock + req.amount) if req.is_delta else max(0, req.amount)
    product.status = derive_status(product.stock, product.low_stock_threshold)
    try:
        emit_ml_event(
            db,
            business_id=require_business_id(current_user),
            event_type="stock.adjusted",
            payload={
                "product_id": product.id,
                "sku": product.sku,
                "prev_stock": prev_stock,
                "stock": product.stock,
                "price": product.price,
                "is_delta": req.is_delta,
                "amount": req.amount,
            },
        )
        db.commit()
        db.refresh(product)
        _invalidate_inv_cache(current_user)
        await manager.broadcast({"type": "STOCK_UPDATE", "ownerId": require_business_id(current_user), "productId": product.id})
        return product
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = owned_product(db, product_id, current_user)
    try:
        db.delete(product)
        db.commit()
        _invalidate_inv_cache(current_user)
        await manager.broadcast({"type": "PRODUCT_DELETE", "ownerId": require_business_id(current_user), "productId": product_id})
        return {"message": f"Product {product_id} deleted successfully", "id": product_id}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
