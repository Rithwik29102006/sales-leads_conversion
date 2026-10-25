"""
business.py - the business owner's details, products and policies.

The WhatsApp bot uses them to welcome customers with the business name, show the product
list, and answer questions about price, details, availability, delivery and timings.

  GET /business     business profile and policies
  PUT /business     save them
  GET /products     products / services with price and details
  PUT /products     save the whole list (the My Business page sends all rows)
"""

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

import database as db

router = APIRouter()


class Business(BaseModel):
    name: Optional[str] = Field(None, max_length=80)
    business_type: Optional[str] = Field(None, max_length=40)
    owner_name: Optional[str] = Field(None, max_length=60)
    whatsapp_number: Optional[str] = Field(None, pattern=r"^\+?[0-9 ]{10,16}$")
    working_hours: Optional[str] = Field(None, max_length=80)
    delivery_area: Optional[str] = Field(None, max_length=120)
    delivery_charge: Optional[float] = Field(None, ge=0, le=100000)
    advance_notice: Optional[str] = Field(None, max_length=40)
    special_instructions: Optional[str] = Field(None, max_length=500)


class Product(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    price: Optional[float] = Field(None, ge=0, le=100_000_000)
    details: Optional[str] = Field(None, max_length=400)
    available: bool = True


@router.get("/business")
def get_business():
    return db.get_business()


@router.put("/business")
def save_business(details: Business):
    cleaned = {k: (v.strip() or None) if isinstance(v, str) else v for k, v in details.model_dump().items()}
    return db.save_business(cleaned)


@router.get("/products")
def get_products():
    return db.get_products()


@router.put("/products")
def save_products(products: List[Product]):
    return db.replace_products([{**p.model_dump(), "name": p.name.strip(),
                                 "details": (p.details or "").strip() or None} for p in products])
