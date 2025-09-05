import os
import time
import requests
import pandas as pd
from urllib.parse import quote
from bs4 import BeautifulSoup
import urllib.request
from PIL import Image
import io

class HULImageDownloader:
    def __init__(self, csv_file_path, output_dir="hul_images"):
        self.csv_file_path = csv_file_path
        self.output_dir = output_dir
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Create output directory if it doesn't exist
        os.makedirs(self.output_dir, exist_ok=True)
        
    def load_products(self):
        """Load products from CSV file"""
        try:
            df = pd.read_csv(self.csv_file_path)
            print(f"Loaded {len(df)} products from CSV")
            return df
        except Exception as e:
            print(f"Error loading CSV: {e}")
            return None
    
    def search_google_images(self, product_name, brand_name=""):
        """Search for images on Google Images"""
        try:
            # Create search query
            search_query = f"{brand_name} {product_name} product image".strip()
            encoded_query = quote(search_query)
            
            # Google Images search URL
            url = f"https://www.google.com/search?q={encoded_query}&tbm=isch&safe=active"
            
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find image URLs
            image_urls = []
            
            # Method 1: Look for img tags with data-src
            img_tags = soup.find_all('img')
            for img in img_tags:
                src = img.get('data-src') or img.get('src')
                if src and src.startswith('http') and any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                    image_urls.append(src)
            
            # Method 2: Look for JSON data containing image URLs
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string and '"ou":' in script.string:
                    import re
                    urls = re.findall(r'"ou":"([^"]+)"', script.string)
                    for url in urls:
                        if any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                            image_urls.append(url.replace('\\u003d', '=').replace('\\u0026', '&'))
            
            return list(set(image_urls))[:10]  # Return first 10 unique URLs
            
        except Exception as e:
            print(f"Error searching Google Images for {product_name}: {e}")
            return []
    
    def search_bing_images(self, product_name, brand_name=""):
        """Search for images on Bing Images as fallback"""
        try:
            search_query = f"{brand_name} {product_name} product image".strip()
            encoded_query = quote(search_query)
            
            url = f"https://www.bing.com/images/search?q={encoded_query}&form=HDRSC2&first=1&tsc=ImageBasicHover"
            
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            image_urls = []
            
            # Look for image URLs in Bing's structure
            img_tags = soup.find_all('img', {'class': 'mimg'})
            for img in img_tags:
                src = img.get('data-src') or img.get('src')
                if src and src.startswith('http'):
                    image_urls.append(src)
            
            return image_urls[:5]  # Return first 5 URLs
            
        except Exception as e:
            print(f"Error searching Bing Images for {product_name}: {e}")
            return []
    
    def search_wikipedia_images(self, product_name, brand_name=""):
        """Search for images on Wikipedia"""
        try:
            search_query = f"{brand_name} {product_name}".strip()
            encoded_query = quote(search_query)
            
            # Wikipedia search URL
            url = f"https://en.wikipedia.org/wiki/Special:Search?search={encoded_query}&go=Go"
            
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            image_urls = []
            
            # Look for images in Wikipedia articles
            img_tags = soup.find_all('img')
            for img in img_tags:
                src = img.get('src')
                if src and ('upload.wikimedia.org' in src or src.startswith('//')): 
                    if src.startswith('//'):
                        src = 'https:' + src
                    if any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        image_urls.append(src)
            
            return image_urls[:3]  # Return first 3 URLs
            
        except Exception as e:
            print(f"Error searching Wikipedia for {product_name}: {e}")
            return []
    
    def search_company_websites(self, product_name, brand_name=""):
        """Search for images on company websites"""
        try:
            # Common company domains for HUL brands
            company_domains = {
                'unilever': 'unilever.com',
                'hindustan unilever': 'hul.co.in',
                'surf': 'surf.co.in',
                'dove': 'dove.com',
                'lifebuoy': 'lifebuoy.co.in',
                'ponds': 'ponds.com',
                'brooke bond': 'brookebond.co.in',
                'rin': 'rin.co.in',
                'wheel': 'wheel.co.in'
            }
            
            brand_lower = brand_name.lower()
            domain = None
            
            # Find matching domain
            for key, value in company_domains.items():
                if key in brand_lower or key in product_name.lower():
                    domain = value
                    break
            
            if not domain:
                return []
            
            # Search for product on company website
            search_query = f"site:{domain} {product_name}"
            encoded_query = quote(search_query)
            
            url = f"https://www.google.com/search?q={encoded_query}&tbm=isch"
            
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            image_urls = []
            
            # Look for images from company domain
            img_tags = soup.find_all('img')
            for img in img_tags:
                src = img.get('data-src') or img.get('src')
                if src and domain in src and any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                    image_urls.append(src)
            
            return image_urls[:3]  # Return first 3 URLs
            
        except Exception as e:
            print(f"Error searching company websites for {product_name}: {e}")
            return []
    
    def download_image(self, image_url, filename):
        """Download image from URL and save with specified filename"""
        max_retries = 3
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
                response = requests.get(image_url, headers=self.headers, timeout=15, stream=True)
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
                if os.path.getsize(filepath) < 1024:  # Less than 1KB, probably not a valid image
                    os.remove(filepath)
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    return False
                
                print(f"✅ Downloaded: {filename}")
                return True
                
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Download attempt {attempt + 1} failed, retrying...")
                    time.sleep(2)
                else:
                    print(f"❌ Failed to download {filename} after {max_retries} attempts: {e}")
                    return False
        
        return False
    
    def download_product_images(self, max_products=None, delay=2):
        """Download images for all products in the CSV"""
        try:
            df = self.load_products()
            if df is None:
                return 0
            
            if max_products:
                df = df.head(max_products)
            
            successful_downloads = 0
            failed_downloads = 0
            
            print(f"Starting download for {len(df)} products...\n")
        
            for index, row in df.iterrows():
                product_name = row.get('name', '')
                brand_name = row.get('brand', '')
                image_filename = row.get('image_filename', '')
                
                if not product_name or not image_filename:
                    print(f"Skipping row {index}: Missing product name or image filename")
                    continue
                
                print(f"\n[{index+1}/{len(df)}] Processing: {product_name}")
                
                # Search for images from multiple sources
                image_urls = []
                
                # 1. Try Google Images first
                google_urls = self.search_google_images(product_name, brand_name)
                if google_urls:
                    image_urls.extend(google_urls)
                else:
                    print("Google search failed, trying other sources...")
                
                # 2. Try Bing Images
                bing_urls = self.search_bing_images(product_name, brand_name)
                if bing_urls:
                    image_urls.extend(bing_urls)
                    if not google_urls:
                        print("Found images on Bing")
                
                # 3. Try Wikipedia
                wiki_urls = self.search_wikipedia_images(product_name, brand_name)
                if wiki_urls:
                    image_urls.extend(wiki_urls)
                    print("Found images on Wikipedia")
                
                # 4. Try company websites
                company_urls = self.search_company_websites(product_name, brand_name)
                if company_urls:
                    image_urls.extend(company_urls)
                    print("Found images on company website")
                
                # Remove duplicates while preserving order
                seen = set()
                unique_urls = []
                for url in image_urls:
                    if url not in seen:
                        seen.add(url)
                        unique_urls.append(url)
                
                image_urls = unique_urls
                
                if not image_urls:
                    print(f"❌ No images found for {product_name}")
                    failed_downloads += 1
                    continue
                
                # Try to download the first few images until one succeeds
                downloaded = False
                for i, url in enumerate(image_urls[:5]):  # Try first 5 URLs from all sources
                    try:
                        if self.download_image(url, image_filename):
                            successful_downloads += 1
                            downloaded = True
                            break
                        elif i < 4:  # Don't print for the last attempt
                            print(f"Trying next URL...")
                    except Exception as e:
                        print(f"Download attempt {i+1} failed: {e}")
                        if i < 4:
                            print(f"Trying next URL...")
                
                if not downloaded:
                    failed_downloads += 1
                    print(f"❌ Failed to download any image for {product_name}")
                
                # Add delay to avoid being blocked
                time.sleep(delay)
                
                # Add progress update every 10 products
                if (index + 1) % 10 == 0:
                    print(f"\n📊 Progress: {index + 1}/{len(df)} products processed")
                    print(f"✅ Successful: {successful_downloads}, ❌ Failed: {failed_downloads}")
                    print("-" * 50)
            
            print(f"\n=== Download Summary ===")
            print(f"✅ Successful: {successful_downloads}")
            print(f"❌ Failed: {failed_downloads}")
            print(f"📁 Images saved to: {self.output_dir}")
            return successful_downloads
                
        except KeyboardInterrupt:
            print(f"\n⚠️ Process interrupted by user")
            print(f"📊 Final Stats: {successful_downloads} successful, {failed_downloads} failed")
            return successful_downloads
        except Exception as e:
            print(f"Error processing products: {e}")
            print(f"📊 Partial Stats: {successful_downloads} successful, {failed_downloads} failed")
            return successful_downloads
    
    def download_specific_products(self, product_names, delay=2):
        """Download images for specific products by name"""
        df = self.load_products()
        if df is None:
            return
        
        # Filter for specific products
        filtered_df = df[df['name'].isin(product_names)]
        
        if filtered_df.empty:
            print("No matching products found")
            return
        
        print(f"Found {len(filtered_df)} matching products")
        
        for index, row in filtered_df.iterrows():
            product_name = row['name']
            brand_name = row.get('brand', '')
            image_filename = row['image_filename']
            
            print(f"\nProcessing: {product_name}")
            
            image_urls = self.search_google_images(product_name, brand_name)
            
            if not image_urls:
                image_urls = self.search_bing_images(product_name, brand_name)
            
            if image_urls:
                for url in image_urls[:3]:
                    if self.download_image(url, image_filename):
                        break
            else:
                print(f"❌ No images found for {product_name}")
            
            time.sleep(delay)

