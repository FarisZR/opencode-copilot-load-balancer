# OpenCode Copilot Multi-Account Plugin

Multi-account GitHub Copilot load balancing for OpenCode. Routes requests across multiple Copilot accounts, skips accounts without the requested model, and shows which account handled each request.

## Features

- Multiple GitHub.com and GitHub Enterprise Copilot accounts
- Hybrid load-balancing with cooldowns and fallback
- Per-request account attribution (toast, log, header)
- Model availability cache with lazy detection

## Install

1. Install dependencies and build:

```bash
cd template
bun install
mise run build
```

2. Add the plugin to your OpenCode config:

```json
{
  "plugin": ["file:///absolute/path/to/template/dist/index.js"]
}
```

Or drop the built plugin into your `.opencode/plugin/` directory:

```bash
cp /absolute/path/to/template/dist/index.js /path/to/project/.opencode/plugin/opencode-copilot-multi-auth.js
```

## Usage

1. Login to GitHub Copilot (GitHub.com):

```bash
opencode auth login
```

Select "Login with GitHub Copilot (GitHub.com)". You will be prompted for an **Account label** (e.g., `personal` or `work`). Use distinct labels when adding multiple accounts.

2. Login to GitHub Copilot (Enterprise) to add another account:

```bash
opencode auth login
```

Select "Login with GitHub Copilot (Enterprise)" and enter your enterprise domain.

3. Send prompts in OpenCode. The plugin will pick an eligible account per request and show which account was used.

## Configuration

Create `~/.config/opencode/copilot-multi.json` or `.opencode/copilot-multi.json`:

```json
{
  "strategy": "hybrid",
  "modelCacheTtlMs": 86400000,
  "visibility": {
    "toast": true,
    "toastCooldownMs": 0,
    "log": true,
    "header": true
  },
  "rateLimit": {
    "defaultBackoffMs": 30000,
    "maxBackoffMs": 300000
  }
}
```

See `template/docs/CONFIGURATION.md` for details.

## Security and Policy Notes

- Do not share GitHub accounts or tokens across people.
- Do not rotate tokens to exceed GitHub rate limits.

## Development

- `mise run build` - Build the module
- `mise run test` - Run tests
- `mise run lint` - Lint code
- `mise run lint:fix` - Fix linting issues
- `mise run format` - Format code with Prettier

### Managing Accounts

Use the included CLI tools to manage your accounts:

- `copilot-accounts-list`: Show all configured accounts, their status, and IDs.
- `copilot-accounts-disable --id <id>`: Disable an account.
- `copilot-accounts-enable --id <id>`: Re-enable an account.

### Multiple Accounts

You can add multiple GitHub.com accounts by running `opencode auth login` multiple times and providing a unique label for each (e.g., `personal`, `work`). The plugin will balance requests across all enabled accounts that support the requested model.


MIT License. See the [LICENSE](LICENSE) file for details.
