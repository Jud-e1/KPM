import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base


class Product(Base):
    __tablename__ = "inventory_products"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    subtitle = Column(String(255), nullable=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(100), default="General", nullable=False, index=True)
    stock = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="In Stock", nullable=False, index=True)
    price = Column(Float, default=0.0, nullable=False)
    low_stock_threshold = Column(Integer, default=15, nullable=False)
    image = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False
    )
