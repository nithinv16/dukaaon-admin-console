import { toast } from 'react-hot-toast';

export interface ImageSearchResult {
  url: string;
  source: string;
  confidence: number;
}

/**
 * Search for product images using multiple sources with web scraping
 */
export class ProductImageSearcher {
  private maxRetries = 3;
  private timeout = 10000; // 10 seconds
  
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };

  private companyDomains = {
    'unilever': 'unilever.com',
    'hindustan unilever': 'hul.co.in',
    'surf': 'surf.co.in',
    'dove': 'dove.com',
    'lifebuoy': 'lifebuoy.co.in',
    'ponds': 'ponds.com',
    'brooke bond': 'brookebond.co.in',
    'rin': 'rin.co.in',
    'wheel': 'wheel.co.in',
    'nestle': 'nestle.com',
    'maggi': 'maggi.in',
    'nescafe': 'nescafe.com'
  };

  /**
   * Search for images using Google Images - searches for product name as keyword
   */
  private async searchGoogleImages(productName: string, brandName: string = ''): Promise<ImageSearchResult[]> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Create search query using product name as keyword
        const searchQuery = `${brandName} ${productName} product image`.trim();
        console.log(`🔍 Google search: ${searchQuery}`);
        
        const encodedQuery = encodeURIComponent(searchQuery);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        // Google Images search URL
        const url = `https://www.google.com/search?q=${encodedQuery}&tbm=isch&safe=active`;
        
        const response = await fetch(url, {
          headers: this.headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Google search failed: ${response.status}`);
        }
        
        const html = await response.text();
        const imageUrls: ImageSearchResult[] = [];
        
        // Method 1: Look for img tags with data-src or src
        const imgRegex = /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          const src = match[1];
          if (src && src.startsWith('http') && this.isValidImageUrl(src)) {
            imageUrls.push({
              url: src,
              source: 'google',
              confidence: 0.8
            });
          }
        }
        
        // Method 2: Look for JSON data containing image URLs (Google's format)
        const jsonRegex = /"ou":"([^"]+)"/g;
        while ((match = jsonRegex.exec(html)) !== null) {
          let url = match[1];
          // Decode URL
          url = url.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
          if (this.isValidImageUrl(url)) {
            imageUrls.push({
              url: url,
              source: 'google',
              confidence: 0.9
            });
          }
        }
        
        // Remove duplicates
        const uniqueUrls = Array.from(new Set(imageUrls.map(img => img.url)))
          .map(url => imageUrls.find(img => img.url === url)!)
          .slice(0, 10);
        
        if (uniqueUrls.length > 0) {
          console.log(`📸 Google found ${uniqueUrls.length} images`);
          return uniqueUrls;
        }
        
        // If no results and not last attempt, retry
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
      } catch (error) {
        console.error(`Google search attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }
      }
    }
    
    return [];
  }

  /**
   * Generate Amazon-style product image ID
   */
  private generateAmazonId(productName: string): string {
    const hash = this.generateSeed(productName);
    return hash.padStart(10, '0').substring(0, 10);
  }

  /**
   * Generate Pexels-style image ID
   */
  private generatePexelsId(productName: string): string {
    const hash = this.generateSeed(productName);
    return (parseInt(hash) % 9000000 + 1000000).toString();
  }

  /**
   * Generate Unsplash-style image ID
   */
  private generateImageId(productName: string, brandName: string): string {
    const combined = `${productName}${brandName}`;
    const hash = this.generateSeed(combined);
    return (parseInt(hash) % 9000000000000 + 1000000000000).toString();
  }

  /**
   * Search for real image sources using alternative methods
   */
  private async searchRealImageSources(productName: string, brandName: string): Promise<ImageSearchResult[]> {
    const results: ImageSearchResult[] = [];
    
    try {
      // Use JSONPlaceholder or similar services for demo images
      const demoImages = [
        'https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=' + encodeURIComponent(productName.substring(0, 10)),
        'https://dummyimage.com/400x400/4ECDC4/FFFFFF.png&text=' + encodeURIComponent(productName.substring(0, 10)),
        'https://placehold.co/400x400/45B7D1/FFFFFF/png?text=' + encodeURIComponent(productName.substring(0, 10))
      ];
      
      demoImages.forEach((url, index) => {
        results.push({
          url: url,
          source: 'google',
          confidence: 0.6 - (index * 0.1)
        });
      });
      
    } catch (error) {
      console.error('Real image source search failed:', error);
    }
    
    return results;
  }

  /**
   * Search for images using Bing Images - searches for product name as keyword
   */
  private async searchBingImages(productName: string, brandName: string = ''): Promise<ImageSearchResult[]> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Create search query using product name as keyword
        const searchQuery = `${brandName} ${productName} product image`.trim();
        console.log(`🔍 Bing search: ${searchQuery}`);
        
        const encodedQuery = encodeURIComponent(searchQuery);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        // Bing Images search URL
        const url = `https://www.bing.com/images/search?q=${encodedQuery}&form=HDRSC2&first=1&tsc=ImageBasicHover`;
        
        const response = await fetch(url, {
          headers: this.headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Bing search failed: ${response.status}`);
        }
        
        const html = await response.text();
        const imageUrls: ImageSearchResult[] = [];
        
        // Look for image URLs in Bing's structure
        // Method 1: Look for img tags with class 'mimg'
        const bingImgRegex = /<img[^>]+class=["'][^"']*mimg[^"']*["'][^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = bingImgRegex.exec(html)) !== null) {
          const src = match[1];
          if (src && src.startsWith('http') && this.isValidImageUrl(src)) {
            imageUrls.push({
              url: src,
              source: 'bing',
              confidence: 0.8
            });
          }
        }
        
        // Method 2: Look for general img tags with data-src or src
        const generalImgRegex = /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi;
        while ((match = generalImgRegex.exec(html)) !== null) {
          const src = match[1];
          if (src && src.startsWith('http') && this.isValidImageUrl(src) && 
              !imageUrls.some(img => img.url === src)) {
            imageUrls.push({
              url: src,
              source: 'bing',
              confidence: 0.7
            });
          }
        }
        
        // Remove duplicates and limit results
        const uniqueUrls = Array.from(new Set(imageUrls.map(img => img.url)))
          .map(url => imageUrls.find(img => img.url === url)!)
          .slice(0, 5);
        
        if (uniqueUrls.length > 0) {
          console.log(`🔍 Bing found ${uniqueUrls.length} images`);
          return uniqueUrls;
        }
        
        // If no results and not last attempt, retry
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
      } catch (error) {
        console.error(`Bing search attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }
      }
    }
    
    return [];
  }

  /**
   * Generate Bing-style image ID
   */
  private generateBingId(text: string): string {
    const hash = this.generateSeed(text);
    // Generate a hex-like string similar to Bing's image IDs
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars[parseInt(hash.charAt(i % hash.length)) % 16];
    }
    return result;
  }

  /**
   * Search for images on Wikipedia - improved implementation
   */
  private async searchWikipediaImages(productName: string, brandName: string = ''): Promise<ImageSearchResult[]> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const searchQuery = `${brandName} ${productName}`.trim();
        console.log(`📚 Wikipedia search: ${searchQuery}`);
        
        const encodedQuery = encodeURIComponent(searchQuery);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        // Use Wikipedia API to search for articles
        const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'ProductImageSearcher/1.0 (https://example.com/contact)',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (response.status === 404) {
            // Try alternative search terms
            const alternatives = [
              brandName,
              productName,
              productName.split(' ')[0] // First word only
            ].filter(term => term && term.length > 2);
            
            for (const alt of alternatives) {
              const altResponse = await this.searchWikipediaAlternative(alt);
              if (altResponse.length > 0) {
                return altResponse;
              }
            }
          }
          throw new Error(`Wikipedia API error: ${response.status}`);
        }
        
        const data = await response.json();
        const imageUrls: ImageSearchResult[] = [];
        
        // Check for original image (highest quality)
        if (data.originalimage && data.originalimage.source) {
          const url = data.originalimage.source;
          if (this.isValidImageUrl(url)) {
            imageUrls.push({
              url: url,
              source: 'wikipedia',
              confidence: 0.9
            });
          }
        }
        
        // Check if there's a thumbnail image
        if (data.thumbnail && data.thumbnail.source) {
          const url = data.thumbnail.source;
          if (this.isValidImageUrl(url) && !imageUrls.some(img => img.url === url)) {
            imageUrls.push({
              url: url,
              source: 'wikipedia',
              confidence: 0.7
            });
          }
        }
        
        if (imageUrls.length > 0) {
          console.log(`📚 Wikipedia found ${imageUrls.length} images`);
          return imageUrls;
        }
        
        // If no results and not last attempt, retry
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
      } catch (error) {
        console.error(`Wikipedia search attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }
      }
    }
    
    return [];
  }

  /**
   * Search Wikipedia with alternative terms
   */
  private async searchWikipediaAlternative(searchTerm: string): Promise<ImageSearchResult[]> {
    try {
      const encodedQuery = encodeURIComponent(searchTerm);
      const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'ProductImageSearcher/1.0 (https://example.com/contact)',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      const imageUrls: ImageSearchResult[] = [];
      
      if (data.originalimage && data.originalimage.source) {
        const url = data.originalimage.source;
        if (this.isValidImageUrl(url)) {
          imageUrls.push({
            url: url,
            source: 'wikipedia',
            confidence: 0.6
          });
        }
      }
      
      return imageUrls;
      
    } catch (error) {
      console.error('Wikipedia alternative search failed:', error);
      return [];
    }
  }

  /**
   * Search for images from company websites - searches for product name as keyword
   */
  private async searchCompanyWebsites(productName: string, brandName: string = ''): Promise<ImageSearchResult[]> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`🏢 Company website search: ${brandName} ${productName}`);
        
        // Find company domain based on brand or product name
        const searchTerm = (brandName || productName).toLowerCase();
        let companyDomain = '';
        
        for (const [brand, domain] of Object.entries(this.companyDomains)) {
          if (searchTerm.includes(brand.toLowerCase())) {
            companyDomain = domain;
            break;
          }
        }
        
        const imageUrls: ImageSearchResult[] = [];
        
        if (companyDomain) {
          // Search company website for product images
          const searchQuery = `${productName} ${brandName}`.trim();
          const encodedQuery = encodeURIComponent(searchQuery);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeout);
          
          // Try to search the company website
          const searchUrl = `https://${companyDomain}/search?q=${encodedQuery}`;
          
          try {
            const response = await fetch(searchUrl, {
              headers: this.headers,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const html = await response.text();
              
              // Look for product images in the search results
              const imgRegex = /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi;
              let match;
              while ((match = imgRegex.exec(html)) !== null) {
                const src = match[1];
                if (src && this.isValidImageUrl(src)) {
                  // Make URL absolute if relative
                  const absoluteUrl = src.startsWith('http') ? src : `https://${companyDomain}${src.startsWith('/') ? '' : '/'}${src}`;
                  
                  imageUrls.push({
                    url: absoluteUrl,
                    source: 'company',
                    confidence: 0.9
                  });
                }
              }
            }
          } catch (searchError) {
            console.log(`Company search failed, trying direct patterns: ${searchError}`);
          }
          
          // If search didn't work, try common product image patterns
          if (imageUrls.length === 0) {
            const cleanProductName = productName.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().replace(/\s+/g, '-');
            const cleanBrandName = brandName.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().replace(/\s+/g, '-');
            
            const companyPatterns = [
              `https://${companyDomain}/images/products/${cleanProductName}.jpg`,
              `https://${companyDomain}/assets/images/${cleanBrandName}-${cleanProductName}.jpg`,
              `https://${companyDomain}/media/catalog/product/${cleanProductName}.jpg`,
              `https://${companyDomain}/wp-content/uploads/${cleanProductName}.jpg`,
              `https://cdn.${companyDomain}/products/${cleanProductName}.jpg`
            ];
            
            companyPatterns.forEach((url, index) => {
              if (this.isValidImageUrl(url)) {
                imageUrls.push({
                  url: url,
                  source: 'company',
                  confidence: 0.8 - (index * 0.1)
                });
              }
            });
          }
        }
        
        // Add generic placeholder images as fallback
        if (imageUrls.length === 0) {
          const genericImages = [
            `https://via.placeholder.com/400x400/CCCCCC/666666?text=${encodeURIComponent(productName)}`,
            `https://dummyimage.com/400x400/f0f0f0/333&text=${encodeURIComponent(productName)}`,
            `https://picsum.photos/400/400?random=${Math.abs(productName.split('').reduce((a, b) => a + b.charCodeAt(0), 0))}`
          ];
          
          genericImages.forEach((url, index) => {
            if (this.isValidImageUrl(url)) {
              imageUrls.push({
                url: url,
                source: 'company',
                confidence: 0.5 - (index * 0.1)
              });
            }
          });
        }
        
        // Remove duplicates and limit results
        const uniqueUrls = Array.from(new Set(imageUrls.map(img => img.url)))
          .map(url => imageUrls.find(img => img.url === url)!)
          .slice(0, 5);
        
        if (uniqueUrls.length > 0) {
          console.log(`🏢 Company search found ${uniqueUrls.length} images`);
          return uniqueUrls;
        }
        
        // If no results and not last attempt, retry
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
      } catch (error) {
        console.error(`Company search attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }
      }
    }
    
    return [];
  }

  /**
   * Validate if URL is a valid image URL - improved validation
   */
  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    // Check for common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const hasImageExtension = imageExtensions.some(ext => 
      url.toLowerCase().includes(ext)
    );
    
    // Check for image hosting domains
    const imageHosts = [
      'images.unsplash.com',
      'upload.wikimedia.org',
      'cdn.',
      'img.',
      'image.',
      'photo.',
      'pic.',
      'static.',
      'media.',
      'assets.',
      'content.'
    ];
    
    const isImageHost = imageHosts.some(host => url.includes(host));
    
    // Exclude certain patterns that are likely not product images
    const excludePatterns = [
      'logo',
      'icon',
      'avatar',
      'profile',
      'banner',
      'header',
      'footer',
      'button',
      'arrow',
      'loading',
      'spinner',
      'placeholder',
      'thumbnail',
      'preview'
    ];
    
    const hasExcludedPattern = excludePatterns.some(pattern => 
      url.toLowerCase().includes(pattern)
    );
    
    // Additional validation: URL should be reasonable length and format
    const isValidFormat = url.startsWith('http') && url.length < 2000 && url.length > 10;
    
    return (hasImageExtension || isImageHost) && !hasExcludedPattern && isValidFormat;
  }

  /**
   * Generate a deterministic seed from product name for consistent image generation
   */
  private generateSeed(productName: string): string {
    let hash = 0;
    for (let i = 0; i < productName.length; i++) {
      const char = productName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  /**
   * Get fallback image when no valid images are found - matching Python implementation
   */
  private getFallbackImage(productName: string): ImageSearchResult {
    const seed = this.generateSeed(productName);
    const encodedName = encodeURIComponent(productName.substring(0, 30));
    
    // Multiple fallback options
    const fallbackOptions = [
      `https://picsum.photos/seed/${seed}/400/400`,
      `https://via.placeholder.com/400x400/e3f2fd/1976d2?text=${encodedName}`,
      `https://dummyimage.com/400x400/cccccc/969696.png&text=${encodedName}`,
      `https://placehold.co/400x400/png?text=${encodedName}`
    ];
    
    // Use seed to select a consistent fallback
    const index = parseInt(seed) % fallbackOptions.length;
    
    return {
      url: fallbackOptions[index],
      source: 'fallback',
      confidence: 0.1
    };
  }

  /**
   * Validate image by attempting to load it - similar to Python's image verification
   */
  private async validateImageUrl(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, {
        method: 'HEAD', // Only get headers, not the full image
        signal: controller.signal,
        headers: {
          'User-Agent': this.headers['User-Agent']
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return false;
      }
      
      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');
      
      // Check if it's actually an image
      const isImage = contentType.startsWith('image/');
      
      // Check if it's not too small (likely not a real product image)
      const isReasonableSize = !contentLength || parseInt(contentLength) > 1024; // > 1KB
      
      return isImage && isReasonableSize;
      
    } catch (error) {
      console.error('Image validation failed:', error);
      return false;
    }
  }

  /**
   * Main method to search for product images - improved implementation matching Python logic
   */
  async searchProductImage(productName: string, brandName: string = ''): Promise<string> {
    try {
      console.log(`🔍 Searching image for: ${brandName} ${productName}`);
      
      // Try multiple sources in order of preference (matching Python implementation)
      const searchMethods = [
        () => this.searchGoogleImages(productName, brandName),
        () => this.searchBingImages(productName, brandName),
        () => this.searchWikipediaImages(productName, brandName),
        () => this.searchCompanyWebsites(productName, brandName)
      ];

      let allResults: ImageSearchResult[] = [];

      // Collect results from all sources
      for (const searchMethod of searchMethods) {
        try {
          const results = await Promise.race([
            searchMethod(),
            new Promise<ImageSearchResult[]>((_, reject) => 
              setTimeout(() => reject(new Error('Search timeout')), 10000)
            )
          ]);
          
          if (results.length > 0) {
            allResults.push(...results);
            console.log(`📸 Found ${results.length} images from ${results[0]?.source}`);
          }
          
        } catch (error) {
          console.error(`❌ Search method failed:`, error);
          continue;
        }
      }
      
      // If we have results, try to validate them
      if (allResults.length > 0) {
        // Sort by confidence and try to validate the best ones
        allResults.sort((a, b) => b.confidence - a.confidence);
        
        console.log(`🔍 Validating ${Math.min(allResults.length, 10)} image candidates...`);
        
        for (const result of allResults.slice(0, 10)) {
          try {
            const isValid = await Promise.race([
              this.validateImageUrl(result.url),
              new Promise<boolean>((_, reject) => 
                setTimeout(() => reject(new Error('Validation timeout')), 5000)
              )
            ]);
            
            if (isValid) {
              console.log(`✅ Found valid image from ${result.source}: ${result.url}`);
              return result.url;
            } else {
              console.log(`❌ Invalid image from ${result.source}: ${result.url}`);
            }
            
          } catch (error) {
            console.error(`❌ Image validation failed for ${result.url}:`, error);
            continue;
          }
        }
      }
      
      // If no valid images found, return fallback
      console.log('⚠️ No valid images found, using fallback');
      return this.getFallbackImage(productName).url;
      
    } catch (error) {
      console.error('❌ Product image search failed:', error);
      return this.getFallbackImage(productName).url;
    }
  }

  /**
   * Batch search for multiple products
   */
  async searchMultipleProducts(products: Array<{ name: string; brand?: string }>): Promise<{ [key: string]: string }> {
    const results: { [key: string]: string } = {};
    
    // Process in batches to avoid overwhelming the APIs
    const batchSize = 3;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (product) => {
        const imageUrl = await this.searchProductImage(product.name, product.brand || '');
        return { key: product.name, url: imageUrl };
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ key, url }) => {
        results[key] = url;
      });
      
      // Add delay between batches to respect API rate limits
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const imageSearcher = new ProductImageSearcher();

/**
 * Utility function to search for a single product image
 */
export async function searchProductImage(productName: string, brandName: string = ''): Promise<string> {
  return imageSearcher.searchProductImage(productName, brandName);
}

/**
 * Utility function to search for multiple product images
 */
export async function searchMultipleProductImages(products: Array<{ name: string; brand?: string }>): Promise<{ [key: string]: string }> {
  return imageSearcher.searchMultipleProducts(products);
}