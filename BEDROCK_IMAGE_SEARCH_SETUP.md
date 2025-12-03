# AWS Bedrock Image Search Setup

## ✅ What Changed

The image fetching system now uses **AWS Bedrock (Claude AI)** instead of Lambda web scraping.

## How It Works

1. **User clicks image placeholder** → API route is called
2. **Claude AI analyzes product** → Uses product name + brand
3. **Web search (optional)** → If Google Custom Search API is configured, Claude can search the web
4. **Returns image URL** → Claude extracts image URL from search results or knowledge

## Setup

### Required Environment Variables

Add to your `.env.local`:

```env
# AWS Credentials (Required)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-north-1  # or your region

# Optional: For better results with web search
WEB_SEARCH_API_KEY=your_google_custom_search_api_key
GOOGLE_CSE_ID=your_custom_search_engine_id
```

### AWS Bedrock Access

1. **Enable Claude models in Bedrock:**
   - Go to AWS Bedrock Console
   - Navigate to "Model access"
   - Request access to Claude models (if not already enabled)
   - Models needed: `anthropic.claude-3-haiku` or `anthropic.claude-sonnet-4-5`

2. **Verify IAM permissions:**
   - Your AWS credentials need `bedrock:InvokeModel` permission
   - This is usually included in standard AWS SDK access

## How It Works

### Without Web Search API (Basic Mode)
- Claude uses its training knowledge to suggest image URLs
- May not always find current/accurate URLs
- Still provides search queries as fallback

### With Web Search API (Enhanced Mode)
- Claude can search the web in real-time
- Finds actual product images from e-commerce sites
- More accurate and up-to-date results

## Benefits Over Lambda Scraping

✅ **No bot blocking** - Uses AI reasoning instead of scraping  
✅ **More reliable** - Doesn't depend on website HTML structure  
✅ **Better results** - Claude understands product context  
✅ **No Lambda deployment** - Everything runs in Next.js API route  
✅ **Cost-effective** - Pay per request, no Lambda cold starts  

## Cost

- **AWS Bedrock (Claude Haiku):** ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
- **Average request:** ~500 input tokens + ~200 output tokens = ~$0.0002 per image search
- **Very affordable** for most use cases!

## Testing

1. Make sure AWS credentials are set in `.env.local`
2. Restart your dev server
3. Try clicking image placeholder in ProductEditorV2
4. Check console logs for Claude's response

## Troubleshooting

### Error: "AWS Bedrock client is not initialized"
- ✅ Check AWS credentials in `.env.local`
- ✅ Restart dev server after adding credentials
- ✅ Verify AWS region is correct

### Error: "Model access" or "ResourceNotFoundException"
- ✅ Enable Claude models in AWS Bedrock Console
- ✅ Request access if needed
- ✅ Check model ID matches your region

### No image found
- ✅ This is normal - Claude may not always find direct URLs
- ✅ Use manual upload as fallback
- ✅ Consider adding Google Custom Search API for better results

## Next Steps

The system is ready to use! Just make sure:
1. ✅ AWS credentials are configured
2. ✅ Claude models are enabled in Bedrock
3. ✅ Restart dev server
4. ✅ Test by clicking image placeholder

Manual upload will always work as a fallback! 🚀

