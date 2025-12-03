# Perplexity AI Image Fetching Setup

## ✅ What's Implemented

The system now uses **Perplexity AI** for image fetching. Perplexity AI is perfect for this because:
- ✅ **Real-time web search** - Searches the web in real-time
- ✅ **Finds actual product images** - Extracts URLs from e-commerce sites
- ✅ **No API keys needed** (except Perplexity) - No Google/Bing required
- ✅ **Agentic AI** - Uses AI to understand context and find relevant images

## How It Works

1. **User clicks image placeholder** → API route called
2. **Perplexity AI searches web** → Uses `llama-3.1-sonar-large-128k-online` model
3. **Finds product images** → Searches Amazon, Flipkart, Meesho, etc.
4. **Extracts image URLs** → Gets direct links to image files
5. **Downloads & validates** → Checks each image before returning
6. **Returns base64** → Actual image data (not broken URLs)

## Setup

### Required Environment Variable

Add to your `.env.local`:
```env
PERPLEXITY_API_KEY=your-perplexity-api-key-here
```

**Get your API key from:** https://www.perplexity.ai/settings/api

**Optional:** If you know the correct model name, you can specify it:
```env
PERPLEXITY_MODEL=sonar  # or sonar-pro, sonar-small-online, etc.
```

The system will automatically try different models until one works.

## How Perplexity AI Works

### Model Used
- **Model:** `llama-3.1-sonar-large-128k-online`
- **Why:** This is Perplexity's online model that can search the web in real-time
- **Capabilities:** 
  - Real-time web search
  - Extracts information from web pages
  - Finds product images on e-commerce sites
  - Returns actual image URLs

### Process Flow

```
User Request
    ↓
Perplexity AI searches web
    ↓
Finds product pages on Amazon/Flipkart/Meesho
    ↓
Extracts image URLs from pages
    ↓
Returns array of image URLs
    ↓
System downloads & validates each URL
    ↓
Returns base64 image data
```

## Benefits

✅ **Real-time search** - Always finds current product images  
✅ **No Google/Bing APIs** - Perplexity handles web search  
✅ **Contextual understanding** - AI understands product context  
✅ **Multiple URLs** - Tries up to 10 URLs until one works  
✅ **Validated images** - Downloads and checks each image  
✅ **Simple setup** - Just one API key needed  

## Cost

- **Perplexity AI:** 
  - Free tier: Limited requests
  - Paid: ~$0.0001-0.001 per request (very affordable)
  - Check: https://www.perplexity.ai/pricing

## Testing

1. Add `PERPLEXITY_API_KEY` to `.env.local`
2. Restart dev server
3. Click image placeholder in ProductEditorV2
4. Check console logs:
   - `🔍 Searching Perplexity AI for: ...`
   - `✅ Perplexity found X image URL(s)`
   - `📥 Trying image 1/X...`
   - `✅ Successfully downloaded image`

## Troubleshooting

### "Perplexity AI not configured"
- ✅ Add `PERPLEXITY_API_KEY` to `.env.local`
- ✅ Restart dev server after adding

### "No images found"
- ✅ Check Perplexity API key is valid
- ✅ Check API quota/limits
- ✅ Try a different product name

### "All URLs failed validation"
- ✅ Some URLs might be blocked or expired
- ✅ System will return URL anyway with lower confidence
- ✅ Try manual upload as fallback

## Next Steps

The system is ready! Just:
1. ✅ Add `PERPLEXITY_API_KEY` to `.env.local`
2. ✅ Restart dev server
3. ✅ Test by clicking image placeholder

Perplexity AI will search the web in real-time and find actual product images! 🚀

