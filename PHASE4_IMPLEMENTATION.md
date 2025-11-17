# Phase 4 Implementation Guide

## Overview
Phase 4 adds advanced administrative features including bulk operations, export functionality, message templates management, and enhanced analytics capabilities.

## New Features

### 1. Bulk Operations (`/bulk-operations`)
**Location:** `admin-console/app/bulk-operations/page.tsx`

**Features:**
- **Users Tab**: Bulk update user status, role, KYC status, block/unblock users
- **Products Tab**: Bulk update product status, price (percentage), stock, category, activate/deactivate
- **Orders Tab**: Bulk update order status, add notes, assign seller, cancel orders
- **Import CSV Tab**: Bulk import users, products, or orders from CSV files

**Key Functionality:**
- Select multiple items by ID (comma-separated)
- Choose operation type
- Provide operation value
- Confirmation dialog for destructive operations
- CSV file upload with preview
- Real-time validation

**API Endpoints:**
- `POST /api/admin/bulk/users` - Bulk user operations
- `POST /api/admin/bulk/products` - Bulk product operations
- `POST /api/admin/bulk/orders` - Bulk order operations
- `POST /api/admin/bulk/import` - CSV import

### 2. Message Templates Management (`/templates`)
**Location:** `admin-console/app/templates/page.tsx`

**Features:**
- **Email Templates**: Create and manage email templates
- **SMS Templates**: Create and manage SMS templates
- **WhatsApp Templates**: Create and manage WhatsApp templates
- **Push Notification Templates**: Create and manage push notification templates

**Key Functionality:**
- Template CRUD operations
- Variable support using `{{variable_name}}` syntax
- Template preview with variable substitution
- Active/inactive status toggle
- Template type filtering

**Template Variables:**
- Use `{{variable_name}}` in template content
- Variables are automatically detected
- Preview allows testing with sample values

**API Endpoints:**
- `GET /api/admin/templates` - List templates (with optional type filter)
- `POST /api/admin/templates` - Create template
- `PATCH /api/admin/templates/[id]` - Update template
- `DELETE /api/admin/templates/[id]` - Delete template

### 3. Export Functionality
**Location:** `admin-console/lib/export-utils.ts`

**Features:**
- **CSV Export**: Export data tables to CSV format
- **JSON Export**: Export data to JSON format
- **PDF Export**: Export data to PDF (via API route)

**Export Functions:**
- `exportToCSV(data, filename, headers?)` - Export to CSV
- `exportToJSON(data, filename)` - Export to JSON
- `exportToPDF(title, data, columns, filename)` - Export to PDF
- `prepareDataForExport(data, columns)` - Prepare data for export

**Usage:**
- Added to Users page (export button)
- Can be added to Orders, Products, and other pages
- Handles nested objects and arrays
- Proper CSV escaping

### 4. Enhanced Analytics
**Location:** `admin-console/app/analytics/page.tsx` (existing, enhanced)

**Features:**
- Advanced date range filtering
- Revenue and order trends
- User distribution charts
- Top products analysis
- Growth rate calculations

## Database Schema

### New Tables

#### `message_templates`
```sql
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'whatsapp', 'push')),
    subject TEXT,
    content TEXT NOT NULL,
    variables TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_templates_type ON message_templates(type);
CREATE INDEX idx_message_templates_active ON message_templates(is_active);
```

## API Routes

### New Routes

1. **`/api/admin/bulk/users`**
   - `POST`: Perform bulk operations on users

2. **`/api/admin/bulk/products`**
   - `POST`: Perform bulk operations on products

3. **`/api/admin/bulk/orders`**
   - `POST`: Perform bulk operations on orders

4. **`/api/admin/bulk/import`**
   - `POST`: Import data from CSV file

5. **`/api/admin/templates`**
   - `GET`: List templates (with optional type filter)
   - `POST`: Create new template

6. **`/api/admin/templates/[id]`**
   - `PATCH`: Update template
   - `DELETE`: Delete template

7. **`/api/admin/export/pdf`** (to be implemented)
   - `POST`: Generate PDF from data

## Implementation Steps

### Step 1: Database Setup
Run the SQL migration to create the `message_templates` table:
```sql
-- See Database Schema section above
```

### Step 2: Environment Variables
Ensure these are set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Navigation Updates
The Layout component has been updated to include:
- Bulk Operations menu item
- Templates menu item

### Step 4: Export Integration
Add export buttons to other pages:
- Orders page
- Products page
- Analytics page

## Usage Examples

### Bulk User Operations
1. Navigate to Bulk Operations
2. Select "Users" tab
3. Enter user IDs (comma-separated)
4. Select operation (e.g., "Update Status")
5. Enter value (e.g., "active")
6. Click "Execute Bulk Operation"
7. Confirm in dialog

### Creating Message Template
1. Navigate to Templates
2. Select template type tab (Email, SMS, WhatsApp, Push)
3. Click "Create Template"
4. Enter template name
5. Select type
6. Enter subject (for email/push)
7. Enter content with variables like `{{user_name}}`
8. Variables are auto-detected
9. Click "Save"

### Exporting Data
1. Navigate to Users/Orders/Products page
2. Click "Export" button
3. Data is downloaded as CSV file
4. File is named with current date

## CSV Import Format

### Users CSV
```csv
phone_number,role,status,business_details
+1234567890,retailer,active,"{""shopName"":""My Shop""}"
```

### Products CSV
```csv
name,price,stock_available,category_name,seller_id
Product Name,100.00,50,Electronics,seller-id-here
```

### Orders CSV
```csv
retailer_id,seller_id,total_amount,status
retailer-id-1,seller-id-1,500.00,pending
```

## Security Considerations

1. **Bulk Operations**: All operations are logged to audit log
2. **CSV Import**: Validate data before import
3. **Template Variables**: Sanitize user input in templates
4. **Export**: Limit export size to prevent memory issues

## Testing Checklist

- [ ] Bulk user operations work correctly
- [ ] Bulk product operations work correctly
- [ ] Bulk order operations work correctly
- [ ] CSV import works for all types
- [ ] Template CRUD operations work
- [ ] Template preview shows correct output
- [ ] Export to CSV works
- [ ] Export to JSON works
- [ ] All API routes return expected data
- [ ] Error handling works for invalid inputs
- [ ] Navigation links work correctly

## Next Steps

Potential Phase 5 features:
- Advanced search with filters
- Custom dashboard widgets
- Role-based access control (RBAC)
- Multi-language support
- Scheduled reports
- Email/SMS sending from templates
- Advanced analytics with custom date ranges
- Data visualization improvements

