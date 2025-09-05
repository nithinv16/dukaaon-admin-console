import os
import time
import requests
import json
from urllib.parse import quote
from bs4 import BeautifulSoup
from PIL import Image
import io
import re
from typing import List, Dict, Optional

class ProductImageDownloader:
    def __init__(self, output_dir="product_images"):
        self.output_dir = output_dir
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # Company domains for common brands
        self.company_domains = {
            'unilever': 'unilever.com',
            'hindustan unilever': 'hul.co.in',
            'hul': 'hul.co.in',
            'surf': 'surf.co.in',
            'dove': 'dove.com',
            'lifebuoy': 'lifebuoy.co.in',
            'ponds': 'ponds.com',
            'brooke bond': 'brookebond.co.in',
            'rin': 'rin.co.in',
            'wheel': 'wheel.co.in',
            'nestle': 'nestle.com',
            'maggi': 'maggi.in',
            'nescafe': 'nescafe.com',
            'kitkat': 'kitkat.com',
            'coca cola': 'coca-cola.com',
            'pepsi': 'pepsi.com',
            'britannia': 'britannia.co.in',
            'parle': 'parle.com'
        }
        
        # Create output directory if it doesn't exist
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
    def search_google_images(self, product_name: str, brand_name: str = "", max_retries: int = 3) -> List[str]:
        """Search for images on Google Images using product name as keyword"""
        for attempt in range(max_retries):
            try:
                # Create search query using product name as keyword
                search_query = f"{brand_name} {product_name} product image".strip()
                encoded_query = quote(search_query)
                
                print(f"[GOOGLE] Google search: {search_query}")
                
                # Google Images search URL
                url = f"https://www.google.com/search?q={encoded_query}&tbm=isch&safe=active"
                
                response = self.session.get(url, timeout=15)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                image_urls = []
                
                # Method 1: Look for img tags with data-src or src
                img_tags = soup.find_all('img')
                for img in img_tags:
                    src = img.get('data-src') or img.get('src')
                    if src and src.startswith('http') and self._is_valid_image_url(src):
                        image_urls.append(src)
                
                # Method 2: Look for JSON data containing image URLs
                scripts = soup.find_all('script')
                for script in scripts:
                    if script.string and '"ou":' in script.string:
                        urls = re.findall(r'"ou":"([^"]+)"', script.string)
                        for url in urls:
                            if self._is_valid_image_url(url):
                                # Decode URL
                                decoded_url = url.replace('\\u003d', '=').replace('\\u0026', '&')
                                image_urls.append(decoded_url)
                
                # Remove duplicates and return first 10
                unique_urls = list(dict.fromkeys(image_urls))[:10]
                
                if unique_urls:
                    print(f"[GOOGLE] Google found {len(unique_urls)} images")
                    return unique_urls
                
                # If no results and not last attempt, retry
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))
                    continue
                    
            except Exception as e:
                print(f"Google search attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 * (attempt + 1))
                    continue
        
        return []
    
    def search_bing_images(self, product_name: str, brand_name: str = "", max_retries: int = 3) -> List[str]:
        """Search for images on Bing Images using product name as keyword"""
        for attempt in range(max_retries):
            try:
                search_query = f"{brand_name} {product_name} product image".strip()
                encoded_query = quote(search_query)
                
                print(f"[BING] Bing search: {search_query}")
                
                url = f"https://www.bing.com/images/search?q={encoded_query}&form=HDRSC2&first=1&tsc=ImageBasicHover"
                
                response = self.session.get(url, timeout=15)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                image_urls = []
                
                # Look for image URLs in Bing's structure
                # Method 1: Look for img tags with class 'mimg'
                img_tags = soup.find_all('img', {'class': 'mimg'})
                for img in img_tags:
                    src = img.get('data-src') or img.get('src')
                    if src and src.startswith('http') and self._is_valid_image_url(src):
                        image_urls.append(src)
                
                # Method 2: Look for general img tags
                if not image_urls:
                    img_tags = soup.find_all('img')
                    for img in img_tags:
                        src = img.get('data-src') or img.get('src')
                        if src and src.startswith('http') and self._is_valid_image_url(src):
                            image_urls.append(src)
                
                # Remove duplicates and return first 5
                unique_urls = list(dict.fromkeys(image_urls))[:5]
                
                if unique_urls:
                    print(f"[BING] Bing found {len(unique_urls)} images")
                    return unique_urls
                
                # If no results and not last attempt, retry
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))
                    continue
                    
            except Exception as e:
                print(f"Bing search attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 * (attempt + 1))
                    continue
        
        return []
    
    def search_wikipedia_images(self, product_name: str, brand_name: str = "", max_retries: int = 3) -> List[str]:
        """Search for images on Wikipedia using product name as keyword"""
        for attempt in range(max_retries):
            try:
                search_query = f"{brand_name} {product_name}".strip()
                
                print(f"[WIKIPEDIA] Wikipedia search: {search_query}")
                
                # Try Wikipedia API first
                api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(search_query)}"
                
                try:
                    response = self.session.get(api_url, timeout=10)
                    if response.status_code == 200:
                        data = response.json()
                        image_urls = []
                        
                        # Get thumbnail and original image
                        if 'thumbnail' in data:
                            image_urls.append(data['thumbnail']['source'])
                        if 'originalimage' in data:
                            image_urls.append(data['originalimage']['source'])
                        
                        if image_urls:
                            print(f"[WIKIPEDIA] Wikipedia API found {len(image_urls)} images")
                            return image_urls
                except:
                    pass
                
                # Fallback to search page
                encoded_query = quote(search_query)
                url = f"https://en.wikipedia.org/wiki/Special:Search?search={encoded_query}&go=Go"
                
                response = self.session.get(url, timeout=15)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                image_urls = []
                
                # Look for images in Wikipedia articles
                img_tags = soup.find_all('img')
                for img in img_tags:
                    src = img.get('src')
                    if src and ('upload.wikimedia.org' in src or src.startswith('//')): 
                        if src.startswith('//'):
                            src = 'https:' + src
                        if self._is_valid_image_url(src):
                            image_urls.append(src)
                
                # Remove duplicates and return first 3
                unique_urls = list(dict.fromkeys(image_urls))[:3]
                
                if unique_urls:
                    print(f"[WIKIPEDIA] Wikipedia found {len(unique_urls)} images")
                    return unique_urls
                
                # If no results and not last attempt, retry
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))
                    continue
                    
            except Exception as e:
                print(f"Wikipedia search attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 * (attempt + 1))
                    continue
        
        return []
    
    def search_company_websites(self, product_name: str, brand_name: str = "", max_retries: int = 3) -> List[str]:
        """Search for images on company websites using product name as keyword"""
        for attempt in range(max_retries):
            try:
                print(f"[COMPANY] Company website search: {brand_name} {product_name}")
                
                # Find company domain based on brand or product name
                search_term = (brand_name or product_name).lower()
                company_domain = None
                
                for brand, domain in self.company_domains.items():
                    if brand in search_term:
                        company_domain = domain
                        break
                
                image_urls = []
                
                if company_domain:
                    # Try to search the company website
                    search_query = f"{product_name} {brand_name}".strip()
                    
                    # Try company search endpoint
                    try:
                        search_url = f"https://{company_domain}/search?q={quote(search_query)}"
                        response = self.session.get(search_url, timeout=10)
                        
                        if response.status_code == 200:
                            soup = BeautifulSoup(response.text, 'html.parser')
                            
                            # Look for product images in search results
                            img_tags = soup.find_all('img')
                            for img in img_tags:
                                src = img.get('data-src') or img.get('src')
                                if src and self._is_valid_image_url(src):
                                    # Make URL absolute if relative
                                    if src.startswith('http'):
                                        image_urls.append(src)
                                    else:
                                        absolute_url = f"https://{company_domain}{'' if src.startswith('/') else '/'}{src}"
                                        image_urls.append(absolute_url)
                    except:
                        pass
                    
                    # If search didn't work, try common product image patterns
                    if not image_urls:
                        clean_product = re.sub(r'[^a-zA-Z0-9\s]', '', product_name).lower().replace(' ', '-')
                        clean_brand = re.sub(r'[^a-zA-Z0-9\s]', '', brand_name).lower().replace(' ', '-')
                        
                        patterns = [
                            f"https://{company_domain}/images/products/{clean_product}.jpg",
                            f"https://{company_domain}/assets/images/{clean_brand}-{clean_product}.jpg",
                            f"https://{company_domain}/media/catalog/product/{clean_product}.jpg",
                            f"https://{company_domain}/wp-content/uploads/{clean_product}.jpg",
                            f"https://cdn.{company_domain}/products/{clean_product}.jpg"
                        ]
                        
                        for pattern in patterns:
                            image_urls.append(pattern)
                
                # Add generic placeholder images as fallback
                if not image_urls:
                    generic_images = [
                        f"https://via.placeholder.com/400x400/CCCCCC/666666?text={quote(product_name)}",
                        f"https://dummyimage.com/400x400/f0f0f0/333&text={quote(product_name)}",
                        f"https://picsum.photos/400/400?random={abs(hash(product_name)) % 10000}"
                    ]
                    image_urls.extend(generic_images)
                
                # Remove duplicates and return first 5
                unique_urls = list(dict.fromkeys(image_urls))[:5]
                
                if unique_urls:
                    print(f"[COMPANY] Company search found {len(unique_urls)} images")
                    return unique_urls
                
                # If no results and not last attempt, retry
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))
                    continue
                    
            except Exception as e:
                print(f"Company search attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 * (attempt + 1))
                    continue
        
        return []
    
    def _is_valid_image_url(self, url: str) -> bool:
        """Check if URL is a valid image URL"""
        if not url or not isinstance(url, str):
            return False
        
        # Check for common image extensions
        image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']
        url_lower = url.lower()
        
        # Check if URL contains image extension
        has_extension = any(ext in url_lower for ext in image_extensions)
        
        # Check if URL looks like an image (even without extension)
        looks_like_image = (
            'image' in url_lower or 
            'photo' in url_lower or 
            'picture' in url_lower or
            '/img/' in url_lower or
            '/images/' in url_lower or
            'thumbnail' in url_lower
        )
        
        return has_extension or looks_like_image
    
    def search_product_images(self, product_name: str, brand_name: str = "") -> List[Dict[str, any]]:
        """Search for product images from all sources and return with confidence scores"""
        print(f"\n[SEARCH] Searching images for: {product_name} ({brand_name})")
        
        all_results = []
        
        # 1. Search Google Images
        google_urls = self.search_google_images(product_name, brand_name)
        for url in google_urls:
            all_results.append({
                'url': url,
                'source': 'google',
                'confidence': 0.9
            })
        
        # 2. Search Bing Images
        bing_urls = self.search_bing_images(product_name, brand_name)
        for url in bing_urls:
            all_results.append({
                'url': url,
                'source': 'bing',
                'confidence': 0.8
            })
        
        # 3. Search Wikipedia
        wiki_urls = self.search_wikipedia_images(product_name, brand_name)
        for url in wiki_urls:
            all_results.append({
                'url': url,
                'source': 'wikipedia',
                'confidence': 0.7
            })
        
        # 4. Search Company Websites
        company_urls = self.search_company_websites(product_name, brand_name)
        for url in company_urls:
            all_results.append({
                'url': url,
                'source': 'company',
                'confidence': 0.6
            })
        
        # Remove duplicates while preserving order and confidence
        seen_urls = set()
        unique_results = []
        for result in all_results:
            if result['url'] not in seen_urls:
                seen_urls.add(result['url'])
                unique_results.append(result)
        
        # Sort by confidence (highest first)
        unique_results.sort(key=lambda x: x['confidence'], reverse=True)
        
        print(f"[RESULTS] Total unique images found: {len(unique_results)}")
        return unique_results[:10]  # Return top 10 results
    
    def download_image(self, image_url: str, filename: str, max_retries: int = 3) -> bool:
        """Download image from URL and save with specified filename"""
        for attempt in range(max_retries):
            try:
                # Add proper extension if not present
                if not any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                    filename += '.jpg'
                
                filepath = os.path.join(self.output_dir, filename)
                
                # Skip if file already exists
                if os.path.exists(filepath):
                    print(f"File already exists: {filename}")
                    return True
                
                # Download image
                response = self.session.get(image_url, timeout=15, stream=True)
                response.raise_for_status()
                
                # Check if response contains image
                content_type = response.headers.get('content-type', '')
                if not content_type.startswith('image/'):
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    return False
                
                # Verify it's an image
                try:
                    img = Image.open(io.BytesIO(response.content))
                    img.verify()
                except Exception:
                    print(f"Invalid image format for {filename}")
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    return False
                
                # Save image
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                # Verify the downloaded file
                if os.path.getsize(filepath) < 1024:  # Less than 1KB
                    os.remove(filepath)
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    return False
                
                print(f"[SUCCESS] Downloaded: {filename}")
                return True
                
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Download attempt {attempt + 1} failed, retrying...")
                    time.sleep(2)
                else:
                    print(f"[ERROR] Failed to download {filename} after {max_retries} attempts: {e}")
                    return False
        
        return False
    
    def get_fallback_image_url(self, product_name: str) -> str:
        """Generate a deterministic fallback image URL based on product name"""
        # Create a deterministic seed from product name
        seed = abs(hash(product_name)) % 10000
        
        # List of fallback image services
        fallback_services = [
            f"https://picsum.photos/400/400?random={seed}",
            f"https://via.placeholder.com/400x400/CCCCCC/666666?text={quote(product_name[:20])}",
            f"https://dummyimage.com/400x400/f0f0f0/333&text={quote(product_name[:15])}",
            f"https://source.unsplash.com/400x400/?product,{quote(product_name[:10])}"
        ]
        
        # Return different service based on seed
        return fallback_services[seed % len(fallback_services)]

# Usage example and CLI interface
if __name__ == "__main__":
    import sys
    import argparse
    
    def main():
        parser = argparse.ArgumentParser(description='Product Image Downloader')
        parser.add_argument('--product', '-p', required=True, help='Product name to search')
        parser.add_argument('--brand', '-b', default='', help='Brand name (optional)')
        parser.add_argument('--filename', '-f', help='Output filename (optional)')
        parser.add_argument('--output-dir', '-o', default='product_images', help='Output directory')
        parser.add_argument('--search-only', '-s', action='store_true', help='Only search, do not download')
        
        args = parser.parse_args()
        
        # Initialize downloader
        downloader = ProductImageDownloader(output_dir=args.output_dir)
        
        print(f"Product Image Downloader")
        print(f"========================\n")
        
        # Search for images
        results = downloader.search_product_images(args.product, args.brand)
        
        if not results:
            print(f"[ERROR] No images found for {args.product}")
            # Try fallback image
            fallback_url = downloader.get_fallback_image_url(args.product)
            print(f"[FALLBACK] Using fallback image: {fallback_url}")
            results = [{'url': fallback_url, 'source': 'fallback', 'confidence': 0.1}]
        
        if args.search_only:
            print(f"\n[RESULTS] Found {len(results)} images:")
            for i, result in enumerate(results, 1):
                print(f"{i}. {result['source']} (confidence: {result['confidence']}) - {result['url']}")
            return
        
        # Download the best image
        if results:
            best_result = results[0]
            filename = args.filename or f"{args.product.replace(' ', '_').lower()}.jpg"
            
            print(f"\n[DOWNLOAD] Downloading best image from {best_result['source']}...")
            success = downloader.download_image(best_result['url'], filename)
            
            if not success and len(results) > 1:
                print(f"[RETRY] Trying alternative images...")
                for result in results[1:5]:  # Try next 4 images
                    if downloader.download_image(result['url'], filename):
                        success = True
                        break
            
            if success:
                print(f"\n[SUCCESS] Successfully downloaded image for {args.product}")
            else:
                print(f"\n[ERROR] Failed to download any image for {args.product}")
    
    if __name__ == "__main__":
        main()