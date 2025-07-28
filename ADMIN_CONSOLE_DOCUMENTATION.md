# DukaaOn Admin Console - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Authentication System](#authentication-system)
5. [Database Integration](#database-integration)
6. [Core Components](#core-components)
7. [Pages and Features](#pages-and-features)
8. [Workflow](#workflow)
9. [Development Setup](#development-setup)
10. [API Integration](#api-integration)
11. [Security](#security)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)
14. [Future Development Guidelines](#future-development-guidelines)

## Overview

The DukaaOn Admin Console is a comprehensive web-based administrative dashboard built with **Next.js 14**, **Material-UI (MUI)**, and **TypeScript**. It provides administrators with tools to manage users, orders, products, payments, and analytics for the DukaaOn marketplace platform.

### Key Technologies
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **UI Framework**: Material-UI (MUI) v5
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom admin authentication with localStorage
- **Charts**: Recharts library
- **Styling**: Emotion (CSS-in-JS)
- **State Management**: React Context API

## Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin User    │────│  Admin Console  │────│    Supabase     │
│   (Browser)     │    │   (Next.js)     │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  External APIs  │
                       │ (WhatsApp, etc) │
                       └─────────────────┘
```

### Application Flow
1. **Authentication**: Admin logs in using credentials stored in `admin_credentials` table
2. **Session Management**: Session stored in localStorage with auto-refresh
3. **Route Protection**: ProtectedRoute component guards all admin pages
4. **Data Fetching**: Supabase client handles all database operations
5. **Real-time Updates**: Components fetch fresh data on mount and user actions

## Project Structure

```
admin-console/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Dashboard (main page)
│   ├── login/                   # Authentication
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── users/                   # User management
│   │   └── page.tsx
│   ├── orders/                  # Order management
│   │   ├── page.tsx
│   │   └── [id]/               # Individual order details
│   ├── products/                # Product management
│   │   └── page.tsx
│   ├── categories/              # Category management
│   │   └── page.tsx
│   ├── payments/                # Payment configuration
│   │   └── page.tsx
│   ├── whatsapp/                # WhatsApp integration
│   │   └── page.tsx
│   ├── analytics/               # Analytics and reports
│   │   └── page.tsx
│   └── settings/                # System settings
│       └── page.tsx
├── components/                   # Reusable components
│   ├── Layout.tsx               # Main layout with sidebar
│   ├── ProtectedRoute.tsx       # Authentication guard
│   └── notifications/           # Notification components
│       ├── NotificationBell.tsx
│       └── TestNotificationButton.tsx
├── contexts/                     # React Context providers
│   └── AuthContext.tsx          # Authentication state management
├── lib/                         # Utility libraries
│   ├── supabase.ts             # Database client and queries
│   └── theme.ts                # MUI theme configuration
├── sql/                         # Database scripts
│   └── create_admin_credentials_table.sql
├── .env                         # Environment variables
├── package.json                 # Dependencies and scripts
└── tsconfig.json               # TypeScript configuration
```

## Authentication System

### Overview
The admin console uses a custom authentication system separate from the main app's user authentication. This provides enhanced security and isolation.

### Components

#### 1. Database Table: `admin_credentials`
```sql
CREATE TABLE public.admin_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. Authentication Function
```sql
CREATE OR REPLACE FUNCTION validate_admin_credentials(
    input_email TEXT,
    input_password TEXT
) RETURNS JSONB
```

#### 3. AuthContext (`contexts/AuthContext.tsx`)
- Manages authentication state
- Handles login/logout operations
- Provides session persistence
- Exposes `refreshAuth()` for manual state refresh

#### 4. ProtectedRoute (`components/ProtectedRoute.tsx`)
- Guards all admin pages
- Redirects unauthenticated users to login
- Redirects authenticated users away from login page

### Authentication Flow
1. User enters credentials on login page
2. `validateAdminCredentials()` function called via Supabase RPC
3. On success, admin data stored in localStorage as `admin_session`
4. AuthContext detects session and updates state
5. ProtectedRoute allows access to admin pages
6. Session persists until logout or browser data cleared

### Default Credentials
- **Email**: `admin@dukaaon.in`
- **Password**: `dukaaon#28`

## Database Integration

### Supabase Configuration
The application connects to Supabase using environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Key Database Tables

#### 1. `profiles` - User Management
```typescript
interface Profile {
  id: string;
  phone_number: string;
  role: 'retailer' | 'wholesaler' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  kyc_status: 'pending' | 'verified' | 'rejected';
  business_details?: {
    shopName: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
}
```

#### 2. `orders` - Order Management
```typescript
interface Order {
  id: string;
  retailer_id: string;
  seller_id: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  delivery_address: string;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
    product_name: string;
  }>;
}
```

#### 3. `products` - Product Catalog
```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory: string;
  seller_id: string;
  status: 'active' | 'inactive' | 'out_of_stock';
  stock_available?: number;
}
```

### Admin Queries (`lib/supabase.ts`)
The `adminQueries` object provides methods for:
- User management (getAllUsers, getUsersByRole, updateUserStatus)
- Order management (getAllOrders, getOrdersByStatus)
- Product management (getAllProducts, updateProductStatus)
- Analytics (getDashboardStats, getRevenueData)

## Core Components

### 1. Layout Component (`components/Layout.tsx`)
**Purpose**: Provides the main application layout with sidebar navigation and header.

**Features**:
- Responsive sidebar with navigation menu
- Top header with page title and user menu
- Notification bell integration
- Mobile-responsive drawer navigation

**Menu Items**:
- Dashboard (`/`)
- Users (`/users`)
- Orders (`/orders`)
- Products (`/products`)
- Categories (`/categories`)
- Payments (`/payments`)
- WhatsApp (`/whatsapp`)
- Notifications (`/notifications`)
- Analytics (`/analytics`)
- Settings (`/settings`)

### 2. ProtectedRoute Component (`components/ProtectedRoute.tsx`)
**Purpose**: Implements route-level authentication and authorization.

**Logic**:
- Shows loading spinner while checking authentication
- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from `/login`
- Wraps protected pages with Layout component
- Returns login page without layout

### 3. AuthContext (`contexts/AuthContext.tsx`)
**Purpose**: Manages global authentication state.

**State**:
- `user`: Current admin user data
- `loading`: Authentication check in progress
- `isAdmin`: Boolean flag for admin status

**Methods**:
- `signOut()`: Clears session and redirects to login
- `refreshAuth()`: Manually refresh authentication state

## Pages and Features

### 1. Dashboard (`app/page.tsx`)
**Purpose**: Main overview page with key metrics and charts.

**Features**:
- KPI cards (users, orders, revenue)
- Interactive charts (orders over time, revenue trends)
- Recent orders list
- Time filter options (7 days, 4 weeks, 12 months, 5 years)
- Real-time data refresh

**Data Sources**:
- User statistics from `profiles` table
- Order statistics from `orders` table
- Revenue calculations from order totals

### 2. Login Page (`app/login/page.tsx`)
**Purpose**: Admin authentication interface.

**Features**:
- Email and password input fields
- Form validation
- Loading states
- Error handling
- Auto-redirect after successful login

### 3. Users Management (`app/users/page.tsx`)
**Purpose**: Manage platform users (retailers, wholesalers, manufacturers).

**Features**:
- User listing with pagination
- Filter by role and status
- User profile viewing
- Status updates (active/inactive/suspended)
- KYC status management
- Search functionality

### 4. Orders Management (`app/orders/page.tsx`)
**Purpose**: Monitor and manage customer orders.

**Features**:
- Order listing with details
- Status tracking and updates
- Order search and filtering
- Individual order details (`app/orders/[id]/`)
- Bulk operations

### 5. Products Management (`app/products/page.tsx`)
**Purpose**: Manage product catalog.

**Features**:
- Product listing and search
- Category and subcategory filtering
- Product status management
- Inventory tracking
- Seller information

### 6. Analytics (`app/analytics/page.tsx`)
**Purpose**: Advanced reporting and analytics.

**Features**:
- Revenue analytics
- User growth metrics
- Order trends
- Product performance
- Custom date ranges
- Exportable reports

### 7. Settings (`app/settings/page.tsx`)
**Purpose**: System configuration and preferences.

**Features**:
- Payment gateway configuration
- Notification settings
- API management
- System preferences

## Workflow

### Typical Admin Workflow

1. **Login**
   - Admin accesses `/login`
   - Enters credentials
   - System validates against `admin_credentials` table
   - On success, redirected to dashboard

2. **Dashboard Overview**
   - View key metrics and trends
   - Check recent orders and activities
   - Navigate to specific management areas

3. **User Management**
   - Review new user registrations
   - Verify KYC documents
   - Update user statuses
   - Handle user issues

4. **Order Management**
   - Monitor incoming orders
   - Track order fulfillment
   - Handle order issues
   - Update order statuses

5. **Product Management**
   - Review new product listings
   - Manage product categories
   - Monitor inventory levels
   - Handle product issues

6. **Analytics Review**
   - Analyze business performance
   - Generate reports
   - Identify trends and opportunities

### Data Flow

```
User Action → Component → Supabase Query → Database → Response → UI Update
```

Example: Updating User Status
1. Admin clicks "Suspend User" button
2. Component calls `adminQueries.updateUserStatus()`
3. Function executes SQL UPDATE on `profiles` table
4. Database returns updated record
5. Component refreshes user list
6. UI shows updated status

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Git for version control

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd admin-console
   ```

2. **Install Dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Configure variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **Database Setup**
   - Execute `sql/create_admin_credentials_table.sql` in Supabase SQL Editor
   - Verify admin credentials table creation

5. **Start Development Server**
   ```bash
   npm run dev
   ```
   
   Application runs on `http://localhost:3001`

### Development Scripts
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

## API Integration

### Supabase Integration
All database operations use the Supabase client configured in `lib/supabase.ts`.

**Key Features**:
- Automatic connection management
- Built-in authentication
- Real-time subscriptions (future enhancement)
- Row Level Security (RLS) support

### External APIs
The admin console integrates with:
- **WhatsApp Business API**: Customer communication
- **Payment Gateways**: Razorpay, Stripe, PayPal
- **Google Maps**: Location services
- **Azure AI**: Advanced analytics (future)

## Security

### Authentication Security
- Separate admin credentials table
- Password hashing (bcrypt)
- Session-based authentication
- Automatic session expiry

### Database Security
- Row Level Security (RLS) enabled
- Role-based access control
- Prepared statements prevent SQL injection
- Environment variable protection

### Frontend Security
- Protected routes with authentication guards
- Input validation and sanitization
- HTTPS enforcement in production
- Secure session storage

## Deployment

### Production Deployment

1. **Build Application**
   ```bash
   npm run build
   ```

2. **Environment Variables**
   Set production environment variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=production_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=production_key
   ```

3. **Deploy to Platform**
   - **Vercel**: Connect GitHub repository
   - **Netlify**: Deploy build folder
   - **Custom Server**: Use `npm start`

4. **Domain Configuration**
   - Point `admin.dukaaon.in` to deployment
   - Configure SSL certificate
   - Update CORS settings in Supabase

### Production Considerations
- Enable production optimizations
- Configure monitoring and logging
- Set up backup procedures
- Implement security headers

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Restart development server
   - Ensure variables start with `NEXT_PUBLIC_`
   - Check `.env` file location

2. **Authentication Failures**
   - Verify admin credentials in database
   - Check Supabase connection
   - Clear localStorage and retry

3. **Database Connection Issues**
   - Verify Supabase URL and keys
   - Check network connectivity
   - Review Supabase project status

4. **Build Errors**
   - Clear `.next` folder
   - Reinstall dependencies
   - Check TypeScript errors

### Debug Mode
Enable debug logging by setting:
```env
NEXT_PUBLIC_DEBUG=true
```

## Future Development Guidelines

### Code Standards
- Use TypeScript for all new code
- Follow React best practices
- Implement proper error handling
- Add comprehensive comments
- Write unit tests for critical functions

### Component Development
- Create reusable components in `/components`
- Use Material-UI components consistently
- Implement responsive design
- Follow accessibility guidelines

### Database Operations
- Add new queries to `adminQueries` object
- Implement proper error handling
- Use TypeScript interfaces for data types
- Consider performance implications

### New Feature Development
1. **Planning**
   - Define requirements clearly
   - Design database schema changes
   - Plan component architecture

2. **Implementation**
   - Create database migrations if needed
   - Implement backend queries
   - Build frontend components
   - Add proper routing

3. **Testing**
   - Test all user flows
   - Verify responsive design
   - Check error handling
   - Validate security measures

### Performance Optimization
- Implement pagination for large datasets
- Use React.memo for expensive components
- Optimize database queries
- Consider caching strategies

### Security Enhancements
- Regular security audits
- Update dependencies regularly
- Implement additional authentication factors
- Monitor for suspicious activities

---

## Conclusion

This documentation provides a comprehensive overview of the DukaaOn Admin Console. For specific implementation details, refer to the source code and inline comments. For questions or contributions, contact the development team.

**Last Updated**: December 2024
**Version**: 1.0.0
**Maintainer**: DukaaOn Development Team