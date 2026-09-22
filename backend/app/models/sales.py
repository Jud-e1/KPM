import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base


class SalesOrderModel(Base):
    __tablename__ = "sales_orders"

    id = Column(String(64), primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_name = Column(String(255), nullable=False, index=True)
    customer_id = Column(String(50), nullable=True)
    items_count = Column(Integer, default=1, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), default="Completed", nullable=False, index=True)
    channel = Column(String(100), default="Online Store", nullable=False, index=True)
    order_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False
    )
