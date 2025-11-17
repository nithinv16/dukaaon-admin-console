# Phase 3 Implementation Guide

## Overview
Phase 3 adds advanced administrative features including enhanced user profile management, database tools, audit logging, seller inventory management, and improved order management.

## New Features

### 1. Enhanced User Profile Editor (`/users/[id]`)
**Location:** `admin-console/app/users/[id]/page.tsx`

**Features:**
- Comprehensive profile editing with tabs for:
  - **Profile Tab**: Basic info, role, status, KYC status
  - **Business Details Tab**: Shop name, owner details, GSTIN, PAN, address, location coordinates
  - **Orders Tab**: View all orders for the user
  - **Products Tab**: View all products for the user (if seller)
  - **Seller Details Tab**: Extended seller information including bank details (for wholesalers/manufacturers)

**Key Functionality:**
- Edit mode toggle for making changes
- Real-time updates to user profile
- KYC document viewing
- Location coordinates display
- Integration with seller_details table for extended seller information

**API Endpoints:**
- `GET /api/admin/users/[id]/seller-details` - Fetch seller details
- `PATCH /api/admin/users/[id]/seller-details` - Update seller details

### 2. Database Tools (`/database-tools`)
**Location:** `admin-console/app/database-tools/page.tsx`

**Features:**
- Safe execution of pre-approved database functions
- Function selection with descriptions
- Parameter input forms
- Confirmation dialogs for destructive operations
- Result display with error handling

**Available Functions:**
- `recalculate_user_stats` - Recalculate user statistics
- `rebuild_order_totals` - Recalculate order totals
- `cleanup_old_notifications` - Delete old notifications (requires confirmation)
- `reindex_products` - Rebuild product search indexes
- `sync_master_products` - Sync master products catalog

**Security:**
- Only pre-approved functions can be executed
- Whitelist enforced in API route
- All executions logged to audit log

**API Endpoints:**
- `POST /api/admin/db/run-function` - Execute database function
- `GET /api/admin/db/run-function` - List available functions

### 3. Audit Log Viewer (`/audit-log`)
**Location:** `admin-console/app/audit-log/page.tsx`

**Features:**
- Complete audit trail of all admin actions
- Filtering by action type and entity type
- Pagination for large datasets
- Detailed view showing:
  - Timestamp
  - Admin who performed action
  - Action type with color coding
  - Entity type and ID
  - Before/after data snapshots

**Filters:**
- Action type (update_user, delete_user, update_order, etc.)
- Entity type (user, order, product, config, content, message)

**API Endpoints:**
- `GET /api/admin/audit-log` - Fetch audit log entries

### 4. Seller Inventory Management (`/seller-inventory`)
**Location:** `admin-console/app/seller-inventory/page.tsx`

**Features:**
- Seller selection dropdown
- View all products for selected seller
- Search and filter products
- Edit product details (price, stock, status)
- Real-time inventory updates

**Key Functionality:**
- Filter by seller (wholesalers/manufacturers only)
- Search products by name
- Filter by category
- Edit product stock and pricing
- Update product status

### 5. Enhanced Order Management
**Location:** `admin-console/app/orders/page.tsx` and `admin-console/app/orders/[id]/page.tsx`

**Enhancements:**
- Detailed order view page
- Order status tracking
- Order notes and comments
- Seller assignment (if needed)
- Order history timeline

## Database Schema

### New/Updated Tables

#### `seller_details` (existing, enhanced)
```sql
CREATE TABLE seller_details (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    seller_type TEXT,
    business_name TEXT,
    owner_name TEXT,
    address JSONB,
    location_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    gstin TEXT,
    pan_number TEXT,
    bank_details JSONB,
    image_url TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

#### `admin_audit_log` (from Phase 2)
Used for tracking all admin actions including:
- Database function executions
- User profile updates
- Order modifications
- Product changes
- Configuration updates

## API Routes

### New Routes

1. **`/api/admin/users/[id]/seller-details`**
   - `GET`: Fetch seller details for a user
   - `PATCH`: Update seller details

2. **`/api/admin/db/run-function`**
   - `GET`: List available database functions
   - `POST`: Execute a database function

3. **`/api/admin/audit-log`** (from Phase 2)
   - `GET`: Fetch audit log entries with filtering

## Implementation Steps

### Step 1: Database Setup
Run the SQL migrations if not already done:
```sql
-- Ensure seller_details table exists
-- Ensure admin_audit_log table exists (from Phase 2)
```

### Step 2: Create Database Functions
Create the safe database functions that can be executed:
```sql
-- Example: recalculate_user_stats
CREATE OR REPLACE FUNCTION recalculate_user_stats(user_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Implementation
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
```

### Step 3: Environment Variables
Ensure these are set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Navigation Updates
The Layout component has been updated to include:
- Database Tools menu item
- Audit Log menu item
- Seller Inventory menu item

## Security Considerations

1. **Database Functions**: Only whitelisted functions can be executed
2. **Audit Logging**: All admin actions are logged
3. **Service Role Key**: Only used server-side in API routes
4. **User Permissions**: Admin authentication required for all operations

## Usage Examples

### Viewing User Profile
1. Navigate to Users page
2. Click on a user's view icon
3. Review profile details across tabs
4. Click "Edit Profile" to make changes
5. Save changes

### Executing Database Function
1. Navigate to Database Tools
2. Select a function from the list
3. Enter required parameters
4. Click "Execute Function"
5. Review results

### Viewing Audit Log
1. Navigate to Audit Log
2. Use filters to narrow down entries
3. Review action history
4. Check before/after data for changes

### Managing Seller Inventory
1. Navigate to Seller Inventory
2. Select a seller from dropdown
3. View their products
4. Use search/filter to find specific products
5. Click edit icon to modify product details

## Testing Checklist

- [ ] User profile editing works correctly
- [ ] Seller details can be viewed and updated
- [ ] Database functions execute successfully
- [ ] Audit log displays all actions
- [ ] Seller inventory management works
- [ ] Order details page displays correctly
- [ ] All API routes return expected data
- [ ] Error handling works for invalid inputs
- [ ] Navigation links work correctly

## Next Steps

Potential Phase 4 features:
- Advanced analytics and reporting
- Bulk operations (bulk user updates, bulk product imports)
- Export functionality (CSV, PDF)
- Email/SMS templates management
- Advanced search and filtering
- Custom dashboard widgets
- Role-based access control (RBAC)
- Multi-language support for admin console

