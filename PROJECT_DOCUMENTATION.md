# AskStan - AI Social Media Growth Platform

## 🚀 Project Overview

AskStan is a comprehensive SaaS platform that provides AI-powered social media growth coaching. Built with React, Supabase, and Stripe, it offers personalized strategies for LinkedIn, X (Twitter), Instagram, Threads, and other platforms to help users build profitable social media businesses.

## 🏗️ System Architecture

### Frontend Stack
- **React 18** with TypeScript for modern UI development
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for responsive, utility-first styling
- **React Router** for client-side navigation
- **Lucide React** for consistent iconography

### Backend Stack
- **Supabase** for authentication, database, and serverless functions
- **PostgreSQL** with Row Level Security (RLS) for data protection
- **Stripe** for subscription management and secure payments
- **Netlify** for frontend deployment and hosting

## 🔄 Complete User Journey

### 1. User Registration & Authentication
```
Landing Page → Sign Up → Profile Creation → Plan Selection → Checkout → Dashboard
```

**Flow Details:**
1. User visits landing page and clicks "Get Started"
2. User creates account with email/password
3. Database trigger automatically creates:
   - User profile in `user_profiles` table
   - Default preferences in `user_preferences` table
   - Welcome conversation in `chat_conversations` table
4. User redirected to plan selection page

### 2. Subscription & Payment Flow

#### **Regular Paid Subscriptions:**
```
Plan Selection → Stripe Checkout → Payment → Webhook → Database Update → Dashboard Access
```

**Detailed Steps:**
1. User selects Monthly ($4.99) or Yearly ($49.99) plan
2. `create-checkout-session` edge function creates Stripe checkout
3. User completes payment on Stripe's secure checkout page
4. Stripe redirects to `/checkout-success?session_id=xxx`
5. `CheckoutSuccess` page calls `process-checkout-session` edge function
6. Edge function retrieves session from Stripe and updates database:
   - Sets `user_subscriptions.status = 'active'`
   - Creates billing record in `billing_history`
   - Marks `user_profiles.onboarding_completed = true`
7. User redirected to dashboard with full access

#### **100% Promo Code Flow (Free Subscriptions):**
```
Plan Selection → Promo Code → Direct Database Update → Dashboard Access
```

**Detailed Steps:**
1. User applies 100% discount promo code
2. `validate-promo-code` edge function validates against Stripe API
3. `create-checkout-session` detects 100% discount
4. **Bypasses Stripe checkout entirely** - creates subscription directly in database
5. User immediately redirected to dashboard with `?free_subscription=true`
6. No payment info required, instant access

## 📊 Database Schema

### Core Tables Structure

#### `user_profiles` - User Management
```sql
- id (uuid, primary key, references auth.users)
- email (text, unique, not null)
- full_name (text, optional)
- avatar_url (text, optional)
- timezone (text, default 'UTC')
- onboarding_completed (boolean, default false)
- last_active_at (timestamptz)
- preferences (jsonb, default '{}')
- created_at, updated_at (timestamptz)
```

#### `user_subscriptions` - Stripe Integration
```sql
- id (uuid, primary key)
- user_id (uuid, unique, references user_profiles)
- stripe_customer_id (text, unique)
- stripe_subscription_id (text, unique)
- stripe_price_id (text)
- status (enum: active, inactive, trialing, past_due, canceled, etc.)
- plan_type (enum: monthly, yearly)
- current_period_start, current_period_end (timestamptz)
- promo_code (text, for tracking)
- discount_percentage (numeric, for 100% discounts)
- created_at, updated_at (timestamptz)
```

#### `billing_history` - Payment Tracking
```sql
- id (uuid, primary key)
- user_id (uuid, references user_profiles)
- subscription_id (uuid, references user_subscriptions)
- stripe_invoice_id (text, unique)
- amount (integer, in cents)
- currency (text, default 'usd')
- status (enum: paid, pending, failed, refunded)
- paid_at (timestamptz)
- created_at (timestamptz)
```

