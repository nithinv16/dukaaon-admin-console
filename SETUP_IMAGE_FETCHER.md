# Product Image Fetcher Setup Guide

## Overview
This guide will help you set up automatic product image fetching using AWS Lambda + Google/Bing Image Search APIs.

## Prerequisites
1. AWS Account with Lambda access
2. Google Cloud Account (for Custom Search API)
3. Azure Account (for Bing Image Search API - optional but recommended)

## Step 1: Get API Keys

### Google Custom Search API
1. Go to: https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Enable "Custom Search API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Restrict the API key to "Custom Search API" (recommended)
6. Create Custom Search Engine: https://programmablesearchengine.google.com/controlpanel/create
   - Click "Add" → "Search the entire web"
   - Get your Search Engine ID (CX) from the control panel

### Bing Image Search API (Optional but recommended)
1. Go to: https://portal.azure.com/
2. Click "Create a resource"
3. Search for "Bing Search v7"
4. Create the resource
5. Get your API key from "Keys and Endpoint" section

## Step 2: Deploy Lambda Function

### Option A: Using AWS Console
1. Go to AWS Lambda Console: https://console.aws.amazon.com/lambda/
2. Click "Create function"
3. Choose "Author from scratch"
4. Settings:
   - Function name: `fetch-product-image`
   - Runtime: Node.js 18.x or 20.x
   - Architecture: x86_64
5. Click "Create function"
6. In the code editor, replace the code with contents from `lambda/fetch-product-image/index.js`
7. Click "Deploy"

### Option B: Using AWS CLI
```bash
cd lambda/fetch-product-image
zip -r function.zip index.js package.json
aws lambda create-function \
  --function-name fetch-product-image \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30
```

## Step 3: Configure Lambda Environment Variables

In AWS Lambda Console:
1. Go to your function → Configuration → Environment variables
2. Add:
   - `GOOGLE_CUSTOM_SEARCH_API_KEY` = Your Google API key
   - `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` = Your Search Engine ID (CX)
   - `BING_IMAGE_SEARCH_API_KEY` = Your Bing API key (optional)

## Step 4: Update Environment Variables

Add to your `.env` file:
```env
# AWS Lambda Configuration
PRODUCT_IMAGE_LAMBDA_FUNCTION_NAME=fetch-product-image
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

## Step 5: Install AWS SDK (if needed)

If you don't have `@aws-sdk/client-lambda` installed:
```bash
npm install @aws-sdk/client-lambda
```

Or the function will automatically fallback to AWS SDK v2 (which is already installed).

## Step 6: Test the Setup

1. Start your development server
2. Open ProductEditorV2
3. Click on the image placeholder (or "Fetch" button)
4. You should see a loading indicator
5. Image should appear if found

## Troubleshooting

### Lambda function not found
- Check `PRODUCT_IMAGE_LAMBDA_FUNCTION_NAME` in `.env`
- Verify function exists in AWS Lambda Console
- Check AWS region matches

### API key errors
- Verify Google API key is correct
- Check Custom Search Engine ID (CX) is correct
- Ensure APIs are enabled in Google Cloud Console

### No images found
- Check CloudWatch logs for Lambda function
- Verify API keys are set in Lambda environment variables
- Test API keys directly using curl or Postman

### Timeout errors
- Increase Lambda timeout to 30 seconds
- Check network connectivity from Lambda

## Cost Estimation

- **AWS Lambda:** Free tier (1M requests/month)
- **Google Custom Search:** 100 free queries/day, then $5 per 1,000 queries
- **Bing Image Search:** 3,000 free queries/month, then $4 per 1,000 queries

For 1,000 products/month:
- Lambda: Free
- Google: ~$5 (if over free tier)
- Bing: Free (within free tier)
- **Total: ~$5/month**

## Alternative: Direct API Calls (No Lambda)

If you prefer not to use Lambda, you can modify the API route to call Google/Bing APIs directly from Next.js. This is simpler but less scalable.

