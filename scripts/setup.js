#!/usr/bin/env node

/**
 * Setup helper script for Deskbird MCP Server
 * Helps users configure their environment and integration
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Package info
const PACKAGE_NAME = '@mawaha/deskbird-mcp-server';
const GITHUB_REPO = 'https://github.com/mawaha/deskbird-mcp-server';

function createEnvTemplate() {
  const envPath = join(process.cwd(), '.env.example');

  // Check if .env already exists
  const existingEnv = join(process.cwd(), '.env');
  if (existsSync(existingEnv)) {
    console.log('ℹ️  .env file already exists (not overwriting)');
    console.log('   Delete it first if you want to regenerate from template');
  }

  const envTemplate = `# Deskbird MCP Server Configuration
# Copy this file to .env and fill in your actual values

# Required: Your Deskbird refresh token
# See README.md "Getting Your Credentials" section for how to obtain this
REFRESH_TOKEN=your_deskbird_refresh_token

# Required: Google API key for token refresh
# This is used internally by Deskbird for OAuth token refresh
GOOGLE_API_KEY=your_google_api_key

# Required: Deskbird workspace configuration
# These IDs can be found in the Deskbird web app URL or via API
DESKBIRD_RESOURCE_ID=your_resource_id
DESKBIRD_ZONE_ITEM_ID=your_zone_item_id
DESKBIRD_WORKSPACE_ID=your_workspace_id

# Optional: Company ID (auto-discovered from user profile if not set)
# DEFAULT_COMPANY_ID=your_company_id

# Optional: Enable preview tools (deskbird_api_call)
# WARNING: Preview tools provide direct API access and should be used with caution
# Set to 'true' or '1' to enable, any other value or omission disables preview tools
ENABLE_PREVIEW_TOOLS=false

# Optional: Logging level (debug, info, warn, error, silent)
# LOG_LEVEL=info
`;

  writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env.example file with configuration template');
}

function generateClaudeConfig(useLocal = false) {
  let config;

  if (useLocal) {
    const mainJsPath = join(projectRoot, 'dist', 'main.js');
    config = {
      mcpServers: {
        deskbird: {
          command: 'node',
          args: [mainJsPath],
          env: {
            ENABLE_PREVIEW_TOOLS: 'false',
          },
        },
      },
    };
  } else {
    config = {
      mcpServers: {
        deskbird: {
          command: 'npx',
          args: ['-y', PACKAGE_NAME],
          env: {
            ENABLE_PREVIEW_TOOLS: 'false',
          },
        },
      },
    };
  }

  const configPath = join(process.cwd(), 'claude_desktop_config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Generated claude_desktop_config.json (${useLocal ? 'local' : 'npm'} mode)`);
}

function generateVSCodeConfig(useLocal = false) {
  let config;

  if (useLocal) {
    const mainJsPath = join(projectRoot, 'dist', 'main.js');
    config = {
      mcp: {
        servers: {
          deskbird: {
            command: 'node',
            args: [mainJsPath],
            env: {
              ENABLE_PREVIEW_TOOLS: 'false',
            },
          },
        },
      },
    };
  } else {
    config = {
      mcp: {
        servers: {
          deskbird: {
            command: 'npx',
            args: ['-y', PACKAGE_NAME],
            env: {
              ENABLE_PREVIEW_TOOLS: 'false',
            },
          },
        },
      },
    };
  }

  const configPath = join(process.cwd(), 'vscode_mcp_config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Generated vscode_mcp_config.json (${useLocal ? 'local' : 'npm'} mode)`);
}

function generateClaudeCodeConfig(useLocal = false) {
  let config;

  if (useLocal) {
    const mainJsPath = join(projectRoot, 'dist', 'main.js');
    config = {
      mcpServers: {
        deskbird: {
          command: 'node',
          args: [mainJsPath],
          env: {
            ENABLE_PREVIEW_TOOLS: 'false',
          },
        },
      },
    };
  } else {
    config = {
      mcpServers: {
        deskbird: {
          command: 'npx',
          args: ['-y', PACKAGE_NAME],
          env: {
            ENABLE_PREVIEW_TOOLS: 'false',
          },
        },
      },
    };
  }

  const configPath = join(process.cwd(), 'claude_code_config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Generated claude_code_config.json (${useLocal ? 'local' : 'npm'} mode)`);
}

function showInstructions(useLocal) {
  const mode = useLocal ? 'LOCAL DEVELOPMENT' : 'NPM PACKAGE';

  console.log(`
🚀 Deskbird MCP Server Setup Complete! (${mode} mode)

📁 Files created:
- .env.example - Environment configuration template
- claude_desktop_config.json - Claude Desktop configuration
- claude_code_config.json - Claude Code CLI configuration
- vscode_mcp_config.json - VS Code MCP configuration

📝 Next Steps:

1. Configure Environment:
   cp .env.example .env
   # Edit .env with your actual Deskbird credentials
   # See README.md "Getting Your Credentials" for help

2. Verify Configuration:
   npm run verify

3. For Claude Desktop:
   # Copy contents of claude_desktop_config.json to:
   # macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
   # Windows: %APPDATA%\\Claude\\claude_desktop_config.json
   # Linux: ~/.config/Claude/claude_desktop_config.json

4. For Claude Code CLI:
   # Copy contents of claude_code_config.json to:
   # ~/.claude.json (global) or .claude.json (project)

5. For VS Code:
   # Add contents of vscode_mcp_config.json to your VS Code settings.json
   # Or copy to .vscode/mcp.json in your workspace

6. Test the server:
   npm start

⚠️ Preview Tools:
- Preview tools (like deskbird_api_call) are disabled by default for security
- Set ENABLE_PREVIEW_TOOLS=true in your .env file to enable direct API access
- Use with caution - preview tools provide unrestricted API access

📚 Documentation:
- README.md - Full documentation and setup guide
- API_ENDPOINTS.md - API reference

🆘 Need Help?
- Run: npm run verify (to test your configuration)
- Check the README.md for detailed setup instructions
- Report issues: ${GITHUB_REPO}/issues

💡 Tip: Run "npm run setup" or "npm run setup -- --local" anytime to regenerate configs.
`);
}

function promptForMode() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('');
    console.log('Configuration Mode:');
    console.log('  1. Local Development - Points to local dist/main.js (recommended for development)');
    console.log('  2. NPM Package - Uses npx to download from GitHub Packages (for end users)');
    console.log('');

    rl.question('Select mode [1/2] (default: 1): ', (answer) => {
      rl.close();
      const useLocal = answer.trim() !== '2';
      resolve(useLocal);
    });
  });
}

async function setup() {
  try {
    console.log('🔧 Setting up Deskbird MCP Server...\n');

    // Check for --local or --npm flags
    const args = process.argv.slice(2);
    let useLocal;

    if (args.includes('--local')) {
      useLocal = true;
      console.log('Using local development mode (--local flag)\n');
    } else if (args.includes('--npm')) {
      useLocal = false;
      console.log('Using npm package mode (--npm flag)\n');
    } else if (process.stdin.isTTY) {
      // Interactive mode
      useLocal = await promptForMode();
    } else {
      // Non-interactive, default to local
      useLocal = true;
      console.log('Using local development mode (default)\n');
    }

    createEnvTemplate();
    generateClaudeConfig(useLocal);
    generateClaudeCodeConfig(useLocal);
    generateVSCodeConfig(useLocal);

    showInstructions(useLocal);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Only run if this script is called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  setup();
}
