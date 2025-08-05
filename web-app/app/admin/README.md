# Admin Dashboard

A comprehensive admin dashboard for managing users and monitoring app performance.

## Features

### 🔐 Admin Authentication
- Only users with `admin_role = true` in the profiles table can access
- Automatic redirection for non-admin users
- Secure authentication middleware

### 📊 Dashboard Overview
- **User Statistics**: Total users, Pro/Elite users, active subscriptions
- **Revenue Metrics**: Estimated monthly revenue, new users today
- **RevenueCat Integration**: Real-time subscription analytics (when API key is configured)

### 👥 User Management
- **Paginated User Table**: View all users with search and filtering
- **User Details Modal**: Comprehensive user information
- **Tier Management**: Upgrade/downgrade users between Free, Pro, and Elite
- **Search & Filters**: Find users by name/email, filter by tier and status

### 📈 Analytics
- **User Activity Chart**: Visual representation of user growth
- **RevenueCat Metrics**: Active subscribers, trials, conversion rates
- **Real-time Data**: Auto-refreshing dashboard with latest stats

### ⚡ Quick Actions
- **Send Notifications**: Broadcast push notifications to all users
- **Export Data**: Download user data as CSV
- **Database Backup**: Initiate database backup (placeholder)
- **Analytics Dashboard**: Quick access to detailed analytics

## Setup

### 1. Enable Admin Access
To make a user an admin, update their profile in the database:

```sql
UPDATE profiles 
SET admin_role = true 
WHERE id = 'user-id-here';
```

### 2. RevenueCat Integration (Optional)
Add your RevenueCat API key to environment variables:

```bash
REVENUECAT_API_KEY=your_api_key_here
```

If no API key is provided, mock data will be displayed.

### 3. Access the Dashboard
Navigate to `/admin` while logged in as an admin user.

## Security

- ✅ Admin role verification on every page load
- ✅ Server-side authentication checks
- ✅ Automatic redirection for unauthorized users
- ✅ Secure API calls with proper error handling

## User Management Actions

### Upgrade User to Pro
- Changes `subscription_tier` to 'pro'
- Sets `subscription_status` to 'active'
- Updates `subscription_started_at` timestamp

### Upgrade User to Elite
- Changes `subscription_tier` to 'elite'
- Sets `subscription_status` to 'active'
- Updates `subscription_started_at` timestamp

### Downgrade to Free
- Changes `subscription_tier` to 'free'
- Sets `subscription_status` to 'inactive'
- Clears `subscription_started_at`

## Design System

The admin dashboard follows the app's design system:
- **Colors**: Predictive blue, purple, and gold gradients
- **Components**: Consistent with the main app styling
- **Animations**: Smooth transitions and loading states
- **Responsive**: Works on desktop, tablet, and mobile

## Components

### Core Components
- `AdminDashboard` - Main dashboard page
- `UserActivityChart` - Custom canvas-based chart
- `QuickActions` - Action buttons with loading states

### Styling
- Tailwind CSS with custom predictive colors
- Framer Motion animations
- Backdrop blur effects
- Consistent with main app theme

## Future Enhancements

- 📧 Email notification system
- 📱 Push notification management
- 📊 Advanced analytics with charts
- 🔄 Real-time user activity monitoring
- 💳 Stripe payment management
- 🎯 A/B testing controls
- 📝 Audit logs
- 🔔 Admin notifications