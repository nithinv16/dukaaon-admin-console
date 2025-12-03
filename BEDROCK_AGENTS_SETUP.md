# AWS Bedrock Agents Setup for Image Fetching

## ✅ What's Implemented

The system now uses **AWS Bedrock Agents** (via Claude with web browsing tools) to find product images.

## How AWS Bedrock Agents Work

### Current Implementation: Claude with Tools

We're using **Claude Sonnet 4.5 with web browsing tools** - this is an agentic approach where:
1. Claude receives a task (find product image)
2. Claude uses the `web_search` tool to browse the web
3. Claude extracts image URLs from search results
4. System downloads and validates images
5. Returns actual image data

### Alternative: Full Bedrock Agents (Advanced)

For more advanced agentic capabilities, you can create a **Bedrock Agent** in AWS Console:

1. **Go to AWS Bedrock Console**
   - https://console.aws.amazon.com/bedrock/
   - Navigate to "Agents"

2. **Create a new Agent**
   - Click "Create agent"
   - Name: `product-image-finder`
   - Model: Claude Sonnet 4.5
   - Add instructions: "Find product images by browsing e-commerce websites"

3. **Add Tools**
   - Add web browsing tool
   - Add custom tools for image extraction
   - Configure tool permissions

4. **Deploy Agent**
   - Save and deploy the agent
   - Get the agent ID and alias

5. **Use Agent Runtime API**
   - Invoke agent via `@aws-sdk/client-bedrock-agent-runtime`
   - Agent will autonomously browse and find images

## Current Setup (Claude with Tools)

### Required Environment Variables

```env
# AWS Credentials (Required)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-north-1

# Web Search (Required for web browsing)
WEB_SEARCH_API_KEY=your_google_custom_search_api_key
GOOGLE_CSE_ID=your_custom_search_engine_id
```

### How It Works

1. **User clicks image placeholder** → API route called
2. **Claude receives task** → "Find product image for [product]"
3. **Claude uses web_search tool** → Searches Google for product
4. **Claude extracts URLs** → Finds image URLs from search results
5. **System downloads images** → Validates each URL
6. **Returns image data** → Base64 encoded image

## Benefits of Agentic AI

✅ **Autonomous browsing** - Claude decides how to search  
✅ **Contextual understanding** - Understands product context  
✅ **Multiple attempts** - Tries different search strategies  
✅ **Real URLs** - Extracts from actual web pages  
✅ **Adaptive** - Adjusts approach based on results  

## Cost

- **AWS Bedrock (Claude Sonnet 4.5):** ~$0.003 per input token, ~$0.015 per output token
- **Average request:** ~500 input + ~200 output tokens = ~$0.002 per image search
- **Google Custom Search API:** 100 free queries/day, then $5 per 1,000 queries

## Testing

1. Make sure all environment variables are set
2. Restart dev server
3. Click image placeholder in ProductEditorV2
4. Check console logs:
   - `🤖 Using agentic AI (Claude) to browse web...`
   - `✅ Agentic AI found X image URL(s)`
   - `📥 Trying image 1/X...`
   - `✅ Successfully downloaded image`

## Troubleshooting

### "Web search not configured"
- ✅ Add `WEB_SEARCH_API_KEY` and `GOOGLE_CSE_ID` to `.env.local`
- ✅ Get Google Custom Search API key from Google Cloud Console
- ✅ Create Custom Search Engine at https://programmablesearchengine.google.com/

### "No images found"
- ✅ Check if web search is working
- ✅ Verify Google Custom Search API is enabled
- ✅ Check API quota (100 free queries/day)

### "All URLs failed validation"
- ✅ Some URLs might be blocked or expired
- ✅ System will return URL anyway with lower confidence
- ✅ Try manual upload as fallback

## Next Steps

The system is ready! Just:
1. ✅ Add Google Custom Search API keys
2. ✅ Restart dev server
3. ✅ Test by clicking image placeholder

The agentic AI will browse the web and find real product images! 🚀

