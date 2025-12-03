/**
 * AWS Lambda Function: Fetch Product Image
 * 
 * Fetches product images by scraping e-commerce websites:
 * 1. Amazon India (primary)
 * 2. Flipkart (fallback)
 * 3. Meesho (fallback)
 * 
 * Uses AWS S3 to optionally cache images
 * 
 * Environment Variables (Optional):
 * - S3_BUCKET_NAME - If you want to cache images in S3
 * - AWS_REGION - AWS region for S3
 */

const https = require('https');
const http = require('http');
// Note: AWS SDK not needed - this function only makes HTTP requests to scrape websites

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const { productName, brand } = JSON.parse(event.body || event);
        
        if (!productName) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Product name is required'
                })
            };
        }

        // Build search query - avoid duplicate brand in product name
        let searchQuery = productName.trim();
        if (brand && brand.trim()) {
            const brandLower = brand.trim().toLowerCase();
            const productLower = productName.toLowerCase();
            // Only add brand if it's not already in the product name
            if (!productLower.includes(brandLower)) {
                searchQuery = `${brand.trim()} ${productName.trim()}`.trim();
            }
        }

        console.log(`Searching for image: "${searchQuery}"`);

        // Try Amazon India first
        const amazonImage = await searchAmazonIndia(searchQuery);
        if (amazonImage) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: true,
                    imageUrl: amazonImage,
                    source: 'amazon',
                    query: searchQuery
                })
            };
        }

        // Fallback to Flipkart
        const flipkartImage = await searchFlipkart(searchQuery);
        if (flipkartImage) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: true,
                    imageUrl: flipkartImage,
                    source: 'flipkart',
                    query: searchQuery
                })
            };
        }

        // Fallback to Meesho
        const meeshoImage = await searchMeesho(searchQuery);
        if (meeshoImage) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: true,
                    imageUrl: meeshoImage,
                    source: 'meesho',
                    query: searchQuery
                })
            };
        }

        // No image found - provide helpful error message
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: false,
                error: 'No image found. E-commerce sites may be blocking automated requests. Please try manual upload.',
                query: searchQuery,
                suggestion: 'You can manually upload product images using the Upload button.'
            })
        };

    } catch (error) {
        console.error('Error in Lambda function:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error'
            })
        };
    }
};

/**
 * Search Amazon India for product images
 */
async function searchAmazonIndia(query) {
    try {
        // Amazon India search URL
        const encodedQuery = encodeURIComponent(query);
        const searchUrl = `https://www.amazon.in/s?k=${encodedQuery}`;
        
        console.log(`Searching Amazon India: ${searchUrl}`);
        
        const html = await makeRequest(searchUrl, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        });

        // Extract product image from search results
        // Amazon uses data-src or src attributes for product images
        const imageRegex = /<img[^>]+data-src="([^"]+)"[^>]*class="[^"]*s-image[^"]*"/i;
        const match = html.match(imageRegex);
        
        if (match && match[1]) {
            let imageUrl = match[1];
            // Clean up Amazon image URL to get high-res version
            if (imageUrl.includes('._AC_')) {
                imageUrl = imageUrl.replace(/\._AC_[^_]+_/, '._AC_SL1500_');
            }
            return imageUrl;
        }

        // Alternative: Try to find image in product detail page
        const productLinkRegex = /<a[^>]+href="(\/dp\/[^"]+)"[^>]*>/i;
        const productMatch = html.match(productLinkRegex);
        
        if (productMatch && productMatch[1]) {
            const productUrl = `https://www.amazon.in${productMatch[1]}`;
            const productHtml = await makeRequest(productUrl, {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            });
            
            const mainImageRegex = /id="landingImage"[^>]+data-old-src="([^"]+)"/i;
            const mainImageMatch = productHtml.match(mainImageRegex);
            if (mainImageMatch && mainImageMatch[1]) {
                return mainImageMatch[1];
            }
        }

        return null;
    } catch (error) {
        const errorMsg = error.message || 'Unknown error';
        console.error('Amazon India search error:', errorMsg);
        // Don't log full HTML errors, just status codes
        if (errorMsg.includes('HTTP')) {
            console.warn(`Amazon blocked request: ${errorMsg}`);
        }
        return null;
    }
}

/**
 * Search Flipkart for product images
 */
async function searchFlipkart(query) {
    try {
        const encodedQuery = encodeURIComponent(query);
        const searchUrl = `https://www.flipkart.com/search?q=${encodedQuery}`;
        
        console.log(`Searching Flipkart: ${searchUrl}`);
        
        const html = await makeRequest(searchUrl, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        });

        // Flipkart uses data-src for lazy-loaded images
        const imageRegex = /<img[^>]+data-src="([^"]+)"[^>]*class="[^"]*_396cs4[^"]*"/i;
        const match = html.match(imageRegex);
        
        if (match && match[1]) {
            return match[1];
        }

        // Alternative pattern
        const altImageRegex = /<img[^>]+src="([^"]+)"[^>]*class="[^"]*_396cs4[^"]*"/i;
        const altMatch = html.match(altImageRegex);
        if (altMatch && altMatch[1]) {
            return altMatch[1];
        }

        return null;
    } catch (error) {
        const errorMsg = error.message || 'Unknown error';
        console.error('Flipkart search error:', errorMsg);
        // Flipkart often returns 529 (overloaded) or blocks bots
        if (errorMsg.includes('529') || errorMsg.includes('overloaded')) {
            console.warn('Flipkart is overloaded or blocking requests');
        }
        return null;
    }
}

/**
 * Search Meesho for product images
 */
async function searchMeesho(query) {
    try {
        const encodedQuery = encodeURIComponent(query);
        const searchUrl = `https://www.meesho.com/search?q=${encodedQuery}`;
        
        console.log(`Searching Meesho: ${searchUrl}`);
        
        const html = await makeRequest(searchUrl, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        });

        // Meesho product image pattern
        const imageRegex = /<img[^>]+src="([^"]+)"[^>]*alt="[^"]*"[^>]*class="[^"]*sc-[^"]*Image[^"]*"/i;
        const match = html.match(imageRegex);
        
        if (match && match[1]) {
            return match[1];
        }

        // Alternative: Look for product card images
        const cardImageRegex = /background-image:\s*url\(['"]?([^'"]+)['"]?\)/i;
        const cardMatch = html.match(cardImageRegex);
        if (cardMatch && cardMatch[1]) {
            return cardMatch[1];
        }

        return null;
    } catch (error) {
        const errorMsg = error.message || 'Unknown error';
        console.error('Meesho search error:', errorMsg);
        // Meesho often blocks automated requests with 403
        if (errorMsg.includes('403') || errorMsg.includes('Access Denied')) {
            console.warn('Meesho blocked request (likely bot detection)');
        }
        return null;
    }
}

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...headers
            }
        };

        const client = urlObj.protocol === 'https:' ? https : http;

        const req = client.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    // Only include status code in error, not full HTML response
                    const errorMsg = data.length > 200 
                        ? `HTTP ${res.statusCode}: ${data.substring(0, 200)}...` 
                        : `HTTP ${res.statusCode}: ${data}`;
                    reject(new Error(errorMsg));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        // Set timeout (10 seconds)
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

