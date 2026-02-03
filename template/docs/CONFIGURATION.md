# Configuration

Create `~/.config/opencode/copilot-multi.json` (or `.opencode/copilot-multi.json` in your project):

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

## Management Tools

The plugin registers the following OpenCode tools for managing your accounts:

- `copilot-accounts-list`: List all accounts, their status, labels, and IDs.
- `copilot-accounts-disable`: Disable an account by ID (e.g., if you want to temporarily stop using one).
- `copilot-accounts-enable`: Re-enable a previously disabled account.

Usage:
```bash
opencode tool call copilot-accounts-list
opencode tool call copilot-accounts-disable --id <account-id>
```


### `strategy`

Load-balancing strategy:

- `hybrid` (default): health + last-used selection with cooldowns
- `sticky`: stick to one account until rate-limited
- `round-robin`: rotate on every request

### `modelCacheTtlMs`

How long to cache model availability per account (milliseconds). Defaults to 24 hours.

### `visibility`

- `toast`: show a toast for each request
- `toastCooldownMs`: debounce toasts
- `log`: write account selections to logs
- `header`: attach `x-opencode-copilot-account` to each request

### `rateLimit`

- `defaultBackoffMs`: fallback backoff when headers are missing
- `maxBackoffMs`: clamp the backoff to this maximum

### `accountsPath`

Optional path override for where accounts are stored.

## Plugin Installation

Option A: use OpenCode config `plugin` array with a `file://` URL.

Option B: drop the built plugin file into `.opencode/plugin/`:

```bash
cp /absolute/path/to/template/dist/index.js /path/to/project/.opencode/plugin/opencode-copilot-multi-auth.js
```

## Account Storage

Accounts are stored in:

```
~/.config/opencode/copilot-accounts.json
```

This file includes OAuth refresh tokens. Treat it as sensitive and keep it private.

## Policy Constraints

GitHub terms prohibit account sharing and token sharing to exceed rate limits:

- https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#3-account-requirements
- https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#h-api-terms
