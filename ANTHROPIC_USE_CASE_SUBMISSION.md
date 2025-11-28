# How to Submit Use Case Details for Anthropic Claude Models in AWS Bedrock

## Overview

AWS Bedrock now automatically enables serverless foundation models when first invoked, but **Anthropic models (like Claude 3.7 Sonnet) still require use case details to be submitted** for first-time users. This is a one-time submission per AWS account.

Reference: [AWS Bedrock Model Access Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)

## Method 1: Using AWS Bedrock Console (Recommended)

### Step-by-Step Instructions

1. **Access the AWS Bedrock Console**
   - Sign in to your AWS account
   - Navigate to: https://console.aws.amazon.com/bedrock/

2. **Navigate to Model Access**
   - In the left-hand navigation pane, select **"Model access"** or **"Foundation models"**
   - Alternatively, go to **"Model catalog"** in the left sidebar

3. **Select Anthropic Models**
   - Look for **"Anthropic"** in the provider list
   - Find **"Claude 3.7 Sonnet"** (or **"Claude 3.5 Sonnet"**)
   - Click on the model name

4. **Submit Use Case Details**
   - You should see a button or link: **"Submit use case details"** or **"Request model access"**
   - Click on it to open the form

5. **Fill Out the Use Case Form**
   - **Use Case Description**: Describe how you'll use the model
   
   **Recommended Description:**
   ```
   Receipt extraction and product data processing for inventory management system. 
   Extracting product names, quantities, units, and prices from scanned receipts 
   using OCR (AWS Textract) and AI (Claude) to automatically populate seller 
   inventory databases. Processing includes cleaning product names, calculating 
   unit prices, and categorizing products for e-commerce inventory management.
   ```
   
   - **Use Case Category**: Select "Business Operations" or "Data Processing"
   - Fill in any other required fields
   - Click **"Submit form"**

6. **Wait for Approval**
   - Access is typically granted **immediately** after submission
   - In some cases, it may take up to 15 minutes
   - You can verify the status in the **"Model access"** section

### Alternative: Through Model Catalog

If the above doesn't work, try this approach:

1. Go to **"Model catalog"** in AWS Bedrock Console
2. Filter by provider: **"Anthropic"**
3. Click on **"Claude 3.7 Sonnet"** (or **"Claude 3.5 Sonnet"**)
4. In the model details page, look for:
   - **"Request model access"** button, OR
   - **"Enable model"** option, OR
   - **"Submit use case"** link
5. Complete the form as described above

## Method 2: Using AWS CLI (For Advanced Users)

If you prefer using the command line:

1. **Retrieve the Use Case Form Data**
   ```bash
   aws bedrock get-use-case-for-model-access \
     --region us-east-1 \
     --model-access-arn "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0"
   ```

2. **Submit the Use Case Form**
   ```bash
   aws bedrock put-use-case-for-model-access \
     --region us-east-1 \
     --model-access-arn "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0" \
     --form-data "<Base64-encoded-form-data>"
   ```

   Replace `<Base64-encoded-form-data>` with your completed form data.

Reference: [AWS Bedrock API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_PutUseCaseForModelAccess.html)

## Important Notes

### ✅ One-Time Submission
- **The use case form needs to be submitted only once per AWS account**
- If your account is part of an AWS Organization, submitting at the organization's management account level grants access to all child accounts
- You won't need to resubmit for future Anthropic model access

### ✅ Immediate Access
- Access is typically granted **immediately** after submission
- Maximum wait time is usually **15 minutes**
- You can verify access status in the console

### ✅ Automatic Fallback
- Our system automatically falls back to **Claude 3 Haiku** (no approval needed) if Claude 3.7 Sonnet requires approval
- Receipt scanning will continue to work with Claude 3 Haiku
- Once approved, the system will automatically use Claude 3.7 Sonnet for better quality

### ✅ Region Considerations
- Ensure Anthropic models are available in your selected AWS Region
- **us-east-1** (US East - N. Virginia) typically has the best model availability
- Check model availability at: https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html

## Verify Model Access

After submission, verify your access:

1. Go to **AWS Bedrock Console** → **Model access**
2. Look for **"Anthropic"** provider
3. Check that **"Claude 3.7 Sonnet"** shows as **"Access granted"** or **"Enabled"**

## Troubleshooting

### Can't Find "Submit Use Case Details" Button?
- Make sure you're signed in to the AWS account that will use the models
- Try accessing from: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess
- Check if you have proper IAM permissions for Bedrock

### Still Getting Approval Error?
1. Wait 15 minutes after submission
2. Clear your browser cache
3. Try invoking the model again
4. Check AWS CloudWatch logs for detailed error messages

### Need Help?
- AWS Bedrock Documentation: https://docs.aws.amazon.com/bedrock/
- AWS Support: https://console.aws.amazon.com/support/

## Next Steps

After submitting use case details:

1. ✅ Wait 15 minutes
2. ✅ Try scanning a receipt again using **"Scan Receipts 2.0 ⚡"**
3. ✅ The system will automatically use Claude 3.7 Sonnet if approved, or fall back to Claude 3 Haiku

---

**Last Updated**: Based on AWS Bedrock documentation as of 2025
**Reference**: https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html

