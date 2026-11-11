import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from lib.dates import today_iso

Role = Literal["athlete", "merchant", "admin"]
IMG_MAX = 30_000_000  # data-url length sanity cap; real weight limits live in lib/storage (env-configurable)
GALLERY_MAX = 6
DATE_RX = r"^(\d{4}-\d{2}-\d{2})?$"


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
    # editable home page content (Admin → Associazione → Testi della home)
    hero_image: Optional[str] = Field(default=None, max_length=IMG_MAX)
    home_badge: str = "Convenzione Sponsor"
    home_title: str = "App Noi di Leyni"
    home_subtitle: str = ("La tessera digitale del Leinì Volley: atleti e famiglie risparmiano nei negozi partner, "
                          "i commercianti sostengono la squadra e ogni sconto resta tracciato.")
    step1_title: str = "L'atleta mostra la tessera"
    step1_text: str = "Ogni tesserato ha un QR personale nella propria area riservata."
    step2_title: str = "Il commerciante applica lo sconto"
    step2_text: str = "Scansiona il codice, inserisce l'importo: lo sconto della convenzione si calcola da solo."
    step3_title: str = "Tutto resta tracciato"
    step3_text: str = "Ogni transazione è registrata: l'associazione vede i benefici generati dagli sponsor."
    partners_title: str = "I nostri partner"
    partners_subtitle: str = "Attività di Leinì che sostengono la pallavolo locale"


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
    family_count: int = 0
    # set only when a family member's code is looked up at the till
    is_family: bool = False
    family_member_id: Optional[str] = None
    holder_name: str = ""
    relation: str = ""
    notify_new_partners: bool = True


class FamilyMemberIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    relation: str = Field(default="", max_length=40)
    photo: Optional[str] = Field(default=None, max_length=IMG_MAX)


class FamilyMember(FamilyMemberIn):
    id: str
    code: str
    created_at: datetime


class AthleteUpdate(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    category_id: str
    photo: Optional[str] = Field(default=None, max_length=IMG_MAX)
    notify_new_partners: bool = True


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
    # promozione del mese (informativa)
    promo_title: str = Field(default="", max_length=80)
    promo_description: str = Field(default="", max_length=400)
    promo_start: str = Field(default="", pattern=DATE_RX)
    promo_end: str = Field(default="", pattern=DATE_RX)
    gallery: list[Annotated[str, Field(max_length=IMG_MAX)]] = Field(default_factory=list, max_length=GALLERY_MAX)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def _promo_dates(self):
        if self.promo_start and self.promo_end and self.promo_end < self.promo_start:
            raise ValueError("La fine della promozione è precedente all'inizio")
        return self


class Merchant(MerchantUpdate):
    id: str
    created_at: datetime
    published: bool = True
    promo_active: bool = False
    rating_avg: float = 0
    rating_count: int = 0

    @model_validator(mode="after")
    def _compute_promo(self):
        today = today_iso("Europe/Rome")
        self.promo_active = bool(self.promo_title) and (not self.promo_start or self.promo_start <= today) and (
            not self.promo_end or today <= self.promo_end
        )
        return self


class AdminMerchant(Merchant):
    account_email: str = ""
    invited_at: Optional[datetime] = None
    announced_at: Optional[datetime] = None


class AdminMerchantSave(MerchantUpdate):
    account_email: EmailStr
    new_password: Optional[str] = Field(default=None, min_length=6, max_length=128)
    published: bool = True


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


class PasswordTokenInfo(BaseModel):
    email: str
    business_name: str = ""


class SetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=6, max_length=128)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class NewAdminIn(BaseModel):
    email: EmailStr


class AdminUser(BaseModel):
    id: str
    email: str
    created_at: Optional[datetime] = None
    is_me: bool = False


class InviteResult(BaseModel):
    sent_to: str
    invited_at: datetime


class Me(BaseModel):
    user: UserOut
    athlete: Optional[Athlete] = None
    merchant: Optional[Merchant] = None


# ---------- transactions ----------
class TransactionCreate(BaseModel):
    athlete_id: str
    amount: float = Field(gt=0, le=100_000)
    note: str = Field(default="", max_length=200)
    family_member_id: Optional[str] = None


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
    family_member_name: str = ""
    relation: str = ""
    rating: Optional[int] = None
    created_at: datetime = Field(default_factory=now_utc)


class RatingIn(BaseModel):
    stars: int = Field(ge=1, le=5)


class GeocodeOut(BaseModel):
    found: bool
    lat: Optional[float] = None
    lng: Optional[float] = None


# ---------- monthly reports ----------
class MonthlyMerchantRow(BaseModel):
    merchant_id: str
    merchant_name: str
    email: str
    count: int
    amount: float
    discount: float
    final: float
    athletes: int


class MonthlyReport(BaseModel):
    month: str  # YYYY-MM
    label: str
    rows: list[MonthlyMerchantRow]


class ReportLog(BaseModel):
    id: str = Field(default_factory=new_id)
    month: str
    merchant_id: str
    merchant_name: str
    recipients: list[str]
    status: str  # sent | skipped | failed
    detail: str = ""
    created_at: datetime = Field(default_factory=now_utc)


class RankingRow(BaseModel):
    rank: int
    merchant_id: str
    merchant_name: str
    logo: Optional[str] = None
    sector: str = ""
    count: int
    amount: float
    discount: float
    athletes: int


class Ranking(BaseModel):
    start_year: int
    current_start_year: int
    label: str  # e.g. "2026/2027"
    total_discount: float
    rows: list[RankingRow]


class DigestResult(BaseModel):
    promos: int
    sent: int


class SendReportResult(BaseModel):
    month: str
    sent: int
    skipped: int
    failed: int
