# AWS Amplify Environment Variables Setup

This file documents the required environment variables for the admin console deployment.

## ⚠️ CRITICAL: Required Environment Variables

**IMPORTANT**: All three environment variables below MUST be configured in AWS Amplify for the admin console to work properly.

### How to Add Environment Variables in AWS Amplify

1. Open [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app: **admin-console**
3. Click **App Settings** → **Environment variables** (in left sidebar)
4. Click **Manage variables**
5. Add each variable below by clicking **Add variable**
6. After adding all variables, click **Save**
7. **IMPORTANT**: Redeploy your application for changes to take effect!

### Environment Variables to Add

```bash
# 1. Supabase URL (Public - accessible on client and server)
NEXT_PUBLIC_SUPABASE_URL=https://xcpznnkpjgyrpbvpnvit.supabase.co

# 2. Supabase Anon Key (Public - accessible on client and server)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MTc3MjgsImV4cCI6MjA1NDE5MzcyOH0.1Gg97eXqRmNcZpmKYaBNDozfc_mXrgFv_uHj-br-u_k

# 3. Supabase Service Role Key (SECRET - server-side only, DO NOT prefix with NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxNzcyOCwiZXhwIjoyMDU0MTkzNzI4fQ.K7dIETwKeQX9XooR4mR6ZSSSag8Ef7Mbs2UCsJxKMVA
```

### 🔍 Verify Environment Variables

After deployment, visit this URL to verify all environment variables are set correctly:

```
https://[your-amplify-app-url].amplifyapp.com/api/test-env
```

You should see:
```json
{
  "status": "OK",
  "message": "All required environment variables are configured!"
}
```

**⚠️ IMPORTANT**: Delete the `app/api/test-env/route.ts` file after verification for security!

## 🔐 Admin Credentials

Use these credentials to log into the admin console:

- **Email**: admin@dukaaon.in
- **Password**: dukaaon#28

## 🚀 Deployment Checklist

- [ ] All 3 environment variables added in AWS Amplify Console
- [ ] Application redeployed after adding environment variables
- [ ] Verified variables using `/api/test-env` endpoint
- [ ] Deleted `app/api/test-env/route.ts` file for security
- [ ] Tested login with admin credentials
- [ ] Confirmed admin dashboard loads successfully

## 🛠️ Troubleshooting

### Issue: "Admin credentials validation error"

**Cause**: `SUPABASE_SERVICE_ROLE_KEY` is not set or misspelled

**Solution**:
1. Verify the variable name is exactly `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix!)
2. Check the value is correct (copy from Supabase Dashboard → Settings → API)
3. Redeploy the application

### Issue: Environment variables not taking effect

**Cause**: Variables are only loaded during build time

**Solution**: After changing environment variables, you MUST redeploy:
1. Go to your app in Amplify Console
2. Find the latest deployment
3. Click **Redeploy this version**

### Issue: Build fails after adding environment variables

**Cause**: Syntax error in environment variable value

**Solution**:
1. Ensure no extra spaces before/after the value
2. Don't include quotes around the value in Amplify Console
3. Double-check you didn't accidentally truncate the key

## 📚 Additional Resources

- [AWS Amplify Environment Variables Documentation](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys)

## 📝 Notes

- Variables with `NEXT_PUBLIC_` prefix are included in the browser bundle (safe to expose)
- Variables without `NEXT_PUBLIC_` are server-side only (keep secret!)
- The Service Role Key has FULL database access - NEVER expose it to the client
- Environment variables in Amplify are branch-specific (you can set different values per branch)

## ✅ Setup Complete

Environment variables configured on: [Date to be filled when you complete setup]
Last verified: [Date to be filled when you verify deployment]