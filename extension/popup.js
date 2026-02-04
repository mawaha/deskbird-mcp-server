/**
 * Deskbird MCP Credentials Helper - Popup Script
 *
 * Uses a hybrid approach for maximum reliability:
 * 1. Primary: Get credentials captured by background worker (network interception)
 * 2. Fallback: Scrape localStorage from the page (Firebase auth data)
 * 3. URL parsing: Extract workspace IDs from current page URL
 */

// DOM Elements
const elements = {
  loading: document.getElementById('loading'),
  notDeskbird: document.getElementById('not-deskbird'),
  notLoggedIn: document.getElementById('not-logged-in'),
  credentials: document.getElementById('credentials'),
  error: document.getElementById('error'),
  errorMessage: document.getElementById('error-message'),
  userEmail: document.getElementById('user-email'),
  refreshToken: document.getElementById('refresh-token'),
  googleApiKey: document.getElementById('google-api-key'),
  workspaceId: document.getElementById('workspace-id'),
  resourceId: document.getElementById('resource-id'),
  zoneItemId: document.getElementById('zone-item-id'),
  copyEnv: document.getElementById('copy-env'),
  downloadEnv: document.getElementById('download-env'),
  copyFeedback: document.getElementById('copy-feedback'),
  openDeskbird: document.getElementById('open-deskbird'),
  retry: document.getElementById('retry'),
};

// Known Google API key used by Deskbird (Firebase) - fallback
const KNOWN_GOOGLE_API_KEY = 'AIzaSyAtEWbXaOGuGd5FIn0lx8yHsm-vM9bMdfs';

// State
let extractedCredentials = null;

/**
 * Show a specific view and hide others
 */
function showView(viewId) {
  ['loading', 'notDeskbird', 'notLoggedIn', 'credentials', 'error'].forEach(id => {
    elements[id].classList.add('hidden');
  });
  elements[viewId].classList.remove('hidden');
}

/**
 * Show error message
 */
function showError(message) {
  elements.errorMessage.textContent = message;
  showView('error');
}

/**
 * Get credentials from background worker (captured via network interception)
 */
async function getCredentialsFromBackground() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Popup] Background worker error:', chrome.runtime.lastError);
        resolve(null);
        return;
      }
      resolve(response?.credentials || null);
    });
  });
}

/**
 * Extract credentials from the page's localStorage (fallback method)
 * This runs in the context of the Deskbird page
 */
function extractCredentialsFromPage() {
  const credentials = {
    refreshToken: null,
    googleApiKey: null,
    workspaceId: null,
    resourceId: null,
    zoneItemId: null,
    userEmail: null,
  };

  // Try to extract from localStorage (Firebase Auth pattern)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);

      // Firebase stores auth data with keys containing the API key
      if (key && key.includes('firebase:authUser:')) {
        try {
          const authData = JSON.parse(value);
          if (authData.stsTokenManager?.refreshToken) {
            credentials.refreshToken = authData.stsTokenManager.refreshToken;
          }
          if (authData.email) {
            credentials.userEmail = authData.email;
          }
          // Extract API key from the localStorage key
          const keyMatch = key.match(/firebase:authUser:([^:]+):/);
          if (keyMatch) {
            credentials.googleApiKey = keyMatch[1];
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
    }

    // Also check for refresh token in other common locations
    const refreshTokenKeys = ['refreshToken', 'refresh_token', 'deskbird_refresh_token'];
    for (const rtKey of refreshTokenKeys) {
      const value = localStorage.getItem(rtKey);
      if (value && !credentials.refreshToken) {
        credentials.refreshToken = value;
      }
    }

  } catch (e) {
    console.error('Error reading localStorage:', e);
  }

  // Extract IDs from URL
  try {
    const pathname = window.location.pathname;

    // Workspace ID patterns
    const workspacePatterns = [
      /\/workspace\/(\d+)/,
      /\/office\/(\d+)/,
      /\/workspaces\/(\d+)/,
    ];
    for (const pattern of workspacePatterns) {
      const match = pathname.match(pattern);
      if (match) {
        credentials.workspaceId = match[1];
        break;
      }
    }

    // Resource/Floor ID patterns
    const resourcePatterns = [
      /\/floor\/(\d+)/,
      /\/resource\/(\d+)/,
      /\/resourceGroup\/(\d+)/,
      /\/floors\/(\d+)/,
    ];
    for (const pattern of resourcePatterns) {
      const match = pathname.match(pattern);
      if (match) {
        credentials.resourceId = match[1];
        break;
      }
    }

    // Zone ID patterns
    const zonePatterns = [
      /\/zone\/(\d+)/,
      /\/zoneItem\/(\d+)/,
      /\/zones\/(\d+)/,
    ];
    for (const pattern of zonePatterns) {
      const match = pathname.match(pattern);
      if (match) {
        credentials.zoneItemId = match[1];
        break;
      }
    }

  } catch (e) {
    console.error('Error parsing URL:', e);
  }

  // Try to get user info from page state
  try {
    if (window.__PRELOADED_STATE__?.user?.email) {
      credentials.userEmail = window.__PRELOADED_STATE__.user.email;
    }
    if (window.__INITIAL_STATE__?.user?.email) {
      credentials.userEmail = window.__INITIAL_STATE__.user.email;
    }
  } catch (e) {
    // Ignore errors
  }

  return credentials;
}

/**
 * Merge credentials from multiple sources
 * Priority: background (network) > localStorage > fallback
 */
function mergeCredentials(backgroundCreds, pageCreds) {
  return {
    refreshToken: backgroundCreds?.refreshToken || pageCreds?.refreshToken || null,
    googleApiKey: backgroundCreds?.googleApiKey || pageCreds?.googleApiKey || KNOWN_GOOGLE_API_KEY,
    workspaceId: backgroundCreds?.workspaceId || pageCreds?.workspaceId || null,
    resourceId: backgroundCreds?.resourceId || pageCreds?.resourceId || null,
    zoneItemId: backgroundCreds?.zoneItemId || pageCreds?.zoneItemId || null,
    userEmail: pageCreds?.userEmail || null,
    // Track source for debugging
    source: {
      token: backgroundCreds?.refreshToken ? 'network' : (pageCreds?.refreshToken ? 'localStorage' : 'none'),
      apiKey: backgroundCreds?.googleApiKey ? 'network' : (pageCreds?.googleApiKey ? 'localStorage' : 'fallback'),
    },
  };
}

/**
 * Main initialization
 */
async function init() {
  showView('loading');

  try {
    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url) {
      showView('notDeskbird');
      return;
    }

    // Check if we're on Deskbird
    const url = new URL(tab.url);
    if (!url.hostname.includes('deskbird.com')) {
      showView('notDeskbird');
      return;
    }

    // Get credentials from both sources
    const [backgroundCreds, pageResults] = await Promise.all([
      getCredentialsFromBackground(),
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractCredentialsFromPage,
      }).catch(err => {
        console.warn('[Popup] Failed to execute page script:', err);
        return null;
      }),
    ]);

    const pageCreds = pageResults?.[0]?.result || null;

    // Merge credentials from both sources
    extractedCredentials = mergeCredentials(backgroundCreds, pageCreds);

    console.log('[Popup] Credentials merged:', {
      hasToken: !!extractedCredentials.refreshToken,
      hasApiKey: !!extractedCredentials.googleApiKey,
      source: extractedCredentials.source,
    });

    // Check if logged in (must have refresh token)
    if (!extractedCredentials.refreshToken) {
      showView('notLoggedIn');
      return;
    }

    // Populate the UI
    populateCredentials(extractedCredentials);
    showView('credentials');

  } catch (err) {
    console.error('Error:', err);
    showError(err.message || 'An unexpected error occurred.');
  }
}

