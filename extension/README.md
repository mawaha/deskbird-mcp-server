# Deskbird MCP Credentials Helper

A browser extension that makes it easy to extract your Deskbird credentials for the MCP server.

## Installation Guide

### Step 1: Download the Extension

1. Download this entire `extension` folder to your computer
2. Remember where you saved it (you'll need this location later)

**Option A - If you have the repository:**
The extension is already in the `extension` folder.

**Option B - Download just the extension:**
Download and unzip from: [extension.zip](https://github.com/mawaha/deskbird-mcp-server/releases)

---

### Step 2: Install in Chrome/Edge/Brave

#### For Google Chrome:

1. Open Chrome and go to: `chrome://extensions`
   - Or click the three dots menu (⋮) → "Extensions" → "Manage Extensions"

2. Enable **Developer mode**
   - Find the toggle in the top-right corner
   - Click it so it turns ON (blue)

   ![Enable Developer Mode](https://user-images.githubusercontent.com/placeholder/dev-mode.png)

3. Click **"Load unpacked"**
   - A file browser will open
   - Navigate to the `extension` folder you downloaded
   - Select the folder and click "Open"

4. The extension should now appear in your extensions list!

5. **Pin the extension** (recommended)
   - Click the puzzle piece icon (🧩) in Chrome's toolbar
   - Find "Deskbird MCP Credentials Helper"
   - Click the pin icon (📌) to keep it visible

---

#### For Microsoft Edge:

1. Open Edge and go to: `edge://extensions`
2. Enable **Developer mode** (toggle in the left sidebar)
3. Click **"Load unpacked"**
4. Select the `extension` folder
5. Pin the extension to your toolbar

---

#### For Brave:

1. Open Brave and go to: `brave://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **"Load unpacked"**
4. Select the `extension` folder
5. Pin the extension to your toolbar

---

### Step 3: Extract Your Credentials

1. **Go to Deskbird** and log in
   - Navigate to [app.deskbird.com](https://app.deskbird.com)
   - Log in with your normal credentials

2. **Navigate to your floor plan**
   - Go to your office location
   - Open the floor plan where you usually book desks
   - This helps the extension detect your workspace IDs

3. **Click the extension icon**
   - Look for the blue square icon in your toolbar
   - Click it to open the credentials popup

4. **Copy your credentials**
   - Click **"Copy as .env format"** to copy everything at once
   - Or use **"Download .env file"** to save directly

5. **Paste into your .env file**
   - Open your `.env` file in the deskbird-mcp-server folder
   - Paste the copied content
   - Save the file

6. **Verify it works**
   ```bash
   npm run verify
   ```

---

## Troubleshooting

### "Not on Deskbird" message
Make sure you're on `app.deskbird.com` and logged in before clicking the extension.

### "Not Logged In" message
Log into your Deskbird account first, then try clicking the extension again.

### Workspace IDs show "Navigate to a floor plan"
Go to your office's floor plan in Deskbird. The URL should look something like:
```
https://app.deskbird.com/home/workspace/123/resourceGroup/456/zoneItem/789
```
Then click the extension again.

### Extension not working after Chrome update
1. Go to `chrome://extensions`
2. Find "Deskbird MCP Credentials Helper"
3. Click the refresh icon (🔄) or toggle it off and on

### "Cannot read localStorage" error
Try refreshing the Deskbird page and clicking the extension again.

---

## Security & Privacy

- **100% Local**: All processing happens in your browser. Nothing is sent to external servers.
- **Open Source**: You can inspect the code to verify what it does.
- **Minimal Permissions**: Only requests access to Deskbird domains.
- **No Tracking**: No analytics, no data collection.

---

## Uninstalling

1. Go to `chrome://extensions`
2. Find "Deskbird MCP Credentials Helper"
3. Click "Remove"
4. Confirm removal

---

## Need Help?

If you're having issues:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Open an issue: [github.com/mawaha/deskbird-mcp-server/issues](https://github.com/mawaha/deskbird-mcp-server/issues)
