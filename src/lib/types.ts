export type Profile = {
  id: string;
  username: string;
  is_seller: boolean;
  created_at: string;
};

export type Listing = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  type: "product" | "service";
  category: string | null;
  image_url: string | null;
  starting_price: string | number;
  min_increment: string | number;
  current_price: string | number;
  buy_now_price: string | number | null;
  status: "active" | "closed" | "cancelled";
  ends_at: string;
  created_at: string;
};

export type PaymentProfile = {
  id: string;
  stripe_customer_id: string | null;
  has_payment_method: boolean;
  terms_accepted_at: string | null;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  created_at: string;
};
