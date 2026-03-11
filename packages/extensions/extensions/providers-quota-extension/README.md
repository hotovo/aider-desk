# Providers Quota Extension

Displays API quota information for **Synthetic** and **Z.AI** providers in the AiderDesk task status bar. The extension automatically shows the relevant quota based on the active agent profile's provider.

## Features

- **Synthetic Provider**: Shows used/limit with percentage and progress bar
- **Z.AI Provider**: Shows 5-hour and weekly usage percentages with progress bars
- Automatic provider detection based on active agent profile
- Quota data cached for 1 minute to minimize API calls

## Installation

1. Copy this extension folder to your AiderDesk extensions directory:
   ```bash
   cp -r providers-quota-extension ~/.aider-desk/extensions/
   ```

2. Create a `.env` file in the extension folder with your API key(s):
   ```bash
   cd ~/.aider-desk/extensions/providers-quota-extension
   echo "SYNTHETIC_API_KEY=your_synthetic_key_here" > .env
   echo "ZAI_API_KEY=your_zai_key_here" >> .env
   ```

3. Install the dotenv dependency:
   ```bash
   npm install
   ```

4. Restart AiderDesk

## Usage

The extension automatically displays quota information based on the active agent profile:

| Provider | Display Format |
|----------|---------------|
| `synthetic` | `Quota: 54/100 (54%)` with progress bar |
| `zai-plan` | `Z.AI: 5h: 12% Weekly: 45%` with two progress bars |

If the agent profile's provider doesn't match a configured provider, no quota is displayed.

## Configuration

### Environment Variables

Create a `.env` file in the extension folder (`~/.aider-desk/extensions/providers-quota-extension/.env`):

```env
# For Synthetic provider (optional)
SYNTHETIC_API_KEY=your_synthetic_api_key

# For Z.AI provider (optional)
ZAI_API_KEY=your_zai_api_key
```

You can configure either or both providers. Only configure the ones you use.

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

## Troubleshooting

### Quota not displayed

1. Verify that the correct API key is set in `.env`
2. Ensure the agent profile's provider matches (`synthetic` or `zai-plan`)
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
├── .env                  # API keys (create this)
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
    weeklyPercentage: number
  } | null,
  hasSynthetic: boolean,
  hasZai: boolean
}
```

## License

ISC