#### `promo_code_usage` - Discount Analytics
```sql
- id (uuid, primary key)
- user_id (uuid, references user_profiles)
- subscription_id (uuid, references user_subscriptions)
- promo_code (text, the actual code used)
- stripe_promotion_code_id (text, Stripe's ID)
- discount_type (text: percentage or amount)
- discount_value (numeric, the discount amount/percentage)
- applied_at (timestamptz)
- metadata (jsonb, additional tracking data)
```

## 🔧 Edge Functions (Serverless API)

### `/functions/create-checkout-session`
**Purpose:** Creates Stripe checkout sessions or handles free subscriptions

**Logic:**
1. Validates user profile exists (creates if missing)
2. Checks if promo code gives 100% discount
3. **If 100% discount:** Creates subscription directly, bypasses Stripe
4. **If regular payment:** Creates Stripe checkout session with promo code applied
5. Returns checkout URL or direct dashboard redirect

### `/functions/process-checkout-session`
**Purpose:** Processes completed Stripe checkout sessions

**Logic:**
1. Retrieves checkout session from Stripe using session ID
2. Validates payment was successful
3. Creates/updates subscription in database with `status = 'active'`
4. Creates billing record
5. Records promo code usage if applicable
6. Marks user onboarding as completed

### `/functions/validate-promo-code`
**Purpose:** Validates promo codes against Stripe API

**Logic:**
1. Looks up promotion code in Stripe
2. Validates it's active and not expired
3. Returns discount details and validity
4. Handles all edge cases (expired, usage limits, etc.)

### `/functions/stripe-webhook`
**Purpose:** Handles Stripe webhook events for subscription lifecycle

**Events Handled:**
- `checkout.session.completed` - Activates subscription
- `invoice.paid` - Confirms payment
- `invoice.payment_failed` - Marks subscription past due
- `customer.subscription.updated` - Updates subscription status
- `customer.subscription.deleted` - Cancels subscription

### `/functions/create-portal-session`
**Purpose:** Creates Stripe customer portal for billing management

**Logic:**
1. Finds user's Stripe customer ID
2. Creates portal session with return URL to dashboard
3. Allows users to update payment methods, cancel subscriptions, etc.

## 🛡️ Security Implementation

### Row Level Security (RLS)
- **All tables have RLS enabled**
- **Users can only access their own data**
- **Service role has full access for webhooks**
- **Anonymous users can create profiles during signup**

### Authentication Flow
- **Email/password authentication** via Supabase Auth
- **No email confirmation required** (disabled for smoother UX)
- **Secure password reset** with email links
- **Session management** with automatic refresh

### API Security
- **CORS headers** properly configured for production domain
- **Service role keys** for database access in edge functions
- **Stripe webhook signature verification** for security
- **User authorization** required for all protected endpoints

## 💳 Stripe Configuration

### Products & Pricing
- **Monthly Pro**: $4.99/month (`price_monthly_default`)
- **Yearly Pro**: $49.99/year (`price_yearly_default`)

### Promo Code System
- **Percentage discounts** (e.g., 20% off)
- **Amount discounts** (e.g., $5 off)
- **100% discounts** (completely free subscriptions)
- **Duration options**: once, repeating, forever
- **Usage limits** and expiration dates supported

### Webhook Configuration
**Required Webhook Events:**
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Webhook Endpoint:** `https://your-supabase-url.supabase.co/functions/v1/stripe-webhook`

## 🔄 Data Flow Diagrams

### Regular Subscription Flow
```
User → Plan Selection → Stripe Checkout → Payment → Webhook → Database Update → Dashboard
```

### 100% Promo Code Flow
```
User → Plan Selection → Promo Code → Direct Database Update → Dashboard (No Stripe Checkout)
```

### Subscription Management Flow
```
Dashboard → Settings → Stripe Portal → Billing Changes → Webhook → Database Update
```

## 🧪 Testing Scenarios

### Test Cases to Verify

