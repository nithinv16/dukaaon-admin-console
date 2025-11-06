# Fix for "Works Locally But Not on AWS Amplify"

## 🎯 Problem
- ✅ Admin login works perfectly on local development
- ❌ Admin login fails on AWS Amplify deployment
- ✅ All environment variables are set correctly
- ✅ Database and RPC functions are set up correctly

## 🔍 Root Cause

**AWS Amplify deployment issue with Next.js API routes**

When Next.js apps are deployed to AWS Amplify, API routes need specific configuration to work properly. The issue was:

1. Missing `output: 'standalone'` in `next.config.js`
2. Incorrect artifact configuration in `amplify.yml`
3. Environment variables set in `amplify.yml` conflicting with Amplify console settings

## ✅ Solution Applied

### 1. Updated `next.config.js`

**Added:**
```javascript
output: 'standalone',
```

This tells Next.js to create a standalone build optimized for serverless/edge deployments like AWS Amplify.

**Removed:**
```javascript
async rewrites() { ... }  // Not needed, was causing routing issues
```

### 2. Updated `amplify.yml`

**Removed:**
```yaml
env:
  variables:
    NEXT_PRIVATE_STANDALONE: 'false'  # This was preventing proper API deployment
    NODE_ENV: 'production'
    _LIVE_UPDATES: ...
```

These environment variables should ONLY be set in the AWS Amplify Console, not in `amplify.yml`.

## 🚀 Deployment Steps

### Step 1: Commit and Push Changes

```bash
git add next.config.js amplify.yml
git commit -m "Fix: Configure Next.js for AWS Amplify API routes"
git push origin main
```

### Step 2: Wait for Deployment

- AWS Amplify will auto-deploy (5-10 minutes)
- Watch the build logs in AWS Amplify Console
- Look for "Build succeed" message

### Step 3: Test Login

1. Clear browser cache (Ctrl/Cmd + Shift + R)
2. Go to https://admin.dukaaon.in/login
3. Enter credentials:
   - Email: `admin@dukaaon.in`
   - Password: `dukaaon#28`
4. Click "Sign In"

Should work now! 🎉

## 🔍 Verification

After deployment, verify:

### Check 1: API Routes Work
Visit: https://admin.dukaaon.in/api/test-env

Should return:
```json
{
  "status": "OK",
  "variables": {
    "SUPABASE_SERVICE_ROLE_KEY": { "configured": true }
  }
}
```

### Check 2: Login Works
Try logging in with admin credentials - should succeed without errors.

### Check 3: CloudWatch Logs
Check AWS Amplify Console → Monitoring → Logging for:
- `✅ Admin credentials validated successfully for: admin@dukaaon.in`

## 🛠️ If Still Not Working

### Try 1: Clear Amplify Cache

Sometimes Amplify's cache causes issues:

1. Go to AWS Amplify Console
2. Click your app
3. Go to "App settings" → "Build settings"
4. Click "Clear cache"
5. Then click "Redeploy this version"

### Try 2: Check Build Logs

1. AWS Amplify Console → Latest build
2. Click "Build logs"
3. Look for errors in the "Build" phase
4. Common issues:
   - TypeScript errors
   - Missing dependencies
   - Build failures

### Try 3: Verify Environment Variables Again

1. AWS Amplify Console → Environment variables
2. Verify all three are set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Make sure there are no extra spaces or quotes

### Try 4: Hard Refresh Browser

Sometimes the browser caches the old JavaScript:
- Chrome/Edge: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Firefox: `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)
- Safari: `Cmd + Option + R`

## 📊 Understanding Next.js on AWS Amplify

### How Next.js Deploys

1. **Local Development**: Runs as a Node.js server
2. **AWS Amplify**: Runs as serverless functions (AWS Lambda)

### Why Configuration Matters

- **`output: 'standalone'`**: Creates optimized bundle for Lambda
- **API Routes**: Each route becomes a separate Lambda function
- **Environment Variables**: Must be available at build time AND runtime

### Common Pitfalls

❌ Setting env vars in `amplify.yml` instead of Console
❌ Missing `output: 'standalone'`
❌ Not clearing cache after major config changes
❌ Browser caching old JavaScript

✅ Set env vars in AWS Amplify Console
✅ Use `output: 'standalone'` for Amplify
✅ Clear cache after config changes
✅ Hard refresh browser after deployment

## 📚 Additional Resources

- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [AWS Amplify Next.js Deployment](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-app.html)
- [AWS Amplify Environment Variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)

## 🧹 Cleanup After Fix

Once everything works, remove debug endpoints:

```bash
rm app/api/test-env/route.ts
rm app/api/test-login/route.ts
rm app/api/debug/supabase-connection/route.ts
rm app/test-login-page/page.tsx

git add .
git commit -m "Remove debug endpoints after successful deployment"
git push
```

## ✅ Success Checklist

- [ ] Updated `next.config.js` with `output: 'standalone'`
- [ ] Updated `amplify.yml` (removed conflicting env vars)
- [ ] Committed and pushed changes
- [ ] Waited for AWS Amplify deployment
- [ ] Cleared browser cache
- [ ] Successfully logged in at https://admin.dukaaon.in
- [ ] Verified API routes work
- [ ] Removed debug endpoints
- [ ] Celebrated! 🎉

---

**Expected Result**: Admin login should work perfectly on the deployed site, just like it does locally!

