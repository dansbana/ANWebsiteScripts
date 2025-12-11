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

async function minifyNow() {
    try {
        const code = fs.readFileSync(sourceFile, 'utf8');
        
        // Extract libAccts line to preserve it
        const libAcctsMatch = code.match(/const\s+libAccts\s*=\s*\[[^\]]+\];?/);
        const libAcctsLine = libAcctsMatch ? libAcctsMatch[0].replace(/;\s*$/, '') + ';' : '';
        
        // Remove libAccts from code for minification
        const codeWithoutLibAccts = code.replace(/const\s+libAccts\s*=\s*\[[^\]]+\];?\s*/g, '');
        
        // Minify using terser
        const result = await minify(codeWithoutLibAccts, {
            compress: {
                drop_console: false,
                passes: 2,
                unsafe: true,
            },
            mangle: {
                toplevel: false,
                properties: false,
            },
            format: {
                quote_style: 2,
            },
        });
        
        if (result.error) {
            throw result.error;
        }
        
        // Combine libAccts with minified code
        const finalCode = libAcctsLine + result.code.trim();
        fs.writeFileSync(outputFile, finalCode, 'utf8');
        
        console.log(`✓ Minified ${sourceFile} → ${outputFile}`);
    } catch (error) {
        console.error('✗ Error:', error.message);
        process.exit(1);
    }
}

minifyNow();

