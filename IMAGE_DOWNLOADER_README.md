# Product Image Downloader

A robust Python-based image downloader that searches for product images from multiple sources including Google Images, Bing Images, Wikipedia, and company websites.

## Features

- **Multi-source search**: Google Images, Bing Images, Wikipedia, and company websites
- **Keyword-based search**: Uses product names as search keywords for better accuracy
- **Retry logic**: Built-in retry mechanisms with exponential backoff
- **Image validation**: Validates downloaded images to ensure they're not corrupted
- **Confidence scoring**: Ranks results by source reliability
- **Fallback images**: Provides placeholder images when no results are found
- **CLI interface**: Command-line tool for standalone usage
- **Node.js integration**: Easy integration with your existing TypeScript/JavaScript project

## Installation

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or install manually:

```bash
pip install requests beautifulsoup4 Pillow lxml
```

### 2. Verify Installation

```bash
python product_image_downloader.py --product "Test Product" --search-only
```

## Usage

### Command Line Interface

#### Search for images (without downloading)

```bash
python product_image_downloader.py --product "Surf Excel" --brand "Unilever" --search-only
```

#### Download product image

```bash
python product_image_downloader.py --product "Surf Excel" --brand "Unilever"
```

#### Specify custom filename and output directory

```bash
python product_image_downloader.py --product "Surf Excel" --brand "Unilever" --filename "surf_excel.jpg" --output-dir "my_images"
```

#### Command Line Options

- `--product, -p`: Product name to search (required)
- `--brand, -b`: Brand name (optional)
- `--filename, -f`: Output filename (optional)
- `--output-dir, -o`: Output directory (default: 'product_images')
- `--search-only, -s`: Only search, do not download

### Python API

```python
from product_image_downloader import ProductImageDownloader

# Initialize downloader
downloader = ProductImageDownloader(output_dir="my_images")

# Search for images
results = downloader.search_product_images("Surf Excel", "Unilever")
print(f"Found {len(results)} images")

# Download the best image
if results:
    success = downloader.download_image(results[0]['url'], "surf_excel.jpg")
    if success:
        print("Image downloaded successfully!")
```

### Node.js Integration

```javascript
const PythonImageDownloader = require('./image_downloader_integration');

async function downloadProductImage() {
    const downloader = new PythonImageDownloader('product_images');
    
    try {
        // Check setup
        const isValid = await downloader.checkSetup();
        if (!isValid) {
            throw new Error('Python setup invalid');
        }
        
        // Search for images
        const results = await downloader.searchProductImages('Surf Excel', 'Unilever');
        console.log('Found images:', results);
        
        // Download image
        const imagePath = await downloader.downloadProductImage('Surf Excel', 'Unilever');
        console.log('Downloaded to:', imagePath);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

downloadProductImage();
```

## Integration with Your Admin Console

### 1. Replace TypeScript Image Searcher

Instead of using the TypeScript `imageSearcher.ts`, you can now use the Python downloader:

```javascript
// In your receipt processing code
const PythonImageDownloader = require('./image_downloader_integration');

async function processReceiptWithImages(receiptData) {
    const downloader = new PythonImageDownloader('receipt_product_images');
    
    for (const item of receiptData.items) {
        try {
            // Download product image
            const imagePath = await downloader.downloadProductImage(
                item.productName, 
                item.brandName || ''
            );
            
            // Add image path to item data
            item.imagePath = imagePath;
            
        } catch (error) {
            console.warn(`Failed to download image for ${item.productName}:`, error.message);
            // Continue processing other items
        }
    }
    
    return receiptData;
}
```

### 2. Update Your Azure OCR Integration

```javascript
// In azureOCR.ts or similar file
const PythonImageDownloader = require('./image_downloader_integration');

class EnhancedReceiptProcessor {
    constructor() {
        this.imageDownloader = new PythonImageDownloader('product_images');
    }
    
    async processReceiptWithImages(ocrResult) {
        const processedData = this.parseReceiptText(ocrResult);
        
        // Download images for each product
        for (const item of processedData.items) {
            if (item.productName) {
                try {
                    const imagePath = await this.imageDownloader.downloadProductImage(
                        item.productName,
                        item.brandName || ''
                    );
                    item.productImage = imagePath;
                } catch (error) {
                    console.warn(`Image download failed for ${item.productName}`);
                }
            }
        }
        
        return processedData;
    }
}
```

## Search Sources

### 1. Google Images
- Uses product name as search keyword
- Parses HTML and JSON data structures
- High confidence score (0.9)

### 2. Bing Images
- Direct search with product keywords
- Extracts images from search results
- Medium-high confidence score (0.8)

### 3. Wikipedia
- API-based search for product articles
- Extracts thumbnail and original images
- Medium confidence score (0.7)

### 4. Company Websites
- Searches brand-specific domains
- Uses common product image URL patterns
- Lower confidence score (0.6)

### 5. Fallback Images
- Placeholder services (placeholder.com, picsum.photos)
- Generated when no real images found
- Lowest confidence score (0.1)

## Configuration

### Company Domains

The downloader includes pre-configured domains for common brands:

```python
company_domains = {
    'unilever': 'unilever.com',
    'hindustan unilever': 'hul.co.in',
    'surf': 'surf.co.in',
    'dove': 'dove.com',
    'nestle': 'nestle.com',
    'maggi': 'maggi.in',
    # ... more brands
}
```

You can extend this list by modifying the `company_domains` dictionary in the `ProductImageDownloader` class.

### Headers and User Agent

The downloader uses realistic browser headers to avoid being blocked:

```python
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    # ... more headers
}
```

## Error Handling

- **Retry Logic**: Each search method retries up to 3 times with exponential backoff
- **Timeout Handling**: 15-second timeout for web requests
- **Image Validation**: Verifies downloaded files are valid images
- **Graceful Degradation**: Falls back to placeholder images when searches fail

## Performance Considerations

- **Connection Pooling**: Uses `requests.Session` for efficient HTTP connections
- **Parallel Processing**: Can be extended to search multiple sources simultaneously
- **Caching**: Skips downloading if image already exists
- **Size Validation**: Rejects images smaller than 1KB

## Troubleshooting

### Common Issues

1. **Python not found**
   ```bash
   # Install Python 3.8+ from python.org
   python --version
   ```

2. **Missing dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Permission errors**
   ```bash
   # Ensure write permissions to output directory
   mkdir product_images
   chmod 755 product_images
   ```

4. **Network issues**
   - Check internet connection
   - Verify firewall settings
   - Some corporate networks may block image searches

### Debug Mode

Add debug prints to see detailed execution:

```python
# In product_image_downloader.py, add:
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Advantages Over TypeScript Implementation

1. **Better Libraries**: Python has superior web scraping libraries (BeautifulSoup, requests)
2. **No CORS Issues**: Server-side execution bypasses browser CORS restrictions
3. **Image Processing**: PIL/Pillow for robust image validation and processing
4. **Mature Ecosystem**: More stable and feature-rich packages for web scraping
5. **Real Web Searches**: Performs actual searches instead of generating predictable URLs
6. **Better Error Handling**: More robust retry and fallback mechanisms

## Future Enhancements

- Add support for more image sources (Amazon, eBay, etc.)
- Implement image similarity checking to avoid duplicates
- Add image resizing and optimization
- Support for batch processing multiple products
- Integration with image CDNs for faster delivery
- Machine learning-based image quality scoring

## License

This tool is part of your admin console project and follows the same licensing terms.