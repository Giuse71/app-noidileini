import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

Role = Literal["athlete", "merchant", "admin"]
IMG_MAX = 2_000_000  # data-url length cap (~1.5MB image)


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------- association ----------
class Association(BaseModel):
    name: str = "A.S.D. Leinì Volley"
    logo: Optional[str] = Field(default=None, max_length=IMG_MAX)
    address: str = ""
    city: str = ""
    vat_number: str = ""
    fiscal_code: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    description: str = ""
    convention_rules: str = ""


# ---------- categories ----------
class Category(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    order: int = 0


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


# ---------- athletes ----------
class Athlete(BaseModel):
    id: str
    first_name: str
    last_name: str
    category_id: Optional[str] = None
    category_name: str = ""
    photo: Optional[str] = None
    code: str
    email: str = ""
    created_at: datetime


class AthleteUpdate(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    category_id: str
    photo: Optional[str] = Field(default=None, max_length=IMG_MAX)


class AthleteRegister(AthleteUpdate):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


# ---------- merchants ----------
class MerchantUpdate(BaseModel):
    business_name: str = Field(min_length=1, max_length=120)
    legal_name: str = ""
    vat_number: str = Field(min_length=11, max_length=16)
    sector: str = ""
    address: str = ""
    city: str = "Leinì"
    phone: str = ""
    email: str = ""
    website: str = ""
    description: str = ""
    logo: Optional[str] = Field(default=None, max_length=IMG_MAX)
    discount_percent: float = Field(default=10, ge=0, le=100)


class Merchant(MerchantUpdate):
    id: str
    created_at: datetime


class MerchantRegister(MerchantUpdate):
    account_email: EmailStr
    password: str = Field(min_length=6, max_length=128)


# ---------- auth ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    role: Role


class Me(BaseModel):
    user: UserOut
    athlete: Optional[Athlete] = None
    merchant: Optional[Merchant] = None


# ---------- transactions ----------
class TransactionCreate(BaseModel):
    athlete_id: str
    amount: float = Field(gt=0, le=100_000)
    note: str = Field(default="", max_length=200)


class Transaction(BaseModel):
    id: str = Field(default_factory=new_id)
    merchant_id: str
    merchant_name: str
    athlete_id: str
    athlete_name: str
    athlete_code: str
    category_name: str = ""
    amount: float
    discount_percent: float
    discount_amount: float
    final_amount: float
    note: str = ""
    created_at: datetime = Field(default_factory=now_utc)
