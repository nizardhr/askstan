# AskStan - AI Social Media Growth Platform

## 🚀 Project Overview

AskStan is a comprehensive SaaS platform that provides AI-powered social media growth coaching. Built with React, Supabase, and Stripe, it offers personalized strategies for LinkedIn, X (Twitter), Instagram, Threads, and other platforms to help users build profitable social media businesses.

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Lucide React** for icons

### Backend Stack
- **Supabase** for authentication, database, and edge functions
- **PostgreSQL** database with Row Level Security (RLS)
- **Stripe** for subscription management and payments
- **Netlify** for frontend deployment

## 📊 Database Schema

### Core Tables

#### `user_profiles`
- User profile information and settings
- Links to Supabase auth.users
- Tracks onboarding completion and activity

#### `user_subscriptions`
- Complete Stripe subscription lifecycle management
- Tracks subscription status, plan type, billing periods
- Handles promo codes and discounts

#### `billing_history`
- Payment and invoice tracking
- Links to Stripe payment records
- Revenue analytics and reporting

#### `chat_conversations` & `chat_messages`
- AI chat conversation management
- Message history and organization
- Role-based message types (user, assistant, system)

#### `promo_code_usage`
- Detailed promo code tracking
- Discount analytics and business intelligence
- Revenue impact analysis

#### `content_templates`
- Pre-built social media content templates
- Platform-specific growth strategies
- Premium content for subscribers

#### `growth_metrics` & `user_achievements`
- Social media analytics tracking
- Gamification system for user engagement
- Platform-specific performance metrics

## 🔐 Authentication Flow

### User Registration
1. User signs up with email/password
2. Supabase creates auth.users record
3. Database trigger automatically creates:
   - User profile in `user_profiles`
   - Default preferences in `user_preferences`
   - Welcome conversation in `chat_conversations`
4. User is redirected to subscription selection

### User Login
1. User signs in with credentials
2. System fetches user profile and subscription data
3. Routes user based on subscription status:
   - **Active subscription** → Dashboard
   - **No subscription** → Plan selection
   - **Past due/canceled** → Payment required page

## 💳 Stripe Integration

### Subscription Plans
- **Monthly Pro**: $4.99/month
- **Yearly Pro**: $49.99/year (save $10)

### Checkout Flow

#### Regular Paid Checkout
1. User selects plan on `/subscribe`
2. Optional promo code validation via `validate-promo-code` edge function
3. `create-checkout-session` edge function creates Stripe checkout
4. User completes payment on Stripe
5. Stripe redirects to `/checkout-success?session_id=xxx`
6. `process-checkout-session` edge function activates subscription
7. Database updated with active subscription
8. User redirected to dashboard

#### 100% Promo Code Flow
1. User applies 100% discount promo code
2. System validates promo code via Stripe API
3. **No Stripe checkout required** - subscription created directly
4. Database updated with active subscription
5. User redirected to dashboard with `?free_subscription=true`

### Webhook Handling
- `stripe-webhook` edge function processes Stripe events
- Handles subscription updates, cancellations, payment failures
- Keeps database in sync with Stripe subscription status

## 🛡️ Security

### Row Level Security (RLS)
- All tables have comprehensive RLS policies
- Users can only access their own data
- Service role has full access for webhooks and admin operations

### Authentication
- Email/password authentication via Supabase Auth
- No email confirmation required (disabled for smoother UX)
- Password reset functionality with secure email links

### API Security
- Edge functions use service role keys for database access
- CORS headers properly configured for production domain
- Stripe webhook signature verification

## 🔧 Edge Functions

### `/functions/create-checkout-session`
- Creates Stripe checkout sessions
- Handles promo code application
- Special logic for 100% discount codes (bypasses Stripe)
- Creates user profiles if missing

### `/functions/validate-promo-code`
- Validates promo codes against Stripe API
- Returns discount information and validity
- Handles all Stripe promotion code edge cases

### `/functions/process-checkout-session`
- Processes completed checkout sessions
- Activates subscriptions in database
- Creates billing records
- Records promo code usage

### `/functions/create-portal-session`
- Creates Stripe customer portal sessions
- Allows users to manage billing and subscriptions
- Secure access with user authentication

