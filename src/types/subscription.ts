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
  status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'unpaid';
  plan_type: 'monthly' | 'yearly' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSessionRequest {
  priceId: string;
  userId: string;
  planType: 'monthly' | 'yearly';
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}