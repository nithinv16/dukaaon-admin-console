# Debugging Guide - Admin Validation Error (Environment Variables Already Set)

## 🔍 Situation
You've confirmed that all environment variables are set in AWS Amplify, but you're still getting:
```
Admin credentials validation error: Error: Failed to validate admin credentials
```

## 🚀 Quick Diagnosis Steps

### Step 1: Push the Debug Code

```bash
git add .
git commit -m "Add debugging endpoints for Supabase connection"
git push origin main
```

Wait for AWS Amplify to deploy (5-10 minutes).

### Step 2: Run Comprehensive Diagnostic

Visit this URL in your browser:
```
https://your-amplify-app-url.amplifyapp.com/api/debug/supabase-connection
```

This will check:
- ✅ Environment variables are set
- ✅ Supabase client can be created
- ✅ Can connect to `admin_credentials` table
- ✅ RPC function `validate_admin_credentials` exists
- ✅ Actual admin credentials work

### Step 3: Check Simple Environment Test

Also visit:
```
https://your-amplify-app-url.amplifyapp.com/api/test-env
```

## 🔧 Common Issues & Solutions

### Issue 1: Environment Variables Set But Not Applied

**Symptom**: `/api/test-env` shows variables are NOT set

**Cause**: Variables were added but app wasn't redeployed

**Solution**:
1. Go to AWS Amplify Console
2. Find the latest deployment
3. Click **"Redeploy this version"**
4. Wait for completion
5. Test again

---

### Issue 2: RPC Function Doesn't Exist

**Symptom**: `/api/debug/supabase-connection` shows error code `42883`
```json
{
  "rpcFunction": {
    "success": false,
    "error": {
      "code": "42883",
      "message": "function public.validate_admin_credentials does not exist"
    }
  }
}
```

**Cause**: The database setup SQL hasn't been run

**Solution**: Run the SQL script in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in sidebar
4. Click **New Query**
5. Copy contents of `sql/create_admin_credentials_table.sql`
6. Paste and click **Run**
7. Verify success message
8. Test login again

---

### Issue 3: Admin Credentials Table Doesn't Exist

**Symptom**: `/api/debug/supabase-connection` shows table access error
```json
{
  "tableAccess": {
    "success": false,
    "error": {
      "code": "42P01",
      "message": "relation \"admin_credentials\" does not exist"
    }
  }
}
```

**Cause**: The `admin_credentials` table hasn't been created

**Solution**: Same as Issue 2 - run the SQL script

---

### Issue 4: Permission/RLS Issues

**Symptom**: `/api/debug/supabase-connection` shows permission denied
```json
{
  "tableAccess": {
    "success": false,
    "error": {
      "code": "42501",
      "message": "permission denied"
    }
  }
}
```

**Cause**: Row Level Security (RLS) policies not configured correctly

**Solution**:

1. Go to Supabase Dashboard → SQL Editor
2. Run this query to check RLS status:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'admin_credentials';
```

3. If RLS is causing issues, temporarily disable it for testing:
```sql
ALTER TABLE public.admin_credentials DISABLE ROW LEVEL SECURITY;
```

4. Test login again
5. If it works, re-enable RLS and fix policies:
```sql
-- Re-enable RLS
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- Recreate policies
DROP POLICY IF EXISTS "Service role can access admin credentials" ON public.admin_credentials;
CREATE POLICY "Service role can access admin credentials" 
ON public.admin_credentials
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

### Issue 5: Wrong Service Role Key

**Symptom**: `/api/test-env` shows service key is set, but connection fails

**Cause**: The service role key value is incorrect

**Solution**:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **Settings** → **API**
4. Find **service_role key** (under "Project API keys")
5. Copy the correct key
6. Go to AWS Amplify Console → Environment Variables
7. Update `SUPABASE_SERVICE_ROLE_KEY` with the correct value
8. Redeploy the application

---

### Issue 6: Admin Credentials Not Inserted

**Symptom**: RPC function works but returns "Invalid credentials" for correct password

**Cause**: The admin record isn't in the database

**Solution**: Insert/verify admin credentials

1. Go to Supabase Dashboard → SQL Editor
2. Check if admin exists:
```sql
SELECT * FROM public.admin_credentials WHERE email = 'admin@dukaaon.in';
```

3. If no results, insert admin:
```sql
INSERT INTO public.admin_credentials (email, password_hash, name, role, status)
VALUES (
    'admin@dukaaon.in',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'DukaaOn Admin',
    'admin',
    'active'
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();
```

4. Verify insertion:
```sql
SELECT email, name, role, status FROM public.admin_credentials WHERE email = 'admin@dukaaon.in';
```

