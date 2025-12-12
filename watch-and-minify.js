const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const sourceFile = path.join(__dirname, 'LibraryScripts.js');
const distDir = path.join(__dirname, 'dist');
const outputFile = path.join(distDir, 'LibraryScripts.min.js');
const prodDir = path.join(__dirname, 'prod');
const watcherDir = path.join(__dirname, '.watcher');
const watcherFile = path.join(watcherDir, 'LibraryScripts.js');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Ensure prod directory exists
if (!fs.existsSync(prodDir)) {
    fs.mkdirSync(prodDir, { recursive: true });
}

// Ensure watcher directory exists
if (!fs.existsSync(watcherDir)) {
    fs.mkdirSync(watcherDir, { recursive: true });
}

console.log(`Watching ${sourceFile} for changes...`);
console.log(`Output will be written to ${outputFile}`);
console.log('Press Ctrl+C to stop watching.\n');

// Helper function to get version and calculate next increment
function getVersionInfo() {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;
    const keepVersions = packageJson.keepVersions || [];
    
    // Check both dist and prod directories to find the highest increment
    const distFiles = fs.existsSync(distDir) ? fs.readdirSync(distDir) : [];
    const prodFiles = fs.existsSync(prodDir) ? fs.readdirSync(prodDir) : [];
    const allFiles = [...distFiles, ...prodFiles];
    
    // Match both old format (without dash) and new format (with dash) for backward compatibility
    const versionPattern = new RegExp(`^LibraryScripts-?V${version.replace(/\./g, '\\.')}\\.(\\d+)(?:\\.min)?\\.js$`);
    
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
    
    return { version, nextIncrement: maxIncrement + 1, keepVersions };
}

// Helper function to check if a file should be kept based on its version
function shouldKeepFile(fileName, keepVersions) {
    // Extract version from filename like "LibraryScripts-V1.0.7.1.js" or "LibraryScripts-V1.0.7.1.min.js"
    // Pattern: LibraryScripts-V{version}.{increment}.js or LibraryScripts-V{version}.{increment}.min.js
    const match = fileName.match(/^LibraryScripts-?V([\d.]+)\.\d+(?:\.min)?\.js$/);
    if (match) {
        const fileVersion = match[1];
        return keepVersions.includes(fileVersion);
    }
    return false;
}

// Function to copy unminified file to prod with versioning
function copyToProdWithVersioning(versionInfo) {
    try {
        const { version, nextIncrement } = versionInfo;
        
        // Read the source file (unminified)
        let code = fs.readFileSync(sourceFile, 'utf8');
        
        // Replace the version line with the actual version
        const versionString = `V${version}.${nextIncrement}`;
        code = code.replace(/window\.version\s*=\s*['"][^'"]*['"];?/g, `window.version = '${versionString}';`);
        
        // Find all existing versioned files in prod directory
        const files = fs.readdirSync(prodDir);
        const versionPattern = new RegExp(`^LibraryScripts-V${version.replace(/\./g, '\\.')}\\.(\\d+)\\.js$`);
        
        const versionedFiles = [];
        files.forEach(file => {
            if (file.match(versionPattern)) {
                versionedFiles.push(file);
            }
        });
        
        // Create new versioned file (with dash in filename)
        const newFileName = `LibraryScripts-V${version}.${nextIncrement}.js`;
        const newFilePath = path.join(prodDir, newFileName);
        fs.writeFileSync(newFilePath, code, 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Copied to prod: ${newFileName}`);
        
        // Delete old versioned files (but keep unversioned ones and versions in keepVersions list)
        versionedFiles.forEach(file => {
            if (shouldKeepFile(file, versionInfo.keepVersions)) {
                console.log(`[${new Date().toLocaleTimeString()}] ⊘ Kept prod version (in keepVersions): ${file}`);
                return;
            }
            const oldFilePath = path.join(prodDir, file);
            fs.unlinkSync(oldFilePath);
            console.log(`[${new Date().toLocaleTimeString()}] ✓ Deleted old prod version: ${file}`);
        });
        
        // Copy source file to watcher directory to track the last versioned state
        fs.writeFileSync(watcherFile, fs.readFileSync(sourceFile, 'utf8'), 'utf8');
        
        // Return the path to the newly created versioned file
        return newFilePath;
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] ✗ Error copying to prod:`, error.message);
        return null;
    }
}

