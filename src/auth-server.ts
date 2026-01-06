#!/usr/bin/env node

/**
 * Standalone OAuth authentication server for QuickBooks Online.
 * Run this to obtain refresh tokens before using the MCP server.
 */

import dotenv from "dotenv";
import OAuthClient from "intuit-oauth";
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

// Load .env from the correct location (relative to this script, not CWD)
dotenv.config({ path: envPath });

const client_id = process.env.QUICKBOOKS_CLIENT_ID;
const client_secret = process.env.QUICKBOOKS_CLIENT_SECRET;
const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
const redirect_uri = process.env.QUICKBOOKS_REDIRECTURI || 'http://localhost:8000/callback';
const port = parseInt(process.env.QUICKBOOKS_AUTH_PORT || '8000');

if (!client_id || !client_secret) {
  console.error('Error: QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

console.log('QuickBooks OAuth Authentication');
console.log('================================');
console.log(`Environment: ${environment}`);
console.log(`Redirect URI: ${redirect_uri}`);
console.log('');

const oauthClient = new OAuthClient({
  clientId: client_id,
  clientSecret: client_secret,
  environment: environment,
  redirectUri: redirect_uri,
});

// Path to the MonoKit .mcp.json file
const mcpJsonPath = path.join(__dirname, '..', '..', '..', '.mcp.json');

function saveTokensToEnv(refreshToken: string, realmId: string): void {
  // Update .env file
  let envContent = '';

  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch {
    // File doesn't exist, start fresh
    envContent = '';
  }

  const envLines = envContent.split('\n').filter(line => line.trim());

  const updateEnvVar = (name: string, value: string) => {
    const index = envLines.findIndex(line => line.startsWith(`${name}=`));
    if (index !== -1) {
      envLines[index] = `${name}=${value}`;
    } else {
      envLines.push(`${name}=${value}`);
    }
  };

  updateEnvVar('QUICKBOOKS_REFRESH_TOKEN', refreshToken);
  updateEnvVar('QUICKBOOKS_REALM_ID', realmId);

  fs.writeFileSync(envPath, envLines.join('\n') + '\n');
  console.log(`\nTokens saved to ${envPath}`);

  // Update .mcp.json file
  updateMcpJson(refreshToken, realmId);
}

function updateMcpJson(refreshToken: string, realmId: string): void {
  try {
    const mcpContent = fs.readFileSync(mcpJsonPath, 'utf-8');
    const mcpConfig = JSON.parse(mcpContent);

    if (mcpConfig.mcpServers?.quickbooks?.env) {
      mcpConfig.mcpServers.quickbooks.env.QUICKBOOKS_REFRESH_TOKEN = refreshToken;
      mcpConfig.mcpServers.quickbooks.env.QUICKBOOKS_REALM_ID = realmId;

      fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n');
      console.log(`Tokens also saved to ${mcpJsonPath}`);
    } else {
      console.warn(`Warning: Could not find mcpServers.quickbooks.env in ${mcpJsonPath}`);
    }
  } catch (error: any) {
    console.error(`Warning: Could not update ${mcpJsonPath}: ${error.message}`);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/callback')) {
    try {
      const response = await oauthClient.createToken(req.url);
      const tokens = response.token;

      // Save tokens to .env
      saveTokensToEnv(tokens.refresh_token, tokens.realmId);

      console.log('\n✓ Successfully authenticated with QuickBooks!');
      console.log(`  Realm ID: ${tokens.realmId}`);
      console.log(`  Refresh Token: ${tokens.refresh_token.substring(0, 20)}...`);

      // Send success response
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
          ">
            <h2 style="color: #2E8B57;">✓ Successfully connected to QuickBooks!</h2>
            <p>Tokens have been saved to both <code>.env</code> and <code>.mcp.json</code> files.</p>
            <p>You can close this window and restart Claude Code to use the new tokens.</p>
          </body>
        </html>
      `);

      // Close server after a short delay
      setTimeout(() => {
        console.log('\nAuthentication complete. You can now use the MCP server.');
        server.close();
        process.exit(0);
      }, 1500);

    } catch (error: any) {
      console.error('\nError during authentication:', error.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
            background-color: #fff0f0;
          ">
            <h2 style="color: #d32f2f;">Error connecting to QuickBooks</h2>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  }
});

server.listen(port, async () => {
  console.log(`OAuth callback server listening on port ${port}`);
  console.log('Opening browser for QuickBooks authentication...\n');

  // Generate authorization URL
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting as string],
    state: 'auth'
  }).toString();

  // Open browser
  await open(authUri);
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use. Please close any other services using this port.`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});
