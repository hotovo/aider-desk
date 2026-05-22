# Providers Quota Extension

Displays API quota information for **Synthetic**, **Z.AI**, and **Neuralwatt** providers in the AiderDesk task status bar. The extension automatically shows the relevant quota based on the active agent profile's provider.

## Features

- **Synthetic Provider**: Shows used/limit with percentage and progress bar
- **Z.AI Provider**: Shows 5-hour and weekly usage percentages with progress bars
- **Neuralwatt Provider**: Shows quota based on account type:
  - **Subscription**: kWh used/included with percentage and renewal date
  - **Pay-as-you-go**: Credits remaining/total with percentage
- API keys are automatically loaded from AiderDesk provider settings
- Optional `.env` file to override API keys
- Automatic provider detection based on active agent profile
- Quota data cached for 1 minute to minimize API calls

## Installation

1. Copy this extension folder to your AiderDesk extensions directory:
   ```bash
   cp -r providers-quota-extension ~/.aider-desk/extensions/
   ```

2. Install the dotenv dependency:
   ```bash
   npm install
   ```

3. Restart AiderDesk

## Usage

The extension automatically displays quota information based on the active agent profile:

| Provider | Display Format |
|----------|---------------|
| `synthetic` | `Synthetic: 54/100 (54%)` |
| `zai-plan` | `Z.ai: 5 Hours: 12% \| Weekly: 45%` |
| `neuralwatt` (subscription) | `Neuralwatt: 13.90/20.0 kWh (70%)` |
| `neuralwatt` (pay-as-you-go) | `Neuralwatt: $32.68/$52.34 (62%)` |

If the agent profile's provider doesn't match a configured provider, no quota is displayed.

## Configuration

### API Keys

API keys are **automatically loaded from AiderDesk provider settings** — no manual configuration required. Simply ensure your API keys are set in the AiderDesk Providers settings page.

To override the API keys from AiderDesk settings, create a `.env` file in the extension folder (`~/.aider-desk/extensions/providers-quota-extension/.env`):

```env
# Override API keys (optional — only needed to override AiderDesk settings)
SYNTHETIC_API_KEY=your_synthetic_api_key
ZAI_API_KEY=your_zai_api_key
NEURALWATT_API_KEY=your_neuralwatt_api_key
```

You can configure any combination of providers. Only configure the ones you use.

### Multiple Environment Files

The extension supports multiple `.env` files loaded in priority order (later files override earlier):

1. `.env` - Base configuration
2. `.env.local` - Local overrides (gitignored)
3. `.env.development` / `.env.production` - Environment-specific
4. `.env.development.local` / `.env.production.local` - Environment-specific local overrides

## API Endpoints

### Synthetic API

- **Endpoint**: `https://api.synthetic.new/v2/quotas`
- **Response Format**:
  ```json
  {
    "subscription": {
      "limit": 135,
      "requests": 42,
      "renewsAt": "2025-09-21T14:36:14.288Z"
    }
  }
  ```

### Z.AI API

- **Endpoint**: `https://api.z.ai/api/monitor/usage/quota/limit`
- **Response Format**:
  ```json
  {
    "code": 200,
    "msg": "Operation successful",
    "data": {
      "limits": [
        {
          "type": "TOKENS_LIMIT",
          "unit": 3,
          "number": 5,
          "percentage": 12
        },
        {
          "type": "TOKENS_LIMIT",
          "unit": 6,
          "number": 1,
          "percentage": 45,
          "nextResetTime": 1773345805998
        }
      ],
      "level": "pro"
    },
    "success": true
  }
  ```

### Neuralwatt API

- **Endpoint**: `https://api.neuralwatt.com/v1/quota`
- **Response Format** (subscription):
  ```json
  {
    "snapshot_at": "2026-04-16T18:30:00Z",
    "balance": {
      "credits_remaining_usd": 32.6774,
      "total_credits_usd": 52.34,
      "credits_used_usd": 19.6626,
      "accounting_method": "energy"
    },
    "subscription": {
      "plan": "standard",
      "status": "active",
      "billing_interval": "month",
      "current_period_start": "2026-04-11T05:05:25Z",
      "current_period_end": "2026-05-11T05:05:25Z",
      "auto_renew": true,
      "kwh_included": 20.0,
      "kwh_used": 13.9023,
      "kwh_remaining": 6.0977,
      "in_overage": false
    }
  }
  ```
- **Response Format** (pay-as-you-go — `subscription` is `null`):
  ```json
  {
    "snapshot_at": "2026-04-16T18:30:00Z",
    "balance": {
      "credits_remaining_usd": 32.6774,
      "total_credits_usd": 52.34,
      "credits_used_usd": 19.6626,
      "accounting_method": "energy"
    },
    "subscription": null
  }
  ```

## Troubleshooting

### Quota not displayed

1. Verify that the API key is set in AiderDesk Providers settings or `.env`
2. Ensure the agent profile's provider matches (`synthetic`, `zai-plan`, or `neuralwatt`)
3. Check AiderDesk logs for error messages
4. Verify network connectivity to the API endpoints

### "Quota unavailable" message (Synthetic)

1. Check that `SYNTHETIC_API_KEY` is valid
2. Verify the API key has quota access
3. Check network connectivity to `api.synthetic.new`

### Extension not loading

1. Ensure the extension folder is named correctly: `providers-quota-extension`
2. Verify `index.ts` exists in the extension folder
3. Run `npm install` in the extension folder
4. Check AiderDesk logs for loading errors

### Quota not updating

Quota data is cached for 1 minute. To force a refresh:
- Wait for the cache to expire
- Restart AiderDesk

## Development

### File Structure

```
providers-quota-extension/
├── index.ts              # Main extension logic
├── StatusBarComponent.jsx # React JSX for UI rendering
├── package.json          # Dependencies
├── .env.template         # Template for API key overrides (create .env from this)
└── README.md             # This file
```

### Modifying the Extension

1. Edit `index.ts` to change API logic or data fetching
2. Edit `StatusBarComponent.jsx` to customize the UI
3. Restart AiderDesk to see changes

### Data Structure

The `getUIExtensionData` method returns:

```typescript
{
  synthetic: {
    used: number,
    limit: number,
    percentage: number,
    renewsAt?: string
  } | null,
  zai: {
    hourlyPercentage: number,
    weeklyPercentage: number,
    hourlyNextResetTime?: number,
    weeklyNextResetTime?: number
  } | null,
  neuralwatt: {
    isSubscription: boolean,
    // Subscription fields
    kwhUsed?: number,
    kwhIncluded?: number,
    kwhPercentage?: number,
    currentPeriodEnd?: string,
    plan?: string,
    inOverage?: boolean,
    // Pay-as-you-go fields
    creditsRemaining?: number,
    creditsTotal?: number,
    creditsPercentage?: number,
    accountingMethod?: string
  } | null,
  hasSynthetic: boolean,
  hasZai: boolean,
  hasNeuralwatt: boolean
}
```

## License

ISC
