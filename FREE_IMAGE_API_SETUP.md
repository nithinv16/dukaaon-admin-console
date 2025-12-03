# Free Image API Setup

## ✅ What Changed

The image fetching system now uses **free image APIs** instead of Google/Bing:
- **Unsplash API** - Free, no API key required for basic usage
- **Pexels API** - Free with generous free tier (optional, requires API key)

## How It Works

1. **User clicks image placeholder** → API route is called
2. **Searches free APIs** → Unsplash (and Pexels if configured)
3. **Gets real image URLs** → Returns actual image URLs
4. **Downloads & validates** → Checks each image before returning
5. **Returns base64** → Actual image data (not broken URLs)

## Setup

### Option 1: Unsplash Only (No API Key Required!)

**No setup needed!** Unsplash API works without an API key for basic usage.

Just restart your dev server and it will work!

### Option 2: Add Pexels (Optional, Better Results)

1. **Get free Pexels API key:**
   - Go to: https://www.pexels.com/api/
   - Sign up (free)
   - Get your API key

2. **Add to `.env.local`:**
   ```env
   PEXELS_API_KEY=your_pexels_api_key_here
   ```

3. **Restart dev server**

## Benefits

✅ **Free** - No API costs  
✅ **No API keys needed** - Unsplash works without keys  
✅ **Real images** - Actual working URLs  
✅ **High quality** - Professional stock photos  
✅ **Fast** - Direct API calls  
✅ **Reliable** - No bot blocking  

## Limitations

⚠️ **Stock photos** - May not find exact product images  
⚠️ **Generic results** - Better for common products  
⚠️ **May need manual upload** - For very specific products  

## Cost

- **Unsplash:** Free (no limits for basic usage)
- **Pexels:** Free tier: 200 requests/hour, then $9.99/month for more

## Testing

1. Restart your dev server
2. Click image placeholder in ProductEditorV2
3. Check console logs:
   - `🔍 Searching free image APIs for: ...`
   - `✅ Found X image(s) from Unsplash`
   - `📥 Trying image 1/X...`
   - `✅ Successfully downloaded image`

## Alternative: AWS Bedrock Agents (Agentic AI)

If you want true agentic AI that can browse the web:

### AWS Bedrock Agents

AWS Bedrock Agents can:
- Browse the web
- Use tools
- Perform actions
- Have memory/conversation context

**Setup:**
1. Create a Bedrock Agent in AWS Console
2. Configure web browsing tools
3. Use the agent to find product images

**Cost:** ~$0.0025 per agent invocation

### Azure AI Agents

Azure AI Agents (part of Azure OpenAI) can also browse the web and find images.

**Setup:**
1. Azure OpenAI Service
2. Configure AI Agents
3. Enable web browsing capabilities

**Cost:** Pay per token usage

## Recommendation

**Start with free APIs** (Unsplash/Pexels) - they're:
- ✅ Free
- ✅ Simple
- ✅ Fast
- ✅ Reliable

If you need more specific product images, consider:
- Manual upload (always works)
- AWS Bedrock Agents (for agentic browsing)
- Azure AI Agents (if you have Azure)

## Next Steps

The system is ready! Just restart your dev server and test it. No API keys needed for basic usage! 🚀

