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

## Account Management

Manage accounts through the `opencode auth login` flow. Select **GitHub Copilot** as the provider, then choose **Manage Accounts** from the list of options.

```bash
opencode auth login
```

From the management menu, you can view account status, toggle accounts (enable/disable), or remove accounts.

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
