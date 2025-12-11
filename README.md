# Auto-Minify Watcher for LibraryScripts.js

This setup automatically minifies `LibraryScripts.js` whenever you save changes, following the rules in `MinifyRules.txt`.

## Quick Setup (One-Time)

### Step 1: Install Node.js and Yarn
If you don't have Node.js installed:
- Download from https://nodejs.org/ (LTS version recommended)
- Install it

If you don't have Yarn installed:
- Install Yarn: `npm install -g yarn`
- Or download from https://yarnpkg.com/

### Step 2: Install Dependencies
Run in your terminal:
```bash
yarn install
```

This installs the `terser` minifier library.

## Usage

### Start the Watcher (Auto-Minify on Save)
Simply run:
```bash
yarn watch
```

The watcher will:
- Watch `LibraryScripts.js` for changes
- Automatically minify when you save
- Write to `dist/LibraryScripts.min.js` (output directory)
- Keep `libAccts` constant unchanged at the top

Press `Ctrl+C` to stop the watcher.

### Manual Minification (One-Time)
To minify once without watching:
```bash
yarn minify
```

## Optional: Batch File Shortcuts

If you prefer double-clicking instead of using the terminal:
- `setup-watcher.bat` - Runs `yarn install` (one-time setup)
- `start-watcher.bat` - Runs `yarn watch` (starts the watcher)

## How It Works

- Uses `terser` (industry-standard JavaScript minifier)
- Applies aggressive compression and mangling
- Preserves `libAccts` constant for easy editing
- Uses double quotes consistently
- Optimizes code size while maintaining functionality

## Output Location

Minified files are written to the `dist/` directory:
- `dist/LibraryScripts.min.js` - The minified output file

The `dist/` directory is created automatically if it doesn't exist.

## Notes

- The watcher runs continuously until you stop it
- You can edit `LibraryScripts.js` in your editor while the watcher runs
- The minified file is updated automatically on each save
- If you see errors, make sure Node.js, Yarn, and dependencies are installed
