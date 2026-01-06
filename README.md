# QuickBooks Online MCP Server

This is a Model Context Protocol (MCP) server implementation for QuickBooks Online integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_ENVIRONMENT=sandbox
```

3. Get your Client ID and Client Secret:
   - Go to the [Intuit Developer Portal](https://developer.intuit.com/)
   - Create a new app or select an existing one
   - Get the Client ID and Client Secret from the app's keys section
   - Add `http://localhost:8000/callback` to the app's Redirect URIs

## Authentication

There are two ways to authenticate with QuickBooks Online:

### Option 1: Using Environment Variables

If you already have a refresh token and realm ID, you can add them directly to your `.env` file:

```env
QUICKBOOKS_REFRESH_TOKEN=your_refresh_token
QUICKBOOKS_REALM_ID=your_realm_id
```

### Option 2: Using the OAuth Flow

If you don't have a refresh token or need to re-authenticate (tokens expired), use the built-in OAuth flow.

#### Prerequisites

QuickBooks production apps require a public HTTPS redirect URI. We use Cloudflare Tunnel to expose the local OAuth callback server.

**One-time Cloudflare setup** (if not already done):
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Login to Cloudflare (opens browser)
cloudflared login

# Create a named tunnel
cloudflared tunnel create quickbooks

# Route DNS (replace with your domain)
cloudflared tunnel route dns quickbooks qb-auth.gravitykit.com
```

Create `~/.cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL_ID_FROM_CREATE_COMMAND>
credentials-file: /Users/<USERNAME>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: qb-auth.gravitykit.com
    service: http://localhost:8000
  - service: http_status:404
```

#### Running the OAuth Flow

> **⚠️ IMPORTANT**: The Cloudflare tunnel MUST be running BEFORE you start the OAuth flow. The tunnel routes the callback URL to your local server - without it, QuickBooks cannot complete authentication.

**Step 1** - Start the Cloudflare tunnel (keep running):
```bash
cloudflared tunnel run quickbooks
```

**Step 2** - In a new terminal, run OAuth authentication:
```bash
cd MCPs/quickbooks-mcp && npm run auth
```

This will:
- Start a temporary local server on port 8000
- Open your default browser automatically
- Redirect you to QuickBooks for authentication
- Save the tokens to both:
  - `.env` file (in the quickbooks-mcp directory)
  - `.mcp.json` file (in the MonoKit root directory)
- Close automatically when complete

**Important**: After re-authenticating, you must restart Claude Code (or any application using the MCP server) to pick up the new tokens.

## Usage

After authentication is set up, you can use the MCP server to interact with QuickBooks Online. The server provides various tools for managing customers, estimates, bills, and more.

## Available Tools

Added tools for Create, Delete, Get, Search, Update for the following entities:


- Account
- Bill Payment
- Bill
- Customer
- Employee
- Estimate
- Invoice
- Item
- Journal Entry
- Purchase
- Vendor


## Error Handling

### "QuickBooks not connected"
Check that your `.env` file contains all required variables.

### "Failed to refresh Quickbooks token" (400 error)
Your refresh token has expired. QuickBooks refresh tokens can expire for two reasons:

1. **Inactivity**: Tokens expire after **100 days of inactivity** (no refresh within that period)
2. **Maximum lifetime**: Per Intuit's **Nov 12, 2025 policy change**, refresh tokens now have a maximum lifetime regardless of activity:
   - Up to **5 years** for certain scopes (e.g., Accounting)
   - First mandatory expirations begin **Feb 2027** (for tokens issued before the policy) and **Oct 2028** (for newer tokens)
   - Exact lifetime is **scope-dependent**

**To re-authenticate:**
1. Start the Cloudflare tunnel: `cloudflared tunnel run quickbooks`
2. Run OAuth: `cd MCPs/quickbooks-mcp && npm run auth`
3. **Restart Claude Code** to pick up the new tokens

> **Long-term consideration**: Implement token rotation monitoring and plan for periodic user re-authentication flows to handle mandatory expirations. Track token issuance dates to anticipate when re-authentication will be required.

### Token not updating after re-authentication
The MCP server caches tokens in memory. You must restart Claude Code (or the application using the MCP) after re-authenticating for the new tokens to take effect.

