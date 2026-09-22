from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate, ItemResponse

router = APIRouter()


@router.get("/", response_model=List[ItemResponse], summary="List all items")
def read_items(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=100, description="Max number of items to return"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in title or description"),
    db: Session = Depends(get_db),
):
    """Retrieve a paginated list of items with optional filtering and search."""
    try:
        query = db.query(Item)
        if status:
            query = query.filter(Item.status == status)
        if search:
            query = query.filter(
                (Item.title.ilike(f"%{search}%")) | (Item.description.ilike(f"%{search}%"))
            )
        items = query.order_by(Item.created_at.desc()).offset(skip).limit(limit).all()
        return items
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED, summary="Create a new item")
def create_item(item_in: ItemCreate, db: Session = Depends(get_db)):
    """Create a new item in the PostgreSQL database."""
    try:
        item = Item(
            title=item_in.title,
            description=item_in.description,
            category=item_in.category or "General",
            status=item_in.status or "active",
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while creating item: {str(e)}"
        )


@router.get("/{item_id}", response_model=ItemResponse, summary="Get item by ID")
def read_item(item_id: int, db: Session = Depends(get_db)):
    """Get item details by ID."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    return item


@router.put("/{item_id}", response_model=ItemResponse, summary="Update item by ID")
def update_item(item_id: int, item_in: ItemUpdate, db: Session = Depends(get_db)):
    """Update an existing item."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
        
    try:
        db.commit()
        db.refresh(item)
        return item
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while updating item: {str(e)}"
        )


@router.delete("/{item_id}", status_code=status.HTTP_200_OK, summary="Delete item by ID")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    """Delete an item from the database."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    try:
        db.delete(item)
        db.commit()
        return {"message": f"Item {item_id} successfully deleted", "id": item_id}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while deleting item: {str(e)}"
        )
