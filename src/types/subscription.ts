export interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  stripePriceId: string;
  features: string[];
  popular?: boolean;
}

export interface SubscriptionData {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'unpaid';
  plan_type: 'monthly' | 'yearly' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  promo_code: string | null;
  discount_amount: number | null;
  discount_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSessionRequest {
  priceId: string;
  userId: string;
  planType: 'monthly' | 'yearly';
  promoCode?: string;
  promotionCodeId?: string;
}

export interface PromoCodeValidation {
  valid: boolean;
  promotionCodeId?: string;
  couponId?: string;
  code?: string;
  discount?: {
    type: 'percentage' | 'amount';
    value: number;
    currency?: string;
    duration?: string;
    duration_in_months?: number;
  };
  description?: string;
  name?: string;
  max_redemptions?: number;
  times_redeemed?: number;
  expires_at?: number;
  error?: string;
}

export interface PromoCodeUsage {
  id: string;
  user_id: string;
  subscription_id: string | null;
  promo_code: string;
  stripe_promotion_code_id: string | null;
  stripe_coupon_id: string | null;
  discount_type: 'percentage' | 'amount';
  discount_value: number;
  discount_amount_cents: number | null;
  currency: string;
  applied_at: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}