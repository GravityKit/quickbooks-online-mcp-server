# QuickBooks MCP Server - AI Agent Instructions

## Purpose
MCP server for QuickBooks Online integration. Provides CRUD operations for financial entities.

## Available Tools

### Entity Operations
All entities support: Create, Get, Search, Update, Delete

| Entity | Common Use Cases |
|--------|------------------|
| **Customer** | Client records, contact info, billing addresses |
| **Invoice** | Bills to customers, line items, payment tracking |
| **Estimate** | Quotes/proposals before invoicing |
| **Bill** | Expenses owed to vendors |
| **Bill Payment** | Recording payments made to vendors |
| **Vendor** | Supplier/contractor records |
| **Item** | Products/services sold or purchased |
| **Account** | Chart of accounts entries |
| **Employee** | Staff records |
| **Journal Entry** | Manual accounting adjustments |
| **Purchase** | Expense transactions |

## Search Patterns

### Customer Search
```json
{
  "criteria": [
    {"field": "DisplayName", "value": "Acme%", "operator": "LIKE"},
    {"field": "Active", "value": true}
  ]
}
```

### Common Search Fields
- **Customer**: `Id`, `DisplayName`, `GivenName`, `FamilyName`, `CompanyName`, `PrimaryEmailAddr`, `PrimaryPhone`, `Balance`, `Active`
- **Invoice**: `Id`, `DocNumber`, `TxnDate`, `CustomerRef`, `TotalAmt`, `Balance`
- **Vendor**: `Id`, `DisplayName`, `CompanyName`, `PrimaryEmailAddr`, `Balance`, `Active`
- **Bill**: `Id`, `DocNumber`, `TxnDate`, `DueDate`, `VendorRef`, `Balance`, `TotalAmt`

### Search Operators
- `=` (exact match)
- `<`, `>`, `<=`, `>=` (comparison)
- `LIKE` (pattern match with `%` wildcard)
- `IN` (multiple values)

### Pagination
- `limit`: Max results (default 10, use -1 for all)
- `offset`: Skip records
- `fetchAll`: true to retrieve all records (may be large)

## Error Handling

### "QuickBooks not connected"
Authentication tokens missing or invalid. Check `.env` configuration.

### "Failed to refresh Quickbooks token" (400 error)
Refresh token expired (100 days inactivity limit). Requires re-authentication:
1. Start Cloudflare tunnel: `cloudflared tunnel run quickbooks`
2. Run OAuth: `cd MCPs/quickbooks-mcp && npm run auth`
3. Restart Claude Code to pick up new tokens

### Large Result Sets
When `fetchAll: true` returns too much data, results are saved to a file. Use Grep to search the exported file.

## Common Workflows

### Find Customer by Email
```json
{"criteria": [{"field": "PrimaryEmailAddr", "value": "user@example.com"}]}
```

### Get Recent Invoices
```json
{
  "criteria": [{"field": "TxnDate", "value": "2024-01-01", "operator": ">="}],
  "orderBy": "TxnDate",
  "desc": "TxnDate"
}
```

### Find Unpaid Bills
```json
{"criteria": [{"field": "Balance", "value": "0", "operator": ">"}]}
```

## Data Relationships

- **Invoice** → references **Customer** via `CustomerRef`
- **Bill** → references **Vendor** via `VendorRef`
- **Invoice/Bill lines** → reference **Item** or **Account**
- **Bill Payment** → references **Bill** and **Vendor**

## Environment
- Production environment (not sandbox)
- Realm ID: `193514836697134`
- Tokens stored in both `.env` and root `.mcp.json`
