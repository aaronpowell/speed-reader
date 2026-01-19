# Speed Reader - RSVP Browser Extension

A Chrome/Edge browser extension for reading web pages using Rapid Serial Visual Presentation (RSVP).

## Features

- **Full Page Reading**: Automatically extracts main content from any webpage
- **Text Selection**: Select specific text before clicking "Read Full Page" to read just that selection
- **Area Selection**: Draw a box around content you want to read
- **Focal Point Highlighting**: The optimal recognition point (ORP) of each word is highlighted for faster reading
- **Adjustable Speed**: Set reading speed from 100-1000 WPM (default: 300)
- **Smart Pacing**: Pauses slightly longer on punctuation and longer words
- **Keyboard Controls**: Full keyboard support for hands-free operation

## Installation

1. Open Chrome/Edge and go to `chrome://extensions` or `edge://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `speed-reader` folder
5. The extension icon will appear in your toolbar

## Usage

1. Click the extension icon to open the popup
2. Adjust reading speed if desired
3. Click **"Read Full Page"** to read the main content, or select text first
4. Click **"Select Text Area"** to draw a selection box around specific content

## Keyboard Shortcuts (while reading)

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Previous word |
| `→` | Next word |
| `↑` | Increase speed |
| `↓` | Decrease speed |
| `Escape` | Close reader |

## Icons

The extension requires icon files. You can convert the included `icon.svg` to PNG format:
- `icons/icon16.png` (16x16)
- `icons/icon48.png` (48x48)
- `icons/icon128.png` (128x128)

Or use any online SVG to PNG converter.

## How RSVP Works

RSVP displays one word at a time at a fixed position, eliminating the need for eye movement while reading. The focal point (Optimal Recognition Point) is highlighted in each word - this is typically slightly left of center where your eye naturally focuses when reading.

## Browser Compatibility

- Google Chrome (v88+)
- Microsoft Edge (v88+)
- Any Chromium-based browser