1. **New User Signup**
   - ✅ Profile created automatically
   - ✅ Welcome conversation created
   - ✅ Redirected to plan selection

2. **Regular Subscription**
   - ✅ Stripe checkout works
   - ✅ Payment processed
   - ✅ Database updated with active subscription
   - ✅ User gets dashboard access

3. **100% Promo Code**
   - ✅ No payment info required
   - ✅ Subscription created directly
   - ✅ Immediate dashboard access
   - ✅ Promo usage tracked

4. **Subscription Management**
   - ✅ Customer portal accessible
   - ✅ Billing changes reflected in database
   - ✅ Cancellations handled properly

## 🐛 Troubleshooting Guide

### Common Issues & Solutions

#### "User profile not found"
- **Cause:** Profile creation trigger not working
- **Solution:** Check if trigger function exists and has proper permissions
- **Debug:** Look for users in `auth.users` without corresponding `user_profiles`

#### "Checkout session creation failed"
- **Cause:** Missing user profile or invalid Stripe configuration
- **Solution:** Verify Stripe API keys and user profile exists
- **Debug:** Check edge function logs for specific error messages

#### "Subscription not activated after payment"
- **Cause:** Webhook not firing or `process-checkout-session` not called
- **Solution:** Verify webhook endpoint and edge function deployment
- **Debug:** Check Stripe webhook logs and Supabase function logs

#### "100% promo code requires payment"
- **Cause:** Promo code not properly detected as 100% discount
- **Solution:** Verify promo code configuration in Stripe
- **Debug:** Check `validate-promo-code` function response

#### "Database not updating"
- **Cause:** RLS policies blocking updates or function permissions
- **Solution:** Verify service role permissions and RLS policies
- **Debug:** Check database logs and function execution logs

## 📈 Analytics & Business Intelligence

### Revenue Tracking
- **Monthly Recurring Revenue (MRR)** from `billing_history`
- **Customer Lifetime Value (CLV)** calculations
- **Churn rate** from subscription cancellations
- **Promo code effectiveness** from `promo_code_usage`

### User Analytics
- **User engagement** from chat message frequency
- **Feature adoption** from conversation topics
- **Onboarding completion** rates
- **Platform preferences** from user settings

## 🚀 Deployment Configuration

### Environment Variables

#### Frontend (Netlify)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_APP_URL=https://askstan.io
```

#### Supabase Edge Functions
```bash
STRIPE_SECRET_KEY=sk_live_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_APP_URL=https://askstan.io
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Deployment Process
1. **Frontend:** Auto-deploys to Netlify on git push
2. **Edge Functions:** Deploy via GitHub Actions or Supabase CLI
3. **Database:** Migrations auto-applied on deployment
4. **Stripe:** Webhooks configured to point to edge functions

## 🔮 System Health Monitoring

### Key Metrics to Monitor
- **Subscription activation rate** (checkout completion %)
- **Edge function success rate** (error rate < 1%)
- **Database response times** (< 100ms for profile queries)
- **Webhook processing success** (99%+ success rate)

### Alerting Setup
- **Failed payments** → Email notification
- **Edge function errors** → Slack/email alerts
- **High error rates** → Immediate investigation
- **Subscription cancellations** → Business intelligence tracking

---

## 🛠️ Development Setup

1. **Clone Repository**
2. **Install Dependencies**: `npm install`
3. **Setup Environment**: Copy `.env.example` to `.env` and configure
4. **Setup Supabase**: Create project, run migrations, deploy functions
5. **Setup Stripe**: Create products, configure webhooks
6. **Start Development**: `npm run dev`

## 📞 Support & Maintenance

- **Technical Issues**: Check edge function logs in Supabase dashboard
- **Payment Issues**: Check Stripe dashboard for failed payments
- **Database Issues**: Use Supabase SQL editor for direct queries
- **User Support**: support@askstan.com

---

*This documentation covers the complete AskStan platform architecture, from user registration to subscription management. The system is designed for scalability, security, and seamless user experience.*