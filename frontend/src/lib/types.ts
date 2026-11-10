// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type Role = "athlete" | "merchant" | "admin";

export interface Association {
  name: string;
  logo: string | null;
  address: string;
  city: string;
  vat_number: string;
  fiscal_code: string;
  email: string;
  phone: string;
  website: string;
  description: string;
  convention_rules: string;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface AthleteUpdate {
  first_name: string;
  last_name: string;
  category_id: string;
  photo: string | null;
  notify_new_partners: boolean;
}

export interface AthleteRegister extends AthleteUpdate {
  email: string;
  password: string;
}

export interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  category_id: string | null;
  category_name: string;
  photo: string | null;
  code: string;
  email: string;
  created_at: string;
  family_count: number;
  is_family: boolean;
  family_member_id: string | null;
  holder_name: string;
  relation: string;
  notify_new_partners: boolean;
}

export interface FamilyMemberIn {
  first_name: string;
  last_name: string;
  relation: string;
  photo: string | null;
}

export interface FamilyMember extends FamilyMemberIn {
  id: string;
  code: string;
  created_at: string;
}

export interface MerchantUpdate {
  business_name: string;
  legal_name: string;
  vat_number: string;
  sector: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  logo: string | null;
  discount_percent: number;
  promo_title: string;
  promo_description: string;
  promo_start: string;
  promo_end: string;
  gallery: string[];
}

export interface Merchant extends MerchantUpdate {
  id: string;
  created_at: string;
  published: boolean;
  promo_active: boolean;
}

export interface AdminMerchant extends Merchant {
  account_email: string;
  invited_at: string | null;
  announced_at: string | null;
}

export interface PasswordTokenInfo {
  email: string;
  business_name: string;
}

export interface SetPasswordIn {
  token: string;
  password: string;
}

export interface InviteResult {
  sent_to: string;
  invited_at: string;
}

export interface AdminMerchantSave extends MerchantUpdate {
  account_email: string;
  new_password: string | null;
  published: boolean;
}

export interface MonthlyMerchantRow {
  merchant_id: string;
  merchant_name: string;
  email: string;
  count: number;
  amount: number;
  discount: number;
  final: number;
  athletes: number;
}

export interface MonthlyReport {
  month: string;
  label: string;
  rows: MonthlyMerchantRow[];
}

export interface ReportLog {
  id: string;
  month: string;
  merchant_id: string;
  merchant_name: string;
  recipients: string[];
  status: "sent" | "skipped" | "failed";
  detail: string;
  created_at: string;
}

export interface RankingRow {
  rank: number;
  merchant_id: string;
  merchant_name: string;
  logo: string | null;
  sector: string;
  count: number;
  amount: number;
  discount: number;
  athletes: number;
}

export interface Ranking {
  start_year: number;
  current_start_year: number;
  label: string;
  total_discount: number;
  rows: RankingRow[];
}

export interface DigestResult {
  promos: number;
  sent: number;
}

export interface SendReportResult {
  month: string;
  sent: number;
  skipped: number;
  failed: number;
}

export interface MerchantRegister extends MerchantUpdate {
  account_email: string;
  password: string;
}

export interface UserOut {
  id: string;
  email: string;
  role: Role;
}

export interface Me {
  user: UserOut;
  athlete: Athlete | null;
  merchant: Merchant | null;
}

export interface TransactionCreate {
  athlete_id: string;
  amount: number;
  note: string;
  family_member_id: string | null;
}

export interface Transaction {
  id: string;
  merchant_id: string;
  merchant_name: string;
  athlete_id: string;
  athlete_name: string;
  athlete_code: string;
  category_name: string;
  amount: number;
  discount_percent: number;
  discount_amount: number;
  final_amount: number;
  note: string;
  family_member_name: string;
  relation: string;
  created_at: string;
}
