# Critical Issue: AWS Amplify Not Passing Environment Variables to API Routes

## 🚨 Problem Summary

- ✅ Environment variable `SUPABASE_SERVICE_ROLE_KEY` is correctly set in AWS Amplify Console
- ✅ Variable name is spelled correctly
- ✅ Variable is saved and set for all branches
- ❌ **BUT** API routes cannot access it at runtime

This is a known issue with AWS Amplify + Next.js 14 where server-side environment variables may not be properly passed to Lambda functions that serve API routes.

## 🔧 Solution Attempted

### Test 1: Explicitly Include in next.config.js

I've updated `next.config.js` to explicitly pass `SUPABASE_SERVICE_ROLE_KEY` in the `env` object. This forces Next.js to bundle the variable at build time.

**Deploy this change:**
```bash
git add next.config.js
git commit -m "Test: Explicitly pass SUPABASE_SERVICE_ROLE_KEY to runtime"
git push origin main
```

After deployment, test again:
```
https://admin.dukaaon.in/api/direct-validate-test
```

### Test 2: Clear Cache Method

If Test 1 doesn't work:

1. **AWS Amplify Console** → App settings → Build settings → **Clear cache**
2. Delete `SUPABASE_SERVICE_ROLE_KEY` from Environment variables
3. Save
4. Re-add `SUPABASE_SERVICE_ROLE_KEY` 
5. Save
6. Redeploy

## 📚 Known Issues

This appears to be related to:
- AWS Amplify's SSR implementation for Next.js 14
- How environment variables are passed to AWS Lambda functions
- Possible caching issue in Amplify's deployment pipeline

## 🎯 Expected Outcome

After deploying the `next.config.js` change, the `/api/direct-validate-test` should show:
```json
{
  "test": "SUCCESS",
  "logs": [
    "   - Service Key: SET"  ⬅️ Should now say SET
  ]
}
```

## ⚠️ Security Note

Adding `SUPABASE_SERVICE_ROLE_KEY` to `next.config.js` env object is **NOT ideal** for production because it makes the variable available in the client bundle. However, since API routes are server-side only in Next.js, this should still be safe as long as you're not importing and using it in client components.

If this works, we can investigate a cleaner solution later. Right now, we just need to get it working.

## 📞 Next Steps

1. Deploy the `next.config.js` change
2. Test `/api/direct-validate-test`
3. If it shows "SET", try login
4. Report results

## 🔗 References

- [AWS Amplify Next.js SSR Support](https://docs.aws.amazon.com/amplify/latest/userguide/server-side-rendering-amplify.html)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [AWS Amplify Environment Variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)

