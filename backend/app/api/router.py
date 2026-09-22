from fastapi import APIRouter
from app.api.endpoints import accounting, health, items, inventory, sales

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(items.router, prefix="/items", tags=["Items"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales"])
api_router.include_router(accounting.router, prefix="/accounting", tags=["Accounting"])
