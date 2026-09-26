from fastapi import APIRouter
from app.api.endpoints import accounting, auth, health, insights, items, inventory, ml, onboarding, partners, sales

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding"])
api_router.include_router(items.router, prefix="/items", tags=["Items"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales"])
api_router.include_router(accounting.router, prefix="/accounting", tags=["Accounting"])
api_router.include_router(partners.router, prefix="/partners", tags=["Partners"])
api_router.include_router(insights.router, prefix="/insights", tags=["Insights"])
api_router.include_router(ml.router, prefix="/ml", tags=["ML"])
