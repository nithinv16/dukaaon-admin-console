# Product Image Fetcher Implementation

## ✅ What Was Implemented

### 1. AWS Lambda Function
- **Location:** `lambda/fetch-product-image/index.js`
- **Functionality:** 
  - Searches Google Custom Search API (primary)
  - Falls back to Bing Image Search API
  - Validates image dimensions (200x200 to 2000x2000)
  - Returns best matching product image

### 2. API Routes
- **Lambda-based:** `app/api/admin/fetch-product-image/route.ts`
  - Calls AWS Lambda function
  - Requires Lambda deployment
  
- **Direct API:** `app/api/admin/fetch-product-image-direct/route.ts`
  - Calls Google/Bing APIs directly from Next.js
  - No Lambda required (simpler setup)
  - Automatically used as fallback if Lambda fails

### 3. ProductEditorV2 Updates
- **Click to Fetch:** Click on image placeholder to automatically fetch image
- **Loading State:** Shows circular progress indicator during fetch
- **Manual Upload:** Still works as before (Upload button)
- **Smart Fallback:** Tries Lambda first, then direct API if Lambda unavailable

## 🎯 User Experience

1. **User clicks image placeholder** → Loading indicator appears
2. **System fetches image** → Uses product name + brand from table
3. **Image appears** → Automatically populated in the cell
4. **Manual upload still available** → Upload button works as before

## 📋 Setup Requirements

### Option 1: Lambda-based (Recommended for Production)
1. Deploy Lambda function (see `lambda/fetch-product-image/README.md`)
2. Set environment variables in Lambda
3. Add to `.env`:
   ```env
   PRODUCT_IMAGE_LAMBDA_FUNCTION_NAME=fetch-product-image
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   ```

### Option 2: Direct API (Simpler, No Lambda)
1. Add to `.env`:
   ```env
   GOOGLE_CUSTOM_SEARCH_API_KEY=your_google_key
   GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id
   BING_IMAGE_SEARCH_API_KEY=your_bing_key
   ```
2. The system will automatically use direct API if Lambda is not configured

## 🔧 How It Works

### Flow Diagram
```
User clicks image placeholder
    ↓
ProductEditorV2 calls /api/admin/fetch-product-image
    ↓
API tries Lambda function (if configured)
    ↓ (if fails)
API falls back to direct API calls
    ↓
Google Custom Search API (primary)
    ↓ (if fails)
Bing Image Search API (fallback)
    ↓
Image URL returned to ProductEditorV2
    ↓
Image displayed in table
```

## 🎨 UI Features

- **Image Placeholder:** Clickable, shows search icon
- **Loading Indicator:** Circular progress during fetch
- **Fetch Button:** Separate button for manual fetch trigger
- **Upload Button:** Manual file upload (unchanged)
- **Hover Effects:** Visual feedback on clickable elements

## 📝 Notes

- Manual upload functionality is **preserved** and works exactly as before
- Image fetching is **non-blocking** - doesn't prevent editing other fields
- **Error handling** with user-friendly toast messages
- **Automatic fallback** between Lambda and direct API

## 🚀 Next Steps

1. Get Google Custom Search API key
2. Get Bing Image Search API key (optional but recommended)
3. Choose: Lambda deployment OR direct API (direct is simpler)
4. Add environment variables
5. Test by clicking image placeholder in ProductEditorV2

See `SETUP_IMAGE_FETCHER.md` for detailed setup instructions.

