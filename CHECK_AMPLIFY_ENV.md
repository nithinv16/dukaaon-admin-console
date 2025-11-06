# URGENT: Check AWS Amplify Environment Variable Configuration

## 🚨 The Problem

Your `/api/direct-validate-test` shows:
```json
{
  "error": "Environment variables not set",
  "logs": [
    "   - URL: SET",
    "   - Service Key: MISSING"  ⬅️ THIS IS THE PROBLEM
  ]
}
```

The `SUPABASE_SERVICE_ROLE_KEY` is **NOT** reaching the Lambda functions that serve your API routes.

## ✅ **IMMEDIATE ACTION REQUIRED**

### Step 1: Verify Variable Name in AWS Amplify Console

1. Go to **AWS Amplify Console**
2. Select your app: **admin-console**
3. Click **App Settings** → **Environment variables**
4. **CHECK THE EXACT NAME**: It MUST be exactly:
   ```
   SUPABASE_SERVICE_ROLE_KEY
   ```
   (No spaces, no typos, case-sensitive!)

### Step 2: Common Issues

#### Issue A: Variable Name Typo
- ❌ `SUPABASE_SERVICE_ROLE_KEY ` (extra space)
- ❌ `SUPABASE_SERVICE_ROLE_KEY_` (underscore at end)
- ❌ `SUPABASE_SERVICE_ROLE KEY` (missing underscore)
- ❌ `supabase_service_role_key` (lowercase)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (CORRECT)

#### Issue B: Variable Not Saved
After adding the variable, did you click "Save"? Without clicking save, it won't be applied.

#### Issue C: Variable Set for Wrong Branch
Check if the variable is set for:
- "All branches" or
- The specific branch you're deploying (usually `main`)

### Step 3: Fix It

1. **Delete the existing variable** (if it exists with wrong name)
2. **Add it again** with EXACT name: `SUPABASE_SERVICE_ROLE_KEY`
3. **Paste the value** from Supabase Dashboard → Settings → API → `service_role` key
4. **Click "Save"** (very important!)
5. **Redeploy**: Go to latest deployment and click "Redeploy this version"

### Step 4: Verify It Works

After redeployment (5-10 min), check the build logs:

Look for these lines in the build output:
```
Environment variables status:
NEXT_PUBLIC_SUPABASE_URL is set: YES
NEXT_PUBLIC_SUPABASE_ANON_KEY is set: YES
SUPABASE_SERVICE_ROLE_KEY is set: YES   ⬅️ Should say YES
```

If it still says "NO", the variable is not set correctly in Amplify Console.

## 📸 **Visual Guide**

In AWS Amplify Console, it should look like this:

```
Variable                          Value                              Branch
────────────────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL          https://xcpznn...supabase.co      All branches
NEXT_PUBLIC_SUPABASE_ANON_KEY     eyJhbGciOiJIUzI1NiIs...           All branches
SUPABASE_SERVICE_ROLE_KEY         eyJhbGciOiJIUzI1NiIs...           All branches  ⬅️ THIS MUST BE HERE
```

## 🔍 **Double Check in Supabase**

Get the correct value:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (`xcpznnkpjgyrpbvpnvit`)
3. Click **Settings** (gear icon) → **API**
4. Scroll down to **Project API keys**
5. Find **`service_role` secret** (NOT the anon key!)
6. Click the eye icon to reveal it
7. Click copy icon
8. Paste this EXACT value into AWS Amplify

The service_role key should:
- Start with `eyJ`
- Be very long (200+ characters)
- Be different from the anon key

## ⚠️ **Critical Notes**

1. **DO NOT** add `NEXT_PUBLIC_` prefix to `SUPABASE_SERVICE_ROLE_KEY`
   - With prefix = Exposed to browser (SECURITY RISK!)
   - Without prefix = Server-side only (CORRECT)

2. **DO** make sure there are no extra spaces before/after the value

3. **DO** click "Save" after adding the variable

4. **DO** redeploy after saving

## 🧪 **After Fixing, Test These**

### Test 1: Check Environment Variables
```
https://admin.dukaaon.in/api/test-env
```
Should show all 3 variables as `"configured": true`

### Test 2: Check Direct Validation
```
https://admin.dukaaon.in/api/direct-validate-test
```
Should show:
```json
{
  "test": "SUCCESS",
  "logs": [
    "2. Env vars check:",
    "   - URL: SET",
    "   - Service Key: SET"  ⬅️ Should say SET now
  ]
}
```

### Test 3: Try Login
```
https://admin.dukaaon.in/login
```
Email: admin@dukaaon.in
Password: dukaaon#28

Should work! 🎉

---

## 📞 **If Still Not Working**

Take a screenshot of:
1. AWS Amplify Console → Environment variables page
2. The build logs showing environment variable status
3. The error from `/api/direct-validate-test`

This will help debug further.

---

**The variable name MUST be exactly: `SUPABASE_SERVICE_ROLE_KEY`**
**No typos, no extra spaces, case-sensitive!**

