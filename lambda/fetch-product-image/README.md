# Product Image Fetcher Lambda Function

AWS Lambda function that fetches product images by scraping e-commerce websites (Amazon India, Flipkart, Meesho).

## Setup Instructions

### 1. Deploy Lambda Function

1. **Zip the function:**
   ```powershell
   # On Windows (PowerShell)
   cd lambda/fetch-product-image
   Compress-Archive -Path index.js -DestinationPath function.zip -Force
   
   # On Mac/Linux
   cd lambda/fetch-product-image
   zip function.zip index.js
   ```
   
   **Note:** 
   - No `npm install` needed! The function only uses Node.js built-in modules.
   - AWS SDK is NOT required (and not available in Node.js 18.x/20.x runtimes).

2. **Create Lambda function in AWS Console:**
   - Go to AWS Lambda Console
   - Click "Create function"
   - Choose "Author from scratch"
   - Function name: `fetch-product-image`
   - Runtime: Node.js 18.x or 20.x
   - Architecture: x86_64
   - Upload the `function.zip` file

3. **Set Execution Role:**
   - Create/assign IAM role with basic Lambda execution permissions
   - No additional permissions needed (function only makes outbound HTTPS calls)
   - Optional: If you want to cache images in S3, add S3 permissions

4. **Configure Timeout:**
   - Set timeout to 30 seconds (web scraping may take time)

5. **Optional: S3 Caching (if you want to cache images):**
   - Set environment variable: `S3_BUCKET_NAME=your-bucket-name`
   - Set environment variable: `AWS_REGION=us-east-1`
   - Add S3 read/write permissions to Lambda execution role

### 2. Update Environment Variables

Add to your `.env` file:
```env
PRODUCT_IMAGE_LAMBDA_FUNCTION_NAME=fetch-product-image
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### 3. Dependencies

**No dependencies needed!** The function only uses Node.js built-in modules:
- `https` - for making HTTPS requests
- `http` - for making HTTP requests

AWS SDK is **not** required and is **not** included in Node.js 18.x/20.x runtimes.

## Function Behavior

1. **Primary:** Searches Amazon India for product images
2. **Fallback 1:** If Amazon fails, tries Flipkart
3. **Fallback 2:** If Flipkart fails, tries Meesho
4. **Returns:** First valid product image URL found

## How It Works

- Scrapes product search pages from e-commerce websites
- Extracts product images from HTML using regex patterns
- Returns direct image URLs (no API keys required)
- Works entirely within AWS ecosystem

## Testing

Test the Lambda function directly:
```bash
aws lambda invoke \
  --function-name fetch-product-image \
  --payload '{"body":"{\"productName\":\"Parle G Biscuits\",\"brand\":\"Parle\"}"}' \
  response.json

cat response.json
```

Or test from your Next.js app - just click the image placeholder in ProductEditorV2!

## Cost Estimation

- **Lambda:** Free tier (1M requests/month free), then $0.20 per 1M requests
- **Data Transfer:** Free tier (100GB/month free)
- **No API costs:** Uses web scraping, no third-party API fees

## Error Handling

- Returns 404 if no image found on any platform
- Returns 500 on scraping errors
- Logs all errors to CloudWatch
- Gracefully handles website structure changes

## Notes

- Web scraping may break if e-commerce sites change their HTML structure
- Some sites may block Lambda IPs (rare, but possible)
- Images are returned as direct URLs (not cached unless S3 is configured)
- Function respects robots.txt and uses reasonable request rates