/**
 * Populate credential fields in the UI
 */
function populateCredentials(creds) {
  elements.userEmail.textContent = creds.userEmail
    ? `Logged in as ${creds.userEmail}`
    : 'Logged in';

  elements.refreshToken.value = creds.refreshToken || 'Not found';
  elements.googleApiKey.value = creds.googleApiKey || 'Not found';
  elements.workspaceId.value = creds.workspaceId || 'Navigate to a floor plan to detect';
  elements.resourceId.value = creds.resourceId || 'Navigate to a floor plan to detect';
  elements.zoneItemId.value = creds.zoneItemId || 'Navigate to a floor plan to detect';
}

/**
 * Generate .env format string
 */
function generateEnvContent() {
  if (!extractedCredentials) return '';

  const lines = [
    '# Deskbird MCP Server Configuration',
    '# Generated by Deskbird MCP Credentials Helper',
    '',
    '# Authentication',
    `REFRESH_TOKEN=${extractedCredentials.refreshToken || 'YOUR_REFRESH_TOKEN'}`,
    `GOOGLE_API_KEY=${extractedCredentials.googleApiKey || 'YOUR_GOOGLE_API_KEY'}`,
    '',
    '# Workspace Configuration',
    `DESKBIRD_WORKSPACE_ID=${extractedCredentials.workspaceId || 'YOUR_WORKSPACE_ID'}`,
    `DESKBIRD_RESOURCE_ID=${extractedCredentials.resourceId || 'YOUR_RESOURCE_ID'}`,
    `DESKBIRD_ZONE_ITEM_ID=${extractedCredentials.zoneItemId || 'YOUR_ZONE_ITEM_ID'}`,
    '',
    '# Optional',
    'ENABLE_PREVIEW_TOOLS=false',
    '',
  ];

  return lines.join('\n');
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Show copy feedback
 */
function showCopyFeedback() {
  elements.copyFeedback.classList.remove('hidden');
  setTimeout(() => {
    elements.copyFeedback.classList.add('hidden');
  }, 2000);
}

/**
 * Download file
 */
function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Event Listeners

// Copy individual credential buttons
document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', async () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (input?.value && !input.value.includes('Not found') && !input.value.includes('Navigate')) {
      const success = await copyToClipboard(input.value);
      if (success) {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1500);
      }
    }
  });
});

// Copy as .env format
elements.copyEnv.addEventListener('click', async () => {
  const content = generateEnvContent();
  const success = await copyToClipboard(content);
  if (success) {
    showCopyFeedback();
  }
});

// Download .env file
elements.downloadEnv.addEventListener('click', () => {
  const content = generateEnvContent();
  downloadFile(content, '.env');
});

// Open Deskbird button
elements.openDeskbird.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://app.deskbird.com' });
});

// Retry button
elements.retry.addEventListener('click', () => {
  init();
});

// Initialize when popup opens
init();