// Function to create minified versioned file in dist
function createMinifiedVersionedFile(minifiedCode, versionInfo) {
    try {
        const { version, nextIncrement } = versionInfo;
        
        // Find all existing versioned minified files in dist directory
        const files = fs.readdirSync(distDir);
        const versionPattern = new RegExp(`^LibraryScripts-V${version.replace(/\./g, '\\.')}\\.(\\d+)\\.min\\.js$`);
        
        const versionedFiles = [];
        files.forEach(file => {
            if (file.match(versionPattern)) {
                versionedFiles.push(file);
            }
        });
        
        // Create new versioned minified file (with dash in filename)
        const newFileName = `LibraryScripts-V${version}.${nextIncrement}.min.js`;
        const newFilePath = path.join(distDir, newFileName);
        fs.writeFileSync(newFilePath, minifiedCode, 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Created minified version: ${newFileName}`);
        
        // Delete old versioned minified files (but keep unversioned ones and versions in keepVersions list)
        versionedFiles.forEach(file => {
            if (shouldKeepFile(file, versionInfo.keepVersions)) {
                console.log(`[${new Date().toLocaleTimeString()}] ⊘ Kept dist version (in keepVersions): ${file}`);
                return;
            }
            const oldFilePath = path.join(distDir, file);
            fs.unlinkSync(oldFilePath);
            console.log(`[${new Date().toLocaleTimeString()}] ✓ Deleted old dist version: ${file}`);
        });
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] ✗ Error creating minified version:`, error.message);
    }
}

// Function to check if files are different
function filesAreDifferent(file1, file2) {
    if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
        return true; // If either doesn't exist, consider them different
    }
    const content1 = fs.readFileSync(file1, 'utf8');
    const content2 = fs.readFileSync(file2, 'utf8');
    return content1 !== content2;
}

// Function to perform minification and create versioned files
async function performMinification(createVersioned = true) {
    try {
        // Only minify when creating a new version
        if (createVersioned) {
            // Get version info (shared between dist and prod)
            const versionInfo = getVersionInfo();
            
            // First, copy to prod with version replacement
            const versionedProdFile = copyToProdWithVersioning(versionInfo);
            if (!versionedProdFile) {
                throw new Error('Failed to create versioned file in prod');
            }
            
            // Read the versioned file from prod (which has the version number in it)
            const versionedCode = fs.readFileSync(versionedProdFile, 'utf8');
            
            // Extract libAccts line to preserve it
            const libAcctsMatch = versionedCode.match(/const\s+libAccts\s*=\s*\[[^\]]+\];?/);
            const libAcctsLine = libAcctsMatch ? libAcctsMatch[0].replace(/;\s*$/, '') + ';' : '';
            
            // Remove libAccts from code for minification (we'll add it back)
            const codeWithoutLibAccts = versionedCode.replace(/const\s+libAccts\s*=\s*\[[^\]]+\];?\s*/g, '');
            
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
            
            // Create versioned minified file in dist (from the versioned prod file)
            createMinifiedVersionedFile(finalCode, versionInfo);
            
            // Also minify the original source for the standard non-versioned file
            const originalCode = fs.readFileSync(sourceFile, 'utf8');
            const originalLibAcctsMatch = originalCode.match(/const\s+libAccts\s*=\s*\[[^\]]+\];?/);
            const originalLibAcctsLine = originalLibAcctsMatch ? originalLibAcctsMatch[0].replace(/;\s*$/, '') + ';' : '';
            const originalCodeWithoutLibAccts = originalCode.replace(/const\s+libAccts\s*=\s*\[[^\]]+\];?\s*/g, '');
            const originalResult = await minify(originalCodeWithoutLibAccts, {
                compress: {
                    drop_console: false,
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
                    toplevel: false,
                    properties: false,
                },
                format: {
                    quote_style: 2,
                    preserve_annotations: false,
                },
            });
            if (originalResult.error) {
                throw originalResult.error;
            }
            const originalFinalCode = originalLibAcctsLine + originalResult.code.trim();
            fs.writeFileSync(outputFile, originalFinalCode, 'utf8');
            console.log(`[${new Date().toLocaleTimeString()}] ✓ Minified ${sourceFile} → ${outputFile}`);
        }
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] ✗ Error:`, error.message);
    }
}

// Initial minification - check if versioned files should be created
if (fs.existsSync(watcherFile)) {
    if (filesAreDifferent(sourceFile, watcherFile)) {
        console.log('Source file differs from last versioned state. Creating new versioned files...\n');
        performMinification(true);
    } else {
        console.log('Source file unchanged since last version. Skipping versioned file creation.\n');
        performMinification(false);
    }
} else {
    const orangeBold = '\x1b[1m\x1b[38;5;208m';
    const reset = '\x1b[0m';
    console.warn(`${orangeBold}⚠ Warning: .watcher/LibraryScripts.js does not exist. No versioned files was created on startup.${reset}`);
    console.warn(`${orangeBold}   Versioned files will be created when LibraryScripts.js is modified.${reset}\n`);
    performMinification(false);
}

// Watch for file changes
fs.watchFile(sourceFile, { interval: 500 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
        performMinification(true);
    }
});
