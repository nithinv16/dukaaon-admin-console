/**
 * Permission Utility Library
 * Handles role-based permission checking for admin operations
 */

import { getAdminSupabaseClient } from './supabase-admin';

export interface Permission {
    resource: string;
    actions: string[];
}

export interface RoleDetails {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
    is_system: boolean;
}

/**
 * Get admin role details including permissions
 */
export async function getAdminRole(adminId: string): Promise<RoleDetails | null> {
    const supabase = getAdminSupabaseClient();

    // Get admin credentials with role_id
    const { data: admin, error: adminError } = await supabase
        .from('admin_credentials')
        .select('role_id')
        .eq('id', adminId)
        .eq('status', 'active')
        .single();

    if (adminError || !admin?.role_id) {
        console.error('Error fetching admin role:', adminError);
        return null;
    }

    // Get role details
    const { data: role, error: roleError } = await supabase
        .from('admin_roles')
        .select('*')
        .eq('id', admin.role_id)
        .single();

    if (roleError || !role) {
        console.error('Error fetching role details:', roleError);
        return null;
    }

    return role as RoleDetails;
}

/**
 * Check if an admin has a specific permission
 * @param adminId - The admin user ID
 * @param resource - The resource to check (e.g., 'products', 'orders', 'users')
 * @param action - The action to check (e.g., 'view', 'create', 'update', 'delete')
 * @returns true if the admin has the permission, false otherwise
 */
export async function hasPermission(
    adminId: string,
    resource: string,
    action: string
): Promise<boolean> {
    try {
        const role = await getAdminRole(adminId);

        if (!role) {
            return false;
        }

        // Super Admin has all permissions
        if (role.name === 'Super Admin') {
            return true;
        }

        // Check if the role has the specific permission
        const resourcePermission = role.permissions.find(
            (p: Permission) => p.resource === resource
        );

        if (!resourcePermission) {
            return false;
        }

        return resourcePermission.actions.includes(action);
    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
}

/**
 * Require a specific permission or throw an error
 * @param adminId - The admin user ID
 * @param resource - The resource to check
 * @param action - The action to check
 * @throws Error if the admin doesn't have the permission
 */
export async function requirePermission(
    adminId: string,
    resource: string,
    action: string
): Promise<void> {
    const allowed = await hasPermission(adminId, resource, action);

    if (!allowed) {
        throw new Error(
            `Permission denied: You don't have permission to ${action} ${resource}`
        );
    }
}

/**
 * Check multiple permissions at once
 * @param adminId - The admin user ID
 * @param checks - Array of permission checks {resource, action}
 * @returns Object mapping each check to its result
 */
export async function checkPermissions(
    adminId: string,
    checks: Array<{ resource: string; action: string }>
): Promise<Record<string, boolean>> {
    const role = await getAdminRole(adminId);
    const results: Record<string, boolean> = {};

    if (!role) {
        // No permissions if role not found
        checks.forEach((check) => {
            results[`${check.resource}:${check.action}`] = false;
        });
        return results;
    }

    // Super Admin has all permissions
    if (role.name === 'Super Admin') {
        checks.forEach((check) => {
            results[`${check.resource}:${check.action}`] = true;
        });
        return results;
    }

    // Check each permission
    for (const check of checks) {
        const resourcePermission = role.permissions.find(
            (p: Permission) => p.resource === check.resource
        );

        results[`${check.resource}:${check.action}`] =
            resourcePermission?.actions.includes(check.action) || false;
    }

    return results;
}

/**
 * Get all permissions for an admin
 * @param adminId - The admin user ID
 * @returns Array of all permissions the admin has
 */
export async function getAdminPermissions(
    adminId: string
): Promise<Permission[]> {
    const role = await getAdminRole(adminId);
    return role?.permissions || [];
}

/**
 * Check if admin has any of the specified permissions (OR operation)
 * @param adminId - The admin user ID
 * @param checks - Array of permission checks
 * @returns true if admin has at least one of the permissions
 */
export async function hasAnyPermission(
    adminId: string,
    checks: Array<{ resource: string; action: string }>
): Promise<boolean> {
    for (const check of checks) {
        const allowed = await hasPermission(adminId, check.resource, check.action);
        if (allowed) {
            return true;
        }
    }
    return false;
}

/**
 * Check if admin has all of the specified permissions (AND operation)
 * @param adminId - The admin user ID
 * @param checks - Array of permission checks
 * @returns true if admin has all of the permissions
 */
export async function hasAllPermissions(
    adminId: string,
    checks: Array<{ resource: string; action: string }>
): Promise<boolean> {
    for (const check of checks) {
        const allowed = await hasPermission(adminId, check.resource, check.action);
        if (!allowed) {
            return false;
        }
    }
    return true;
}
