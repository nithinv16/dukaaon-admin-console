# Quick Fix Guide: Admin Credentials Validation Error

## 🚨 The Problem

You're getting this error when trying to log in:
```
Admin credentials validation error: Error: Failed to validate admin credentials
```

## ✅ The Solution (5 Minutes)

### Step 1: Add Missing Environment Variable in AWS Amplify

1. Open [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click on your app name
3. Click **App Settings** → **Environment variables** (left sidebar)
4. Click **Manage variables**
5. Click **Add variable**
6. Add this EXACT variable:

   **Variable name:**
   ```
   SUPABASE_SERVICE_ROLE_KEY
   ```

   **Value:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxNzcyOCwiZXhwIjoyMDU0MTkzNzI4fQ.K7dIETwKeQX9XooR4mR6ZSSSag8Ef7Mbs2UCsJxKMVA
   ```

7. Click **Save**

### Step 2: Redeploy Your App

1. In AWS Amplify Console, go to your app
2. You'll see your deployment history
3. Click **Redeploy this version** on the latest build

   OR simply push a small change to your GitHub repo:
   ```bash
   git commit --allow-empty -m "Trigger rebuild after env vars"
   git push
   ```

### Step 3: Wait for Deployment

- Wait 5-10 minutes for the build and deployment to complete
- Watch the build progress in the Amplify Console

### Step 4: Test the Login

1. Go to your admin console URL
2. Enter credentials:
   - Email: `admin@dukaaon.in`
   - Password: `dukaaon#28`
3. Click **Sign In**

## ✅ Success!

If you can log in successfully, you're done! 🎉

## 🔍 Still Not Working?

### Verify Environment Variables Are Set

Visit this URL in your browser:
```
https://[your-amplify-app-url].amplifyapp.com/api/test-env
```

You should see all three variables as `"configured": true`:
```json
{
  "status": "OK",
  "variables": {
    "NEXT_PUBLIC_SUPABASE_URL": { "configured": true },
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": { "configured": true },
    "SUPABASE_SERVICE_ROLE_KEY": { "configured": true }
  }
}
```

### Check Other Variables

While you're in AWS Amplify Console → Environment variables, make sure you also have:

```
NEXT_PUBLIC_SUPABASE_URL=https://xcpznnkpjgyrpbvpnvit.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHpubmtwamd5cnBidnBudml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MTc3MjgsImV4cCI6MjA1NDE5MzcyOH0.1Gg97eXqRmNcZpmKYaBNDozfc_mXrgFv_uHj-br-u_k
```

### Check Build Logs

1. In Amplify Console, click on the latest build
2. Look for any errors mentioning environment variables
3. Look for errors in the "Build" phase

### Check CloudWatch Logs

1. In Amplify Console, click **Monitoring** → **Logging**
2. Look for errors related to Supabase or validation

## 🔑 Common Mistakes to Avoid

❌ **WRONG**: Adding `NEXT_PUBLIC_` prefix to service key
```
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=...  ← DON'T DO THIS!
```

✅ **CORRECT**: No prefix for service key
```
SUPABASE_SERVICE_ROLE_KEY=...  ← DO THIS!
```

❌ **WRONG**: Forgetting to redeploy after adding variables

✅ **CORRECT**: Always redeploy after changing environment variables

## 📞 Need More Help?

See the comprehensive troubleshooting guide in `AMPLIFY_DEPLOYMENT_FIX.md`

