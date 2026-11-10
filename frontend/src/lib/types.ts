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
}

export interface Merchant extends MerchantUpdate {
  id: string;
  created_at: string;
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
  created_at: string;
}
