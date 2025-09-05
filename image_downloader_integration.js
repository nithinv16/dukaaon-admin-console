// Integration script to use Python image downloader from Node.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PythonImageDownloader {
    constructor(outputDir = 'product_images') {
        this.outputDir = outputDir;
        this.pythonScript = path.join(__dirname, 'product_image_downloader.py');
    }

    /**
     * Search for product images using Python script
     * @param {string} productName - Name of the product
     * @param {string} brandName - Brand name (optional)
     * @returns {Promise<Array>} Array of image results
     */
    async searchProductImages(productName, brandName = '') {
        return new Promise((resolve, reject) => {
            const args = [
                this.pythonScript,
                '--product', productName,
                '--search-only'
            ];

            if (brandName) {
                args.push('--brand', brandName);
            }

            args.push('--output-dir', this.outputDir);

            const pythonProcess = spawn('py', args);
            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    // Parse the output to extract image URLs
                    const results = this.parseSearchOutput(output);
                    resolve(results);
                } else {
                    reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }

    /**
     * Download product image using Python script
     * @param {string} productName - Name of the product
     * @param {string} brandName - Brand name (optional)
     * @param {string} filename - Output filename (optional)
     * @returns {Promise<string>} Path to downloaded image
     */
    async downloadProductImage(productName, brandName = '', filename = null) {
        return new Promise((resolve, reject) => {
            const args = [
                this.pythonScript,
                '--product', productName
            ];

            if (brandName) {
                args.push('--brand', brandName);
            }

            if (filename) {
                args.push('--filename', filename);
            }

            args.push('--output-dir', this.outputDir);

            const pythonProcess = spawn('py', args);
            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    // Extract filename from output
                    const downloadedFile = this.extractDownloadedFilename(output, productName, filename);
                    const fullPath = path.join(this.outputDir, downloadedFile);
                    
                    if (fs.existsSync(fullPath)) {
                        resolve(fullPath);
                    } else {
                        reject(new Error('Image was not downloaded successfully'));
                    }
                } else {
                    reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }

    /**
     * Parse search output to extract image results
     * @param {string} output - Raw output from Python script
     * @returns {Array} Parsed image results
     */
    parseSearchOutput(output) {
        const results = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Look for lines with image information
            const match = line.match(/(\d+)\. (\w+) \(confidence: ([\d.]+)\) - (.+)/);
            if (match) {
                results.push({
                    index: parseInt(match[1]),
                    source: match[2],
                    confidence: parseFloat(match[3]),
                    url: match[4]
                });
            }
        }
        
        return results;
    }

    /**
     * Extract downloaded filename from output
     * @param {string} output - Raw output from Python script
     * @param {string} productName - Product name
     * @param {string} filename - Specified filename
     * @returns {string} Downloaded filename
     */
    extractDownloadedFilename(output, productName, filename) {
        // Look for "Downloaded: filename" in output
        const match = output.match(/✅ Downloaded: (.+)/);
        if (match) {
            return match[1].trim();
        }
        
        // Fallback to expected filename
        return filename || `${productName.replace(/\s+/g, '_').toLowerCase()}.jpg`;
    }

    /**
     * Check if Python and required packages are installed
     * @returns {Promise<boolean>} True if setup is valid
     */
    async checkSetup() {
        return new Promise((resolve) => {
            const pythonProcess = spawn('py', ['--version']);
            
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    // Check if required packages are installed
                    const pipProcess = spawn('py', ['-c', 'import requests, bs4, PIL; print("OK")']);
                    
                    pipProcess.on('close', (pipCode) => {
                        resolve(pipCode === 0);
                    });
                    
                    pipProcess.on('error', () => {
                        resolve(false);
                    });
                } else {
                    resolve(false);
                }
            });
            
            pythonProcess.on('error', () => {
                resolve(false);
            });
        });
    }
}

// Usage example
async function example() {
    const downloader = new PythonImageDownloader('downloaded_images');
    
    try {
        // Check if setup is valid
        const isSetupValid = await downloader.checkSetup();
        if (!isSetupValid) {
            console.error('Python or required packages not installed. Run: pip install -r requirements.txt');
            return;
        }
        
        // Search for images
        console.log('Searching for images...');
        const searchResults = await downloader.searchProductImages('Surf Excel', 'Unilever');
        console.log('Search results:', searchResults);
        
        // Download image
        console.log('Downloading image...');
        const imagePath = await downloader.downloadProductImage('Surf Excel', 'Unilever');
        console.log('Downloaded image to:', imagePath);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Export for use in other modules
module.exports = PythonImageDownloader;

// Run example if this file is executed directly
if (require.main === module) {
    example();
}