# Usage example
if __name__ == "__main__":
    import sys
    
    # Initialize downloader
    csv_path = "HUL product lists.csv"
    downloader = HULImageDownloader(csv_path)
    
    print("HUL Product Image Downloader")
    print("============================\n")
    
    # Check command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--all":
            max_products = int(sys.argv[2]) if len(sys.argv) > 2 else None
            print(f"Downloading images for {'all' if not max_products else max_products} products...")
            downloader.download_product_images(max_products=max_products)
        elif sys.argv[1] == "--sample":
            # Download sample products
            specific_products = [
                "Surf Excel Matic Front Load",
                "Dove Beauty Bar",
                "Lifebuoy Total Soap",
                "Pond's White Beauty Cream",
                "Brooke Bond Red Label Tea"
            ]
            print("Downloading images for sample products...")
            downloader.download_specific_products(specific_products)
        elif sys.argv[1] == "--help":
            print("Usage:")
            print("  py hul_image_downloader.py                   # Download all products one by one")
            print("  py hul_image_downloader.py --sample          # Download 5 sample products")
            print("  py hul_image_downloader.py --all [number]    # Download all or specified number of products")
            print("  py hul_image_downloader.py --help            # Show this help message")
            sys.exit(0)
    else:
        # Default: Download all products one by one
        print("Downloading images for all products one by one...")
        print("(Use --help for more options)\n")
        downloader.download_product_images()
    
    print("\nDownload completed!")