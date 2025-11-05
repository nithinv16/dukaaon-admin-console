# AWS Amplify Deployment Fix - Admin Credentials Validation Error

## Problem
Getting error: `Admin credentials validation error: Error: Failed to validate admin credentials`

This occurs because the `SUPABASE_SERVICE_ROLE_KEY` environment variable is not properly configured in AWS Amplify.

## Root Cause
The admin credential validation requires a server-side Supabase client that uses the service role key. This key must be accessible to server-side API routes in your Next.js application.

## Solution

### Step 1: Verify Environment Variables in AWS Amplify

1. Go to **AWS Amplify Console**
2. Select your app: **admin-console**
3. Navigate to **App Settings** → **Environment variables**
4. Ensure ALL of the following variables are set:

```
NEXT_PUBLIC_SUPABASE_URL=https://xcpznnkpjgyrpbvpnvit.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MTc3MjgsImV4cCI6MjA1NDE5MzcyOH0.1Gg97eXqRmNcZpmKYaBNDozfc_mXrgFv_uHj-br-u_k
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxNzcyOCwiZXhwIjoyMDU0MTkzNzI4fQ.K7dIETwKeQX9XooR4mR6ZSSSag8Ef7Mbs2UCsJxKMVA
```

**CRITICAL**: The `SUPABASE_SERVICE_ROLE_KEY` should **NOT** have `NEXT_PUBLIC_` prefix because it's server-side only.

### Step 2: Update amplify.yml (if needed)

The current `amplify.yml` should already be correct. Verify it looks like this:

```yaml
version: 1
applications:
  - appRoot: .
    frontend:
      phases:
        preBuild:
          commands:
            - nvm install 20
            - nvm use 20
            - node --version
            - npm --version
            - pwd
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
```

### Step 3: Redeploy Your Application

After setting the environment variables:

1. In AWS Amplify Console, go to your app
2. Click **Redeploy this version** on the latest deployment
   OR
3. Push a small change to your GitHub repository to trigger a new deployment

### Step 4: Verify the Fix

1. Wait for the deployment to complete
2. Open your admin console URL
3. Try logging in with:
   - Email: `admin@dukaaon.in`
   - Password: `dukaaon#28`

## How to Add/Update Environment Variables in AWS Amplify

### Method 1: Using AWS Amplify Console (Recommended)

1. Open [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click on your app name
3. In the left sidebar, click **App Settings** → **Environment variables**
4. Click **Manage variables**
5. For each variable:
   - Click **Add variable**
   - Enter **Variable name**: e.g., `SUPABASE_SERVICE_ROLE_KEY`
   - Enter **Value**: (paste the key)
   - Leave **Branch** as `All branches` or select specific branch
6. Click **Save**

### Method 2: Using AWS CLI

```bash
aws amplify update-app \
  --app-id YOUR_APP_ID \
  --environment-variables \
    NEXT_PUBLIC_SUPABASE_URL=https://xcpznnkpjgyrpbvpnvit.supabase.co,\
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...,\
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Troubleshooting

### Issue: Still getting the error after setting environment variables

**Solution**: Environment variables are only loaded during the build process. You MUST redeploy after adding/updating environment variables.

### Issue: "Admin Supabase client not configured" error in logs

**Solution**: The `SUPABASE_SERVICE_ROLE_KEY` is missing or misspelled in Amplify environment variables.

### Issue: Environment variables not accessible in server-side code

**Solution**: 
- Variables with `NEXT_PUBLIC_` prefix are accessible both client and server-side
- Variables WITHOUT `NEXT_PUBLIC_` prefix are ONLY accessible server-side
- Make sure `SUPABASE_SERVICE_ROLE_KEY` does NOT have the `NEXT_PUBLIC_` prefix

### How to Check if Environment Variables are Set

Add this temporary API route to check environment variables:

**File: `app/api/test-env/route.ts`** (Create this file temporarily)

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
  });
}
```

Then visit: `https://your-app.amplifyapp.com/api/test-env`

**IMPORTANT**: Delete this route after testing for security reasons.

## Security Notes

⚠️ **WARNING**: Never commit `.env` files to Git. The service role key has full database access.

- ✅ `NEXT_PUBLIC_*` variables are safe to expose (they're in the client bundle)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` should NEVER be exposed to the client
- ✅ Set all secrets in AWS Amplify Console environment variables
- ✅ Use `.env.example` (without real values) to document required variables

## Verification Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set in Amplify
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set in Amplify
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in Amplify (NO `NEXT_PUBLIC_` prefix!)
- [ ] Redeployed the application after setting variables
- [ ] Checked CloudWatch logs for any errors
- [ ] Tested login with admin credentials

## Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [AWS Amplify Environment Variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Supabase Service Role Key](https://supabase.com/docs/guides/api/api-keys)

## Need More Help?

If the issue persists:
1. Check AWS Amplify build logs for environment variable warnings
2. Check CloudWatch logs for detailed error messages
3. Ensure Supabase database has the `validate_admin_credentials` RPC function

