# DukaaOn Admin Console

A comprehensive administrative dashboard for the DukaaOn marketplace platform, built with Next.js, Material-UI, and integrated with Supabase.

## Features

### 📊 Dashboard & Analytics
- Real-time KPI monitoring (users, orders, revenue, products)
- Interactive charts and data visualization
- Performance insights and trends
- Revenue and order analytics

### 👥 User Management
- User profile management
- KYC status tracking
- User activity monitoring
- Bulk user operations

### 🛒 Order Management
- Order tracking and status updates
- Order details and customer information
- Payment status monitoring
- Order fulfillment workflow

### 📱 WhatsApp Integration
- WhatsApp Business API management
- Message templates
- Notification settings
- Bulk messaging capabilities

### ⚙️ System Settings
- Payment gateway configuration
- Notification preferences
- API key management
- Database administration

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **UI Library**: Material-UI (MUI) v5
- **Database**: Supabase
- **Charts**: Recharts
- **Styling**: Emotion CSS-in-JS
- **TypeScript**: Full type safety
- **Authentication**: NextAuth.js (ready for integration)

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase project
- Access to DukaaOn main application database

## Installation

1. **Clone and navigate to the admin console directory**:
   ```bash
   cd admin-console
   ```

2. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Environment Setup**:
   Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Application Configuration
   NEXT_PUBLIC_APP_NAME=DukaaOn Admin Console
   NEXT_PUBLIC_ENVIRONMENT=development
   
   # Domain Configuration
   NEXT_PUBLIC_ADMIN_DOMAIN=admin.dukaaon.in
   NEXT_PUBLIC_MAIN_APP_DOMAIN=dukaaon.in
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

   The admin console will be available at `http://localhost:3000`

## Database Integration

The admin console integrates with your existing Supabase database. Ensure the following tables exist:

- `profiles` - User profiles and business details
- `orders` - Order information and status
- `products` - Product catalog
- `notifications` - System notifications
- `payment_config` - Payment gateway settings

### Required Database Permissions

Ensure your Supabase service role has appropriate permissions for:
- Reading user profiles and analytics
- Managing orders and their status
- Updating system configurations
- Sending notifications

## Deployment

### AWS Deployment (Recommended)

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy to AWS**:
   - Use AWS Amplify for easy deployment
   - Or deploy to EC2 with PM2
   - Configure CloudFront for CDN

3. **Domain Configuration**:
   - Point `admin.dukaaon.in` to your deployment
   - Configure SSL certificate
   - Update CORS settings in Supabase

### Environment Variables for Production

```env
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_key
NEXTAUTH_URL=https://admin.dukaaon.in
NEXTAUTH_SECRET=your_secure_secret
```

## Security Considerations

### Authentication
- Implement proper admin authentication
- Use role-based access control (RBAC)
- Enable MFA for admin accounts

### API Security
- Implement rate limiting
- Use environment variables for sensitive data
- Enable CORS only for trusted domains

### Database Security
- Use Row Level Security (RLS) in Supabase
- Implement proper admin policies
- Regular security audits

## Features Overview

### Dashboard
- **KPI Cards**: Total users, orders, revenue, products
- **Charts**: Revenue trends, order distribution, user analytics
- **Recent Activity**: Latest orders and user registrations

### User Management
- **User List**: Searchable and filterable user directory
- **KYC Management**: Approve/reject user verification
- **User Details**: Complete profile and business information

### Order Management
- **Order Tracking**: Real-time order status updates
- **Order Details**: Complete order information and history
- **Status Management**: Update order status and tracking

### Analytics
- **Revenue Analytics**: Daily, weekly, monthly revenue trends
- **User Analytics**: User growth and engagement metrics
- **Product Analytics**: Top-selling products and categories

### Settings
- **Payment Configuration**: Razorpay, Stripe, PayPal settings
- **Notification Settings**: Email, SMS, WhatsApp preferences
- **API Management**: Third-party service configurations

## API Integration

The admin console integrates with:

- **Supabase**: Primary database and authentication
- **WhatsApp Business API**: For customer communication
- **Payment Gateways**: Razorpay, Stripe, PayPal
- **Google Maps**: For location services
- **Azure AI**: For advanced analytics

## Development

### Project Structure
```
admin-console/
├── app/                 # Next.js App Router pages
│   ├── page.tsx        # Dashboard
│   ├── users/          # User management
│   ├── orders/         # Order management
│   ├── analytics/      # Analytics dashboard
│   └── settings/       # System settings
├── components/         # Reusable components
│   └── Layout.tsx     # Main layout component
├── lib/               # Utilities and configurations
│   ├── supabase.ts   # Supabase client and queries
│   └── theme.ts      # Material-UI theme
└── public/           # Static assets
```

### Adding New Features

1. Create new page in `app/` directory
2. Add navigation item in `components/Layout.tsx`
3. Implement database queries in `lib/supabase.ts`
4. Follow Material-UI design patterns

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**:
   - Restart development server after changing `.env`
   - Ensure variables start with `NEXT_PUBLIC_` for client-side access

2. **Supabase Connection Issues**:
   - Verify URL and API key in environment variables
   - Check network connectivity
   - Ensure RLS policies allow admin access

3. **Build Errors**:
   - Run `npm install --legacy-peer-deps` to resolve dependency conflicts
   - Clear `.next` folder and rebuild

### Performance Optimization

- Enable Next.js Image Optimization
- Implement proper caching strategies
- Use React.memo for expensive components
- Optimize database queries with proper indexing

## Support

For technical support or feature requests:
- Check existing issues in the project repository
- Review Supabase documentation for database-related queries
- Consult Material-UI documentation for UI components

## License

This admin console is part of the DukaaOn marketplace platform. All rights reserved.

---

**Note**: This admin console provides comprehensive management capabilities for the DukaaOn platform. Ensure proper security measures are in place before deploying to production.