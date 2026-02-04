#!/usr/bin/env node

/**
 * Verification script for Deskbird MCP Server
 * Validates environment configuration and tests API connectivity
 */

import * as dotenvFlow from 'dotenv-flow';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables
dotenvFlow.config({ path: projectRoot });

const REQUIRED_ENV_VARS = [
  { name: 'REFRESH_TOKEN', description: 'Deskbird OAuth refresh token' },
  { name: 'GOOGLE_API_KEY', description: 'Google API key for token refresh' },
];

const OPTIONAL_ENV_VARS = [
  { name: 'DESKBIRD_RESOURCE_ID', description: 'Default desk resource ID' },
  { name: 'DESKBIRD_ZONE_ITEM_ID', description: 'Default zone item ID' },
  { name: 'DESKBIRD_WORKSPACE_ID', description: 'Default workspace ID' },
  { name: 'DEFAULT_COMPANY_ID', description: 'Company ID (auto-discovered if not set)' },
  { name: 'ENABLE_PREVIEW_TOOLS', description: 'Enable preview tools like deskbird_api_call' },
  { name: 'LOG_LEVEL', description: 'Logging level (debug, info, warn, error, silent)' },
];

function checkEnvFile() {
  const envPath = join(projectRoot, '.env');
  if (!existsSync(envPath)) {
    console.log('⚠️  No .env file found');
    console.log('   Run: cp .env.example .env');
    console.log('   Then edit .env with your credentials\n');
    return false;
  }
  console.log('✅ .env file found\n');
  return true;
}

function validateRequiredVars() {
  console.log('Checking required environment variables...\n');

  const missing = [];
  const valid = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];
    if (!value || value.startsWith('your_')) {
      missing.push(envVar);
      console.log(`❌ ${envVar.name}`);
      console.log(`   ${envVar.description}`);
      console.log(`   Status: ${!value ? 'Not set' : 'Placeholder value'}\n`);
    } else {
      valid.push(envVar);
      const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
      console.log(`✅ ${envVar.name}`);
      console.log(`   Value: ${masked}\n`);
    }
  }

  return { missing, valid };
}

function checkOptionalVars() {
  console.log('Checking optional environment variables...\n');

  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];
    if (value && !value.startsWith('your_')) {
      console.log(`✅ ${envVar.name}: ${value}`);
    } else {
      console.log(`⚪ ${envVar.name}: Not set (optional)`);
    }
  }
  console.log('');
}

async function testAuthentication() {
  console.log('Testing authentication...\n');

  const refreshToken = process.env.REFRESH_TOKEN;
  const googleApiKey = process.env.GOOGLE_API_KEY;

  if (!refreshToken || !googleApiKey) {
    console.log('⏭️  Skipping authentication test (missing credentials)\n');
    return false;
  }

  try {
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        console.log('✅ Authentication successful');
        console.log(`   Token type: Bearer`);
        console.log(`   Expires in: ${data.expires_in} seconds\n`);
        return true;
      }
    }

    const errorData = await response.json().catch(() => ({}));
    console.log('❌ Authentication failed');
    console.log(`   Status: ${response.status}`);
    if (errorData.error?.message) {
      console.log(`   Error: ${errorData.error.message}`);
    }
    console.log('\n   Possible causes:');
    console.log('   - REFRESH_TOKEN has expired (re-login to Deskbird)');
    console.log('   - GOOGLE_API_KEY is invalid');
    console.log('   - Network connectivity issue\n');
    return false;

  } catch (error) {
    console.log('❌ Authentication test failed');
    console.log(`   Error: ${error.message}\n`);
    return false;
  }
}

async function verify() {
  console.log('');
  console.log('🔍 Deskbird MCP Server - Configuration Verification');
  console.log('═'.repeat(50));
  console.log('');

  const hasEnvFile = checkEnvFile();
  const { missing, valid } = validateRequiredVars();
  checkOptionalVars();

  let authSuccess = false;
  if (missing.length === 0) {
    authSuccess = await testAuthentication();
  }

  // Summary
  console.log('═'.repeat(50));
  console.log('Summary');
  console.log('═'.repeat(50));
  console.log('');

  if (missing.length === 0 && authSuccess) {
    console.log('✅ All checks passed! Your configuration is valid.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: npm start');
    console.log('  2. Or configure your MCP client (see README.md)');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ Configuration incomplete\n');

    if (missing.length > 0) {
      console.log('Missing required variables:');
      for (const v of missing) {
        console.log(`  - ${v.name}: ${v.description}`);
      }
      console.log('');
    }

    if (!authSuccess && missing.length === 0) {
      console.log('Authentication failed. Check your credentials.\n');
    }

    console.log('See README.md section "Getting Your Credentials" for help.');
    console.log('');
    process.exit(1);
  }
}

verify().catch((error) => {
  console.error('Verification failed:', error.message);
  process.exit(1);
});
