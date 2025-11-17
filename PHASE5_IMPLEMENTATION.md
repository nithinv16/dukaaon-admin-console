# Phase 5 Implementation Guide

## Overview
Phase 5 adds advanced features including role-based access control (RBAC), message sending from templates, advanced search components, and enhanced administrative capabilities.

## New Features

### 1. Advanced Search Component (`components/AdvancedSearch.tsx`)
**Location:** `admin-console/components/AdvancedSearch.tsx`

**Features:**
- Reusable search component with basic and advanced modes
- Multiple filter support with various operators
- Filter chips for active filters
- Expandable advanced filter panel
- Support for text, number, date, and select field types

**Operators:**
- Equals
- Contains
- Starts With
- Ends With
- Greater Than
- Less Than
- Between
- In (comma-separated)

**Usage:**
```tsx
<AdvancedSearch
  onSearch={(query, filters) => {
    // Handle search
  }}
  searchFields={[
    { field: 'name', label: 'Name', type: 'text' },
    { field: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
  ]}
/>
```

### 2. Send Messages (`/send-message`)
**Location:** `admin-console/app/send-message/page.tsx`

**Features:**
- Send emails, SMS, WhatsApp messages, and push notifications
- Template selection with variable substitution
- Multiple recipient selection methods:
  - Specific users (by ID)
  - By role (retailer, wholesaler, manufacturer)
  - Custom (phone numbers/emails)
- Message preview before sending
- Variable filling interface

**Key Functionality:**
- Select template from available templates
- Fill template variables
- Preview message with substituted variables
- Select recipients (users, roles, or custom)
- Send messages in bulk

**API Endpoints:**
- `POST /api/admin/messages/send` - Send messages using templates

### 3. Roles & Permissions (`/roles-permissions`)
**Location:** `admin-console/app/roles-permissions/page.tsx`

**Features:**
- Create and manage custom roles
- Assign permissions per resource and action
- System roles (cannot be modified/deleted)
- Permission matrix interface
- Role assignment to admin users

**Resources:**
- users
- orders
- products
- categories
- payments
- analytics
- settings
- templates
- bulk_operations
- database_tools
- audit_log
- dynamic_content
- messages

**Actions:**
- view
- create
- update
- delete
- export
- manage

**Default System Roles:**
1. **Super Admin**: Full access to all features
2. **Admin**: Standard admin access with limited permissions
3. **Support**: Limited access for support staff

**API Endpoints:**
- `GET /api/admin/roles` - List all roles
- `POST /api/admin/roles` - Create new role
- `PATCH /api/admin/roles/[id]` - Update role
- `DELETE /api/admin/roles/[id]` - Delete role

## Database Schema

### New Tables

#### `admin_roles`
```sql
CREATE TABLE admin_roles (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Permissions Format:**
```json
[
  {
    "resource": "users",
    "actions": ["view", "create", "update", "delete"]
  }
]
```

#### Updated `admin_credentials`
- Added `role_id` column (references `admin_roles.id`)

## Implementation Steps

### Step 1: Database Setup
Run the SQL migration:
```sql
-- Run admin-console/sql/phase5_tables.sql
```

### Step 2: Environment Variables
Ensure these are set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Navigation Updates
The Layout component has been updated to include:
- Send Messages menu item
- Roles & Permissions menu item

### Step 4: Message Service Integration
The message sending API currently creates message records. To actually send messages, integrate with:
- **Email**: SendGrid, AWS SES, Mailgun
- **SMS**: Twilio, AWS SNS
- **WhatsApp**: WhatsApp Business API
- **Push**: Firebase Cloud Messaging (FCM)

### Step 5: Permission Checking
Add permission checks to API routes and components:
```typescript
// Example permission check
const hasPermission = (resource: string, action: string) => {
  const userRole = getCurrentUserRole();
  const permissions = userRole.permissions;
  const resourcePerms = permissions.find(p => p.resource === resource);
  return resourcePerms?.actions.includes(action) || false;
};
```

## Usage Examples

### Using Advanced Search Component
```tsx
import AdvancedSearch from '@/components/AdvancedSearch';

<AdvancedSearch
  onSearch={(query, filters) => {
    // Apply search and filters
    loadData({ query, filters });
  }}
  searchFields={[
    { field: 'name', label: 'Name', type: 'text' },
    { field: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
    { field: 'price', label: 'Price', type: 'number' },
  ]}
  placeholder="Search products..."
/>
```

### Sending Messages
1. Navigate to Send Messages
2. Select template type (Email, SMS, WhatsApp, Push)
3. Choose a template
4. Fill in template variables
5. Preview the message
6. Select recipients (users, roles, or custom)
7. Click "Send Messages"

### Creating Custom Role
1. Navigate to Roles & Permissions
2. Click "Create Role"
3. Enter role name and description
4. Check permissions for each resource/action
5. Save role
6. Assign role to admin users (via admin_credentials table)

## Security Considerations

1. **RBAC**: All API routes should check permissions before allowing operations
2. **System Roles**: System roles cannot be modified or deleted
3. **Message Sending**: Validate recipients and sanitize template content
4. **Permission Checks**: Implement middleware for permission checking

## Testing Checklist

- [ ] Advanced search component works correctly
- [ ] Filters are applied properly
- [ ] Message sending creates records
- [ ] Template variables are substituted correctly
- [ ] Role CRUD operations work
- [ ] Permissions are saved correctly
- [ ] System roles cannot be modified
- [ ] Permission checks work in API routes
- [ ] Navigation links work correctly

## Next Steps

Potential Phase 6 features:
- Custom dashboard widgets with drag-and-drop
- Scheduled reports and exports
- Multi-language support
- Advanced analytics with custom date ranges
- Data visualization improvements
- Webhook management
- API key management
- Activity feed/notifications
- File upload management
- System health monitoring

## Integration Notes

### Message Service Integration
To actually send messages, you'll need to:

1. **Email Service** (e.g., SendGrid):
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
await sgMail.send({
  to: recipient,
  from: 'noreply@yourapp.com',
  subject: subject,
  html: content,
});
```

2. **SMS Service** (e.g., Twilio):
```typescript
import twilio from 'twilio';
const client = twilio(accountSid, authToken);
await client.messages.create({
  body: content,
  from: '+1234567890',
  to: recipient,
});
```

3. **Background Jobs**: Consider using a queue system (Bull, BullMQ) for sending messages in the background to avoid blocking API requests.