### `/functions/stripe-webhook`
- Handles all Stripe webhook events
- Keeps database in sync with Stripe
- Processes subscription lifecycle events

## 🎯 Key Features

### AI Social Media Coaching
- Personalized growth strategies for all major platforms
- Daily posting guidance and content ideas
- Engagement tactics and algorithm optimization
- Revenue generation strategies

### Subscription Management
- Flexible monthly and yearly plans
- Promo code support with analytics
- Customer portal for self-service billing
- Automatic subscription lifecycle management

### User Experience
- Responsive design for all devices
- Smooth onboarding flow
- Real-time chat interface with AI coach
- Comprehensive settings and preferences

### Analytics & Tracking
- Subscription revenue analytics
- Promo code usage tracking
- User engagement metrics
- Growth performance monitoring

## 🚀 Deployment

### Frontend (Netlify)
- Automatic deployment from main branch
- Environment variables configured in Netlify dashboard
- Custom domain: https://askstan.io

### Backend (Supabase)
- Database migrations auto-applied
- Edge functions deployed via GitHub Actions
- Environment variables in Supabase dashboard

### Required Environment Variables

#### Frontend (.env)
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
```

## 🔄 Data Flow

### User Signup → Subscription → Dashboard
1. **Signup**: User creates account → Profile auto-created
2. **Plan Selection**: User chooses subscription plan
3. **Checkout**: Stripe checkout or direct activation (100% promo)
4. **Activation**: Database updated with active subscription
5. **Dashboard**: User gets full access to AI coaching

### Subscription Management
1. **Status Changes**: Stripe webhooks update database
2. **Billing Events**: All payments tracked in billing_history
3. **Customer Portal**: Users manage billing through Stripe
4. **Cancellations**: Handled via webhooks and customer portal

## 🧪 Testing

### Test User Accounts
- Use real email addresses for testing
- Test both signup and login flows
- Verify subscription activation after checkout
- Test promo code validation and application

### Database Testing
- All users should have profiles after signup
- Subscription status should update after checkout
- Billing records should be created for all payments
- Promo code usage should be tracked

## 🐛 Troubleshooting

### Common Issues

#### "User profile not found"
- Check if profile creation trigger is working
- Verify RLS policies allow profile creation
- Run migration to fix existing users without profiles

#### "Checkout session creation failed"
- Verify Stripe API keys are correct
- Check if user profile exists
- Ensure edge function has proper permissions

#### "Subscription not activated"
- Check if webhook is properly configured
- Verify process-checkout-session function is working
- Check database for subscription records

#### "100% promo code requires payment"
- Ensure promo code validation is working
- Check if promotion code is properly configured in Stripe
- Verify 100% discount detection logic

### Debug Tools
- Database diagnostic component available
- Comprehensive logging in all edge functions
- User stats function for troubleshooting

## 📈 Business Intelligence

### Revenue Tracking
- Monthly recurring revenue (MRR)
- Customer lifetime value (CLV)
- Churn rate and retention metrics
- Promo code effectiveness analysis

### User Analytics
- User engagement and activity tracking
- Feature usage statistics
- Growth coaching effectiveness
- Platform-specific performance metrics

## 🔮 Future Enhancements

### Planned Features
- Advanced social media analytics integration
- Automated content scheduling
- Team collaboration features
- White-label solutions for agencies

### Technical Improvements
- Real-time notifications
- Advanced caching strategies
- Performance optimizations
- Enhanced security measures

---

## 🛠️ Development Setup

1. **Clone Repository**
2. **Install Dependencies**: `npm install`
3. **Setup Environment**: Copy `.env.example` to `.env`
4. **Configure Supabase**: Set up project and run migrations
5. **Configure Stripe**: Set up products, prices, and webhooks
6. **Start Development**: `npm run dev`

## 📞 Support

For technical issues or business inquiries:
- **Email**: support@askstan.com
- **Documentation**: This file
- **Database**: Check migration files for schema details
- **Edge Functions**: Check function files for API details

---

*Built with ❤️ by Yvexan Agency for social media growth coaching*