---

### Issue 7: Network/Connection Issues

**Symptom**: All checks fail with timeout or connection errors

**Cause**: Can't reach Supabase from AWS Amplify

**Solution**:

1. Check Supabase project status at [Supabase Dashboard](https://supabase.com/dashboard)
2. Verify project isn't paused
3. Check if there are any Supabase outages
4. Verify the `NEXT_PUBLIC_SUPABASE_URL` is correct
5. Test connection from your local machine

---

## 📋 Systematic Debugging Checklist

Follow this order:

- [ ] **Step 1**: Push debug code and deploy
- [ ] **Step 2**: Visit `/api/debug/supabase-connection`
- [ ] **Step 3**: Visit `/api/test-env`
- [ ] **Step 4**: Check which checks are failing
- [ ] **Step 5**: Apply solution for failing check(s)
- [ ] **Step 6**: Redeploy if needed
- [ ] **Step 7**: Test login again
- [ ] **Step 8**: If working, delete debug endpoints

## 🔍 Understanding the Diagnostic Output

### Healthy Output Example:
```json
{
  "checks": {
    "envVars": {
      "SUPABASE_SERVICE_ROLE_KEY": { "set": true }
    },
    "clientCreation": { "success": true },
    "tableAccess": { "success": true },
    "rpcFunction": { "success": true },
    "actualCredentials": { 
      "success": true,
      "hasAdminData": true 
    }
  },
  "overall": {
    "status": "HEALTHY"
  }
}
```

### Problem Output Example:
```json
{
  "checks": {
    "rpcFunction": {
      "success": false,
      "error": {
        "code": "42883",
        "message": "function does not exist"
      },
      "diagnosis": "RPC function does not exist - run create_admin_credentials_table.sql"
    }
  },
  "overall": {
    "status": "ISSUES_FOUND"
  }
}
```

## 🛠️ Quick SQL Setup (If Database Not Set Up)

If the diagnostic shows database issues, run this complete setup:

```sql
-- 1. Create admin_credentials table
CREATE TABLE IF NOT EXISTS public.admin_credentials (
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

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_credentials_email ON public.admin_credentials(email);

-- 3. Enable RLS
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Service role can access admin credentials" 
ON public.admin_credentials FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 5. Insert admin user
INSERT INTO public.admin_credentials (email, password_hash, name, role, status)
VALUES (
    'admin@dukaaon.in',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'DukaaOn Admin',
    'admin',
    'active'
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

-- 6. Create validation function
CREATE OR REPLACE FUNCTION public.validate_admin_credentials(
    input_email TEXT,
    input_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_record RECORD;
BEGIN
    SELECT id, email, name, role
    INTO admin_record
    FROM public.admin_credentials
    WHERE email = input_email AND status = 'active';
    
    IF admin_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid credentials');
    END IF;
    
    IF input_password = 'dukaaon#28' THEN
        UPDATE public.admin_credentials
        SET last_login = NOW(), updated_at = NOW()
        WHERE id = admin_record.id;
        
        RETURN jsonb_build_object(
            'success', true,
            'admin', jsonb_build_object(
                'id', admin_record.id,
                'email', admin_record.email,
                'name', admin_record.name,
                'role', admin_record.role
            )
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid credentials');
    END IF;
END;
$$;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION public.validate_admin_credentials TO anon, authenticated, service_role;
```

## 🧪 Test Locally (Optional)

If you want to test locally before deploying:

1. Create `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xcpznnkpjgyrpbvpnvit.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

2. Run dev server:
```bash
npm run dev
```

3. Visit `http://localhost:3001/api/debug/supabase-connection`

## 🗑️ Cleanup After Debugging

Once everything works, delete the debug endpoints for security:

```bash
rm app/api/debug/supabase-connection/route.ts
rm app/api/test-env/route.ts
git add .
git commit -m "Remove debug endpoints after successful fix"
git push
```

## 📞 Still Stuck?

If none of the above solutions work:

1. **Check CloudWatch Logs**:
   - AWS Amplify Console → Monitoring → Logging
   - Look for specific error messages

2. **Check Supabase Logs**:
   - Supabase Dashboard → Logs
   - Look for failed RPC calls or connection attempts

3. **Verify Amplify Build Logs**:
   - AWS Amplify Console → Latest build
   - Check for any warnings about environment variables

4. **Share the diagnostic output**:
   - Copy the full JSON from `/api/debug/supabase-connection`
   - This will help identify the exact issue

---

**Remember**: After fixing the issue, always clean up debug endpoints!

