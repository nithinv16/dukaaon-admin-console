#!/usr/bin/env python3
"""
Product Image Scraper

A multi-source image scraper for product images that searches Google, Bing,
and e-commerce sites, with image quality scoring.

**Feature: ai-product-extraction**
**Validates: Requirements 5.2, 5.3**
"""

import os
import sys
import json
import time
import hashlib
import argparse
import requests
from urllib.parse import quote, urlparse
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from bs4 import BeautifulSoup
from PIL import Image
import io
import re


@dataclass
class ImageResult:
    """Represents a scraped image result with quality metrics."""
    url: str
    source: str
    quality_score: float
    width: int = 0
    height: int = 0
    file_size: int = 0
    format: str = ""
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ScrapeResult:
    """Result of a scrape operation."""
    success: bool
    product_name: str
    brand_name: str
    images: List[ImageResult]
    best_image: Optional[ImageResult]
    local_path: Optional[str]
    sources_searched: List[str]
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'success': self.success,
            'product_name': self.product_name,
            'brand_name': self.brand_name,
            'images': [img.to_dict() for img in self.images],
            'best_image': self.best_image.to_dict() if self.best_image else None,
            'local_path': self.local_path,
            'sources_searched': self.sources_searched,
            'error': self.error
        }
        return result


class ProductImageScraper:
    """
    Multi-source product image scraper with quality scoring.
    
    Searches multiple sources (Google, Bing, e-commerce) and scores images
    based on quality metrics like resolution, file size, and format.
    """

    # Minimum number of sources to search (Property 12 requirement)
    MIN_SOURCES = 2

    def __init__(self, output_dir: str = "scraped_images"):
        self.output_dir = output_dir
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
        # E-commerce site patterns for product images
        self.ecommerce_domains = {
            'amazon': ['amazon.com', 'amazon.in', 'amazon.co.uk'],
            'flipkart': ['flipkart.com'],
            'walmart': ['walmart.com'],
            'target': ['target.com'],
            'bigbasket': ['bigbasket.com'],
            'jiomart': ['jiomart.com'],
        }
        
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def _is_valid_image_url(self, url: str) -> bool:
        """Check if URL appears to be a valid image URL."""
        if not url or not isinstance(url, str):
            return False
        
        url_lower = url.lower()
        
        # Check for image extensions
        image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']
        has_extension = any(ext in url_lower for ext in image_extensions)
        
        # Check for image-related URL patterns
        image_patterns = ['image', 'photo', 'picture', '/img/', '/images/', 'thumbnail', 'product']
        has_pattern = any(pattern in url_lower for pattern in image_patterns)
        
        # Exclude common non-image patterns
        exclude_patterns = ['logo', 'icon', 'sprite', 'button', 'banner', 'ad', 'tracking']
        is_excluded = any(pattern in url_lower for pattern in exclude_patterns)
        
        return (has_extension or has_pattern) and not is_excluded

    def _calculate_quality_score(self, width: int, height: int, file_size: int, format: str) -> float:
        """
        Calculate image quality score based on dimensions, file size, and format.
        
        Score is between 0 and 1, with higher being better.
        """
        score = 0.0
        
        # Resolution score (40% weight) - prefer images around 400-800px
        min_dim = min(width, height)
        max_dim = max(width, height)
        
        if min_dim >= 400 and max_dim <= 1200:
            # Ideal size range
            score += 0.4
        elif min_dim >= 200 and max_dim <= 2000:
            # Acceptable size range
            score += 0.3
        elif min_dim >= 100:
            # Minimum acceptable
            score += 0.15
        
        # Aspect ratio score (20% weight) - prefer square-ish images for products
        if width > 0 and height > 0:
            aspect_ratio = max(width, height) / min(width, height)
            if aspect_ratio <= 1.5:
                score += 0.2
            elif aspect_ratio <= 2.0:
                score += 0.1
        
        # File size score (20% weight) - prefer reasonable file sizes
        if file_size > 0:
            if 10000 <= file_size <= 500000:  # 10KB to 500KB
                score += 0.2
            elif 5000 <= file_size <= 1000000:  # 5KB to 1MB
                score += 0.1
        
        # Format score (20% weight)
        format_scores = {
            'jpeg': 0.2,
            'jpg': 0.2,
            'png': 0.18,
            'webp': 0.15,
            'gif': 0.05,
        }
        score += format_scores.get(format.lower(), 0.05)
        
        return min(score, 1.0)

    def _get_image_info(self, url: str) -> Tuple[int, int, int, str]:
        """
        Fetch image and get its dimensions, file size, and format.
        Returns (width, height, file_size, format) or (0, 0, 0, "") on error.
        """
        try:
            response = self.session.get(url, timeout=10, stream=True)
            response.raise_for_status()
            
            content = response.content
            file_size = len(content)
            
            # Verify it's an image and get dimensions
            img = Image.open(io.BytesIO(content))
            width, height = img.size
            img_format = img.format or ""
            
            return width, height, file_size, img_format.lower()
        except Exception:
            return 0, 0, 0, ""

    def search_google_images(self, product_name: str, brand_name: str = "") -> List[ImageResult]:
        """Search Google Images for product images."""
        results = []
        
        try:
            search_query = f"{brand_name} {product_name} product".strip()
            encoded_query = quote(search_query)
            url = f"https://www.google.com/search?q={encoded_query}&tbm=isch&safe=active"
            
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            image_urls = []
            
            # Method 1: Look for img tags
            for img in soup.find_all('img'):
                src = img.get('data-src') or img.get('src')
                if src and src.startswith('http') and self._is_valid_image_url(src):
                    image_urls.append(src)
            
            # Method 2: Extract from JSON data
            for script in soup.find_all('script'):
                if script.string and '"ou":' in script.string:
                    urls = re.findall(r'"ou":"([^"]+)"', script.string)
                    for u in urls:
                        decoded = u.replace('\\u003d', '=').replace('\\u0026', '&')
                        if self._is_valid_image_url(decoded):
                            image_urls.append(decoded)
            
            # Remove duplicates and limit
            unique_urls = list(dict.fromkeys(image_urls))[:10]
            
            for url in unique_urls:
                results.append(ImageResult(
                    url=url,
                    source='google',
                    quality_score=0.0  # Will be calculated later
                ))
                
        except Exception as e:
            results.append(ImageResult(
                url="",
                source='google',
                quality_score=0.0,
                error=str(e)
            ))
        
        return results

    def search_bing_images(self, product_name: str, brand_name: str = "") -> List[ImageResult]:
        """Search Bing Images for product images."""
        results = []
        
        try:
            search_query = f"{brand_name} {product_name} product".strip()
            encoded_query = quote(search_query)
            url = f"https://www.bing.com/images/search?q={encoded_query}&form=HDRSC2"
            
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            image_urls = []
            
            # Look for image URLs in Bing's structure
            for img in soup.find_all('img', {'class': 'mimg'}):
                src = img.get('data-src') or img.get('src')
                if src and src.startswith('http') and self._is_valid_image_url(src):
                    image_urls.append(src)
            
            # Fallback: general img tags
            if not image_urls:
                for img in soup.find_all('img'):
                    src = img.get('data-src') or img.get('src')
                    if src and src.startswith('http') and self._is_valid_image_url(src):
                        image_urls.append(src)
            
            unique_urls = list(dict.fromkeys(image_urls))[:8]
            
            for url in unique_urls:
                results.append(ImageResult(
                    url=url,
                    source='bing',
                    quality_score=0.0
                ))
                
        except Exception as e:
            results.append(ImageResult(
                url="",
                source='bing',
                quality_score=0.0,
                error=str(e)
            ))
        
        return results

    def search_ecommerce(self, product_name: str, brand_name: str = "") -> List[ImageResult]:
        """Search e-commerce sites for product images."""
        results = []
        
        try:
            # Use Google to search e-commerce sites
            search_query = f"{brand_name} {product_name} site:amazon.com OR site:flipkart.com OR site:walmart.com".strip()
            encoded_query = quote(search_query)
            url = f"https://www.google.com/search?q={encoded_query}&tbm=isch&safe=active"
            
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            image_urls = []
            
            # Extract image URLs
            for script in soup.find_all('script'):
                if script.string and '"ou":' in script.string:
                    urls = re.findall(r'"ou":"([^"]+)"', script.string)
                    for u in urls:
                        decoded = u.replace('\\u003d', '=').replace('\\u0026', '&')
                        # Check if from e-commerce domain
                        parsed = urlparse(decoded)
                        is_ecommerce = any(
                            domain in parsed.netloc 
                            for domains in self.ecommerce_domains.values() 
                            for domain in domains
                        )
                        if is_ecommerce and self._is_valid_image_url(decoded):
                            image_urls.append(decoded)
            
            unique_urls = list(dict.fromkeys(image_urls))[:5]
            
            for url in unique_urls:
                results.append(ImageResult(
                    url=url,
                    source='ecommerce',
                    quality_score=0.0
                ))
                
        except Exception as e:
            results.append(ImageResult(
                url="",
                source='ecommerce',
                quality_score=0.0,
                error=str(e)
            ))
        
        return results


    def scrape_product_images(
        self, 
        product_name: str, 
        brand_name: str = "",
        download: bool = False,
        product_id: Optional[str] = None
    ) -> ScrapeResult:
        """
        Search for product images from multiple sources.
        
        This method ensures at least MIN_SOURCES (2) are searched to satisfy
        Property 12: Multi-Source Image Search requirement.
        
        Args:
            product_name: Name of the product to search for
            brand_name: Optional brand name to improve search accuracy
            download: Whether to download the best image
            product_id: Optional product ID for filename generation
            
        Returns:
            ScrapeResult with all found images and the best one selected
        """
        all_results: List[ImageResult] = []
        sources_searched: List[str] = []
        
        # Search Google Images (Source 1)
        google_results = self.search_google_images(product_name, brand_name)
        valid_google = [r for r in google_results if r.url and not r.error]
        all_results.extend(valid_google)
        sources_searched.append('google')
        
        # Search Bing Images (Source 2)
        bing_results = self.search_bing_images(product_name, brand_name)
        valid_bing = [r for r in bing_results if r.url and not r.error]
        all_results.extend(valid_bing)
        sources_searched.append('bing')
        
        # Search E-commerce sites (Source 3 - bonus)
        ecommerce_results = self.search_ecommerce(product_name, brand_name)
        valid_ecommerce = [r for r in ecommerce_results if r.url and not r.error]
        all_results.extend(valid_ecommerce)
        if valid_ecommerce:
            sources_searched.append('ecommerce')
        
        # Verify we searched at least MIN_SOURCES
        if len(sources_searched) < self.MIN_SOURCES:
            return ScrapeResult(
                success=False,
                product_name=product_name,
                brand_name=brand_name,
                images=[],
                best_image=None,
                local_path=None,
                sources_searched=sources_searched,
                error=f"Failed to search minimum {self.MIN_SOURCES} sources"
            )
        
        # Remove duplicates by URL
        seen_urls = set()
        unique_results = []
        for result in all_results:
            if result.url not in seen_urls:
                seen_urls.add(result.url)
                unique_results.append(result)
        
        if not unique_results:
            return ScrapeResult(
                success=False,
                product_name=product_name,
                brand_name=brand_name,
                images=[],
                best_image=None,
                local_path=None,
                sources_searched=sources_searched,
                error="No images found from any source"
            )
        
        # Calculate quality scores for top candidates (limit to avoid too many requests)
        candidates = unique_results[:15]
        for result in candidates:
            width, height, file_size, img_format = self._get_image_info(result.url)
            result.width = width
            result.height = height
            result.file_size = file_size
            result.format = img_format
            result.quality_score = self._calculate_quality_score(width, height, file_size, img_format)
        
        # Sort by quality score (Property 13: Image Quality Selection)
        candidates.sort(key=lambda x: x.quality_score, reverse=True)
        
        # Select best image
        best_image = candidates[0] if candidates else None
        
        # Download if requested
        local_path = None
        if download and best_image and best_image.url:
            local_path = self.download_image(
                best_image.url, 
                product_name, 
                product_id
            )
        
        return ScrapeResult(
            success=True,
            product_name=product_name,
            brand_name=brand_name,
            images=candidates,
            best_image=best_image,
            local_path=local_path,
            sources_searched=sources_searched
        )

    def download_image(
        self, 
        url: str, 
        product_name: str, 
        product_id: Optional[str] = None,
        max_retries: int = 3
    ) -> Optional[str]:
        """
        Download image from URL and save to output directory.
        
        Args:
            url: Image URL to download
            product_name: Product name for filename
            product_id: Optional product ID for filename
            max_retries: Number of retry attempts
            
        Returns:
            Local file path if successful, None otherwise
        """
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=15, stream=True)
                response.raise_for_status()
                
                content = response.content
                
                # Verify it's a valid image
                try:
                    img = Image.open(io.BytesIO(content))
                    img.verify()
                    img_format = img.format.lower() if img.format else 'jpg'
                except Exception:
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    return None
                
                # Generate filename
                clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', product_name).lower().replace(' ', '_')
                timestamp = int(time.time() * 1000)
                
                if product_id:
                    filename = f"{clean_name}_{product_id}.{img_format}"
                else:
                    filename = f"{clean_name}_{timestamp}.{img_format}"
                
                filepath = os.path.join(self.output_dir, filename)
                
                # Save image
                with open(filepath, 'wb') as f:
                    f.write(content)
                
                # Verify file size
                if os.path.getsize(filepath) < 1024:  # Less than 1KB
                    os.remove(filepath)
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    return None
                
                return filepath
                
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                return None
        
        return None

    def validate_image(self, filepath: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Validate a downloaded image file.
        
        Args:
            filepath: Path to the image file
            
        Returns:
            Tuple of (is_valid, info_dict)
        """
        try:
            if not os.path.exists(filepath):
                return False, {'error': 'File does not exist'}
            
            file_size = os.path.getsize(filepath)
            if file_size < 1024:
                return False, {'error': 'File too small'}
            
            with Image.open(filepath) as img:
                width, height = img.size
                img_format = img.format
            
            return True, {
                'width': width,
                'height': height,
                'file_size': file_size,
                'format': img_format
            }
            
        except Exception as e:
            return False, {'error': str(e)}


def main():
    """CLI entry point for the image scraper."""
    parser = argparse.ArgumentParser(
        description='Product Image Scraper - Multi-source image search with quality scoring'
    )
    parser.add_argument(
        '--product', '-p',
        required=True,
        help='Product name to search for'
    )
    parser.add_argument(
        '--brand', '-b',
        default='',
        help='Brand name (optional)'
    )
    parser.add_argument(
        '--product-id', '-i',
        default=None,
        help='Product ID for filename (optional)'
    )
    parser.add_argument(
        '--output-dir', '-o',
        default='scraped_images',
        help='Output directory for downloaded images'
    )
    parser.add_argument(
        '--download', '-d',
        action='store_true',
        help='Download the best image'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )
    
    args = parser.parse_args()
    
    # Initialize scraper
    scraper = ProductImageScraper(output_dir=args.output_dir)
    
    # Perform search
    result = scraper.scrape_product_images(
        product_name=args.product,
        brand_name=args.brand,
        download=args.download,
        product_id=args.product_id
    )
    
    if args.json:
        # Output as JSON for API integration
        print(json.dumps(result.to_dict(), indent=2))
    else:
        # Human-readable output
        print(f"\n{'='*60}")
        print(f"Product Image Scraper Results")
        print(f"{'='*60}")
        print(f"Product: {result.product_name}")
        print(f"Brand: {result.brand_name or 'N/A'}")
        print(f"Success: {result.success}")
        print(f"Sources Searched: {', '.join(result.sources_searched)}")
        print(f"Images Found: {len(result.images)}")
        
        if result.best_image:
            print(f"\nBest Image:")
            print(f"  URL: {result.best_image.url}")
            print(f"  Source: {result.best_image.source}")
            print(f"  Quality Score: {result.best_image.quality_score:.2f}")
            print(f"  Dimensions: {result.best_image.width}x{result.best_image.height}")
            print(f"  Format: {result.best_image.format}")
        
        if result.local_path:
            print(f"\nDownloaded to: {result.local_path}")
        
        if result.error:
            print(f"\nError: {result.error}")
        
        print(f"{'='*60}\n")
    
    # Exit with appropriate code
    sys.exit(0 if result.success else 1)


if __name__ == '__main__':
    main()
