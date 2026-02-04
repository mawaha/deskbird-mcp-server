/**
 * Deskbird MCP Credentials Helper - Background Service Worker
 *
 * Intercepts network requests to capture authentication tokens
 * This is more reliable than scraping localStorage as it captures
 * the actual values being sent to Google's token API.
 */

// Storage key for captured credentials
const STORAGE_KEY = 'deskbird_credentials';

// Track captured credentials
let capturedCredentials = {
  refreshToken: null,
  googleApiKey: null,
  capturedAt: null,
};

/**
 * Parse URL-encoded form data
 */
function parseFormData(text) {
  const params = {};
  const pairs = text.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=').map(decodeURIComponent);
    params[key] = value;
  }
  return params;
}

/**
 * Extract API key from URL
 */
function extractApiKeyFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('key');
  } catch (e) {
    return null;
  }
}

/**
 * Save credentials to storage
 */
async function saveCredentials(credentials) {
  capturedCredentials = {
    ...capturedCredentials,
    ...credentials,
    capturedAt: Date.now(),
  };

  await chrome.storage.local.set({
    [STORAGE_KEY]: capturedCredentials,
  });

  console.log('[Deskbird MCP] Credentials captured and saved');
}

/**
 * Load credentials from storage
 */
async function loadCredentials() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY]) {
    capturedCredentials = result[STORAGE_KEY];
  }
  return capturedCredentials;
}

/**
 * Listen for requests to Google's token endpoint
 * This captures the refresh token and API key from actual auth requests
 */
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Only process POST requests to the token endpoint
    if (details.method !== 'POST') return;

    // Extract API key from URL
    const apiKey = extractApiKeyFromUrl(details.url);

    // Try to get the request body
    if (details.requestBody) {
      let refreshToken = null;

      // Handle form data
      if (details.requestBody.formData) {
        refreshToken = details.requestBody.formData.refresh_token?.[0];
      }

      // Handle raw body (URL-encoded)
      if (!refreshToken && details.requestBody.raw) {
        try {
          const decoder = new TextDecoder('utf-8');
          const bodyText = details.requestBody.raw
            .map(part => decoder.decode(part.bytes))
            .join('');
          const formData = parseFormData(bodyText);
          refreshToken = formData.refresh_token;
        } catch (e) {
          console.error('[Deskbird MCP] Error parsing request body:', e);
        }
      }

      // Save if we found credentials
      if (refreshToken || apiKey) {
        saveCredentials({
          refreshToken: refreshToken || capturedCredentials.refreshToken,
          googleApiKey: apiKey || capturedCredentials.googleApiKey,
        });
      }
    }
  },
  {
    urls: ['https://securetoken.googleapis.com/*'],
  },
  ['requestBody']
);

/**
 * Also listen for Deskbird API requests to capture workspace info
 */
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Extract workspace IDs from API URLs
    const url = details.url;

    // Patterns to look for in API calls
    const workspaceMatch = url.match(/\/workspaces?\/(\d+)/i);
    const resourceMatch = url.match(/\/resources?\/(\d+)/i) || url.match(/\/floors?\/(\d+)/i);
    const zoneMatch = url.match(/\/zones?\/(\d+)/i) || url.match(/\/zoneItems?\/(\d+)/i);

    if (workspaceMatch || resourceMatch || zoneMatch) {
      const updates = {};
      if (workspaceMatch) updates.workspaceId = workspaceMatch[1];
      if (resourceMatch) updates.resourceId = resourceMatch[1];
      if (zoneMatch) updates.zoneItemId = zoneMatch[1];

      // Only save if we have new data
      if (Object.keys(updates).length > 0) {
        saveCredentials(updates);
      }
    }
  },
  {
    urls: ['https://api.deskbird.com/*', 'https://*.deskbird.com/api/*'],
  },
  []
);

/**
 * Handle messages from popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CREDENTIALS') {
    loadCredentials().then(creds => {
      sendResponse({ success: true, credentials: creds });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'CLEAR_CREDENTIALS') {
    chrome.storage.local.remove(STORAGE_KEY).then(() => {
      capturedCredentials = {
        refreshToken: null,
        googleApiKey: null,
        capturedAt: null,
      };
      sendResponse({ success: true });
    });
    return true;
  }
});

// Load any existing credentials on startup
loadCredentials();

console.log('[Deskbird MCP] Background service worker initialized');
