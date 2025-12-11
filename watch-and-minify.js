const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const sourceFile = path.join(__dirname, 'LibraryScripts.js');
const distDir = path.join(__dirname, 'dist');
const outputFile = path.join(distDir, 'LibraryScripts.min.js');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

console.log(`Watching ${sourceFile} for changes...`);
console.log(`Output will be written to ${outputFile}`);
console.log('Press Ctrl+C to stop watching.\n');

// Function to perform minification
async function performMinification() {
    try {
        const code = fs.readFileSync(sourceFile, 'utf8');
        
        // Extract libAccts line to preserve it
        const libAcctsMatch = code.match(/const\s+libAccts\s*=\s*\[[^\]]+\];?/);
        const libAcctsLine = libAcctsMatch ? libAcctsMatch[0].replace(/;\s*$/, '') + ';' : '';
        
        // Remove libAccts from code for minification (we'll add it back)
        const codeWithoutLibAccts = code.replace(/const\s+libAccts\s*=\s*\[[^\]]+\];?\s*/g, '');
        
        // Minify using terser with aggressive settings
        const result = await minify(codeWithoutLibAccts, {
            compress: {
                drop_console: false, // Keep console.log
                passes: 2,
                unsafe: true,
                unsafe_comps: true,
                unsafe_math: true,
                unsafe_methods: true,
                unsafe_proto: true,
                unsafe_regexp: true,
                unsafe_undefined: true,
            },
            mangle: {
                toplevel: false, // Don't mangle top-level names that might be called externally
                properties: false, // Don't mangle properties
            },
            format: {
                quote_style: 2, // Use double quotes
                preserve_annotations: false,
            },
        });
        
        if (result.error) {
            throw result.error;
        }
        
        // Combine libAccts with minified code
        const finalCode = libAcctsLine + result.code.trim();
        
        // Write the final minified code
        fs.writeFileSync(outputFile, finalCode, 'utf8');
        
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Minified ${sourceFile} → ${outputFile}`);
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] ✗ Error:`, error.message);
    }
}

// Initial minification
performMinification();

// Watch for file changes
fs.watchFile(sourceFile, { interval: 500 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
        performMinification();
    }
});
