from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.models.inventory import Product
from app.schemas.inventory import ProductCreate, ProductUpdate, ProductResponse, StockAdjustRequest

router = APIRouter()

# WebSocket Connection Manager for Real-Time Sync
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
    """Real-time WebSocket connection for bidirectional stock updates and alerts."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # If client sends stock adjustment or ping, broadcast to other connected clients
            if data.get("type") in ["STOCK_UPDATE", "PRODUCT_ADD", "PRODUCT_DELETE", "ALERT"]:
                await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


def derive_status(stock: int, threshold: int, current_status: Optional[str] = None) -> str:
    if stock == 0:
        return "Out of Stock"
    elif stock <= threshold:
        return "Low Stock"
    return "In Stock"


@router.get("/", response_model=List[ProductResponse], summary="List all inventory products")
def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(250, ge=1, le=500),
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Retrieve products with optional filtering, search, and pagination."""
    query = db.query(Product)
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


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, summary="Create a product")
async def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product in the inventory."""
    prod_id = product_in.id or f"prod-{uuid.uuid4().hex[:8]}"
    existing = db.query(Product).filter(Product.sku == product_in.sku).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with SKU '{product_in.sku}' already exists."
        )

    computed_status = derive_status(product_in.stock, product_in.low_stock_threshold, product_in.status)

    product = Product(
        id=prod_id,
        name=product_in.name,
        subtitle=product_in.subtitle,
        sku=product_in.sku,
        category=product_in.category,
        stock=product_in.stock,
        status=computed_status,
        price=product_in.price,
        low_stock_threshold=product_in.low_stock_threshold,
        image=product_in.image,
    )

    try:
        db.add(product)
        db.commit()
        db.refresh(product)
        await manager.broadcast({
            "type": "PRODUCT_ADD",
            "productId": product.id,
            "sku": product.sku,
            "stock": product.stock,
            "status": product.status,
        })
        return product
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{product_id}", response_model=ProductResponse, summary="Get product by ID")
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse, summary="Update product")
async def update_product(product_id: str, updates: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    data = updates.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(product, field, val)

    # Re-evaluate status based on new stock and threshold
    product.status = derive_status(product.stock, product.low_stock_threshold, updates.status)

    try:
        db.commit()
        db.refresh(product)
        await manager.broadcast({
            "type": "STOCK_UPDATE",
            "productId": product.id,
            "sku": product.sku,
            "stock": product.stock,
            "status": product.status,
            "price": product.price,
        })
        return product
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{product_id}/adjust-stock", response_model=ProductResponse, summary="Quick stock adjustment")
async def adjust_stock(product_id: str, req: StockAdjustRequest, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if req.is_delta:
        product.stock = max(0, product.stock + req.amount)
    else:
        product.stock = max(0, req.amount)

    product.status = derive_status(product.stock, product.low_stock_threshold)

    try:
        db.commit()
        db.refresh(product)
        await manager.broadcast({
            "type": "STOCK_UPDATE",
            "productId": product.id,
            "sku": product.sku,
            "stock": product.stock,
            "status": product.status,
        })
        return product
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{product_id}", summary="Delete product")
async def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    try:
        db.delete(product)
        db.commit()
        await manager.broadcast({
            "type": "PRODUCT_DELETE",
            "productId": product_id,
        })
        return {"message": f"Product {product_id} deleted successfully", "id": product_id}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
