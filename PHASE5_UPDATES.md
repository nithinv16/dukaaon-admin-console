# Phase 5 Updates for Existing admin_credentials Table

## Changes Made

### 1. Database Migration (`sql/phase5_tables.sql`)
- **Added `role_id` column** to existing `admin_credentials` table
- **Kept existing `role` TEXT column** for backward compatibility
- **Migration script** maps existing role text values to new role_id references
- **Default role assignment** for admins without a role_id

### 2. New Admin Users Management Page (`/admin-users`)
- View all admin users
- See both legacy `role` text field and new `role_id` assignment
- Assign roles from the Roles & Permissions system
- Edit admin user role assignments

### 3. API Routes
- `GET /api/admin/admin-users` - List admin users with their assigned roles
- `PATCH /api/admin/admin-users/[id]` - Update admin user role assignment

## Database Structure

### Existing `admin_credentials` Table
```sql
CREATE TABLE admin_credentials (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',  -- Legacy text field (kept)
    status TEXT NOT NULL DEFAULT 'active',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### New Column Added
```sql
role_id UUID REFERENCES admin_roles(id)  -- New foreign key (nullable)
```

## Migration Process

The migration script:
1. Adds `role_id` column if it doesn't exist
2. Creates index on `role_id`
3. Maps existing `role` text values to `role_id`:
   - 'admin' or 'Admin' → 'Admin' role
   - 'super_admin' or 'Super Admin' → 'Super Admin' role
   - 'support' or 'Support' → 'Support' role
4. Assigns 'Admin' role by default to any remaining admins

## Backward Compatibility

- **Existing code continues to work**: The `role` TEXT field is still present and used
- **AuthContext**: Still uses `role` string for authentication checks
- **validate_admin_credentials function**: Still returns `role` text field
- **Gradual migration**: You can migrate to using `role_id` over time

## Usage

### Viewing Admin Users
1. Navigate to "Admin Users" in the sidebar
2. See all admin users with their legacy role and assigned role
3. Click edit icon to assign/change roles

### Assigning Roles
1. Go to Admin Users page
2. Click edit icon on an admin user
3. Select a role from the dropdown
4. Save to assign the role

### Checking Permissions
When implementing permission checks, you can:
- Use `role_id` to fetch full role with permissions from `admin_roles` table
- Or continue using the legacy `role` text field for simple checks

## Next Steps

1. **Run the migration**: Execute `sql/phase5_tables.sql` in Supabase
2. **Assign roles**: Use the Admin Users page to assign roles to existing admins
3. **Update permission checks**: Gradually migrate to using `role_id` for permission checks
4. **Update validate_admin_credentials**: Optionally update the function to also return `role_id`

## Example: Getting Admin Permissions

```typescript
// Get admin user with role and permissions
const { data } = await supabase
  .from('admin_credentials')
  .select(`
    *,
    admin_roles:role_id (
      id,
      name,
      permissions
    )
  `)
  .eq('id', adminId)
  .single();

const permissions = data.admin_roles?.permissions || [];
```

