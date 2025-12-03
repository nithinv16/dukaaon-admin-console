# Quick Start: Deploy Lambda Function

## Current Error
```
ResourceNotFoundException: Function not found: fetch-product-image
```

This means the Lambda function hasn't been deployed yet. Follow these steps:

## Step 1: Prepare Lambda Function

1. **Navigate to Lambda directory:**
   ```bash
   cd lambda/fetch-product-image
   ```

2. **Create deployment package:**
   ```powershell
   # On Windows (PowerShell) - Run this in the lambda/fetch-product-image directory
   Compress-Archive -Path index.js -DestinationPath function.zip -Force
   
   # On Mac/Linux
   zip function.zip index.js
   ```
   
   **Note:** The `-Force` flag will overwrite if the file already exists.

## Step 2: Deploy to AWS Lambda

### Option A: Using AWS Console (Easiest)

1. **Go to AWS Lambda Console:**
   - https://console.aws.amazon.com/lambda/
   - Make sure you're in the correct region (us-east-1 or your preferred region)

2. **Create Function:**
   - Click "Create function"
   - Choose "Author from scratch"
   - Function name: `fetch-product-image`
   - Runtime: **Node.js 18.x** or **Node.js 20.x**
   - Architecture: x86_64
   - Click "Create function"

3. **Upload Code:**
   - Scroll down to "Code source"
   - Click "Upload from" → ".zip file"
   - Select your `function.zip` file
   - Click "Save"

4. **Configure Settings:**
   - Go to "Configuration" → "General configuration"
   - Click "Edit"
   - Timeout: Set to **30 seconds** (important!)
   - Memory: 256 MB (default is fine)
   - Click "Save"

5. **Set Execution Role:**
   - Go to "Configuration" → "Permissions"
   - The default execution role is fine (basic Lambda execution)
   - No additional permissions needed for web scraping

## Step 3: Test Lambda Function

1. **In Lambda Console:**
   - Go to "Test" tab
   - Create new test event:
     ```json
     {
       "body": "{\"productName\":\"Parle G Biscuits\",\"brand\":\"Parle\"}"
     }
     ```
   - Click "Test"
   - Check the response - should return image URL

## Step 4: Update Environment Variables

Make sure your `.env` file has:
```env
PRODUCT_IMAGE_LAMBDA_FUNCTION_NAME=fetch-product-image
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

**Important:** Replace `us-east-1` with your actual AWS region if different.

## Step 5: Verify in Your App

1. Restart your Next.js dev server
2. Try clicking the image placeholder in ProductEditorV2
3. Should now fetch images from Amazon/Flipkart/Meesho!

## Troubleshooting

### Error: "Function not found"
- ✅ Make sure function name matches exactly: `fetch-product-image`
- ✅ Check you're in the correct AWS region
- ✅ Verify AWS credentials are correct

### Error: "Timeout"
- ✅ Increase Lambda timeout to 30 seconds
- ✅ Check CloudWatch logs for errors

### Error: "Access denied"
- ✅ Verify AWS credentials have Lambda invoke permissions
- ✅ Check IAM role has basic Lambda execution permissions

### Images not found
- ✅ Check CloudWatch logs to see which sites were tried
- ✅ Some sites may block Lambda IPs (rare)
- ✅ Try different product names/brands

## Cost

- **Lambda:** Free tier: 1M requests/month free
- **Data Transfer:** Free tier: 100GB/month free
- **Total:** Essentially free for most use cases!

## Next Steps

Once deployed, the image fetcher will:
1. Search Amazon India first
2. Fallback to Flipkart
3. Fallback to Meesho
4. Return the first image found

No API keys needed - everything runs on AWS! 🚀

