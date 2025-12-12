const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const sourceFile = path.join(__dirname, 'LibraryScripts.js');
const distDir = path.join(__dirname, 'dist');
const outputFile = path.join(distDir, 'LibraryScripts.min.js');
const prodDir = path.join(__dirname, 'prod');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Ensure prod directory exists
if (!fs.existsSync(prodDir)) {
    fs.mkdirSync(prodDir, { recursive: true });
}

console.log(`Watching ${sourceFile} for changes...`);
console.log(`Output will be written to ${outputFile}`);
console.log('Press Ctrl+C to stop watching.\n');

// Helper function to get version and calculate next increment
function getVersionInfo() {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;
    
    // Check both dist and prod directories to find the highest increment
    const distFiles = fs.existsSync(distDir) ? fs.readdirSync(distDir) : [];
    const prodFiles = fs.existsSync(prodDir) ? fs.readdirSync(prodDir) : [];
    const allFiles = [...distFiles, ...prodFiles];
    
    const versionPattern = new RegExp(`^LibraryScriptsV${version.replace(/\./g, '\\.')}\\.(\\d+)(?:\\.min)?\\.js$`);
    
    let maxIncrement = 0;
    
    allFiles.forEach(file => {
        const match = file.match(versionPattern);
        if (match) {
            const increment = parseInt(match[1], 10);
            if (increment > maxIncrement) {
                maxIncrement = increment;
            }
        }
    });
    
    return { version, nextIncrement: maxIncrement + 1 };
}

// Function to copy unminified file to prod with versioning
function copyToProdWithVersioning(versionInfo) {
    try {
        const { version, nextIncrement } = versionInfo;
        
        // Read the source file (unminified)
        const code = fs.readFileSync(sourceFile, 'utf8');
        
        // Find all existing versioned files in prod directory
        const files = fs.readdirSync(prodDir);
        const versionPattern = new RegExp(`^LibraryScriptsV${version.replace(/\./g, '\\.')}\\.(\\d+)\\.js$`);
        
        const versionedFiles = [];
        files.forEach(file => {
            if (file.match(versionPattern)) {
                versionedFiles.push(file);
            }
        });
        
        // Create new versioned file
        const newFileName = `LibraryScriptsV${version}.${nextIncrement}.js`;
        const newFilePath = path.join(prodDir, newFileName);
        fs.writeFileSync(newFilePath, code, 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Copied to prod: ${newFileName}`);
        
        // Delete old versioned files (but keep unversioned ones)
        versionedFiles.forEach(file => {
            const oldFilePath = path.join(prodDir, file);
            fs.unlinkSync(oldFilePath);
            console.log(`[${new Date().toLocaleTimeString()}] ✓ Deleted old prod version: ${file}`);
        });
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] ✗ Error copying to prod:`, error.message);
    }
}

// Function to create minified versioned file in dist
function createMinifiedVersionedFile(minifiedCode, versionInfo) {
    try {
        const { version, nextIncrement } = versionInfo;
        
        // Find all existing versioned minified files in dist directory
        const files = fs.readdirSync(distDir);
        const versionPattern = new RegExp(`^LibraryScriptsV${version.replace(/\./g, '\\.')}\\.(\\d+)\\.min\\.js$`);
        
        const versionedFiles = [];
        files.forEach(file => {
            if (file.match(versionPattern)) {
                versionedFiles.push(file);
            }
        });
        
        // Create new versioned minified file
        const newFileName = `LibraryScriptsV${version}.${nextIncrement}.min.js`;
        const newFilePath = path.join(distDir, newFileName);
        fs.writeFileSync(newFilePath, minifiedCode, 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Created minified version: ${newFileName}`);
        
        // Delete old versioned minified files (but keep unversioned ones like LibraryScripts.min.js)
        versionedFiles.forEach(file => {
            const oldFilePath = path.join(distDir, file);
            fs.unlinkSync(oldFilePath);
            console.log(`[${new Date().toLocaleTimeString()}] ✓ Deleted old dist version: ${file}`);
        });
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] ✗ Error creating minified version:`, error.message);
    }
}

// Function to perform minification and create versioned files
async function performMinification() {
    try {
        // Get version info (shared between dist and prod)
        const versionInfo = getVersionInfo();
        
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
        
        // Write the standard minified code (non-versioned)
        fs.writeFileSync(outputFile, finalCode, 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Minified ${sourceFile} → ${outputFile}`);
        
        // Create versioned minified file in dist
        createMinifiedVersionedFile(finalCode, versionInfo);
        
        // Copy unminified file to prod with versioning
        copyToProdWithVersioning(versionInfo);
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
