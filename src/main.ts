#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DeskbirdMcpServer } from './deskbird.server.js';
import { createLogger } from './utils/logger.js';
import * as dotenvFlow from 'dotenv-flow';

// Load environment variables early
dotenvFlow.config();

const logger = createLogger('Main');

// Required environment variables for the server to function
const REQUIRED_ENV_VARS = ['REFRESH_TOKEN', 'GOOGLE_API_KEY'];

/**
 * Validates that required environment variables are set.
 * Exits with error if any required variables are missing.
 */
function validateEnvironment(): void {
  const missing = REQUIRED_ENV_VARS.filter((varName) => {
    const value = process.env[varName];
    return !value || value.startsWith('your_');
  });

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    logger.error('');
    logger.error('To fix this:');
    logger.error('  1. Copy .env.example to .env');
    logger.error('  2. Edit .env with your actual credentials');
    logger.error('  3. Run "npm run verify" to test your configuration');
    logger.error('');
    logger.error('See README.md "Getting Your Credentials" section for help.');
    process.exit(1);
  }
}

// --- Server Start ---
async function main() {
  // Validate environment before starting
  validateEnvironment();

  logger.info('Starting Deskbird MCP Server...');
  const server = new DeskbirdMcpServer();

  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Keep the process alive for stdio transport
  process.stdin.resume();
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, closing server.');
    await server.close();
    process.exit(0);
  });
}

// Run the main function and handle potential errors
main().catch((error) => {
  logger.error('Fatal error starting MCP Server', error);
  process.exit(1);
});
