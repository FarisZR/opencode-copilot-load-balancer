# Architecture

The OpenCode Copilot Multi-Account Plugin provides a transparent load-balancing layer for GitHub Copilot. It intercepts outgoing Copilot requests and routes them across multiple configured accounts.

## Core Components

### 1. Account Manager (`src/accounts/manager.ts`)

The central authority for account state.

- **Storage**: Persists accounts to `~/.config/opencode/copilot-accounts.json`.
- **Selection Strategy**:
  - `hybrid` (default): Prefers accounts that are not in cooldown and uses a least-recently-used (LRU) scoring mechanism to balance load.
  - `sticky`: Uses the first available account until it hits a rate limit.
  - `round-robin`: Rotates accounts on every request.
- **Cooldowns**: When an account hits a rate limit (429) or auth error (401/403), it is put into a temporary cooldown.

### 2. Copilot Fetch Interceptor (`src/fetch/copilot-fetch.ts`)

A custom `fetch` implementation injected into the OpenCode auth hook.

- **Interception**: It parses the request body to identify the model ID.
- **Routing**: It calls the Account Manager to select an account and updates the `Authorization` header with that account's access token.
- **Retries**: If a request fails with a rate limit, it automatically tries a different eligible account (if available).
- **Token Refresh**: Automatically handles OAuth token refreshing before making requests.

### 3. Model Availability Cache (`src/models/availability.ts`)

Tracks which models are supported by which accounts.

- **Lazy Detection**: If an account returns a 404/400 indicating a model is not found, that model is marked as unsupported for that specific account.
- **Filtering**: Future requests for that model will skip the unsupported account.

### 4. Observability (`src/observe/usage.ts`)

Provides feedback on account usage.

- **Toasts**: Shows a transient UI notification when an agent call is made, identifying the account label.
- **Structured Logs**: Emits DEBUG level logs via the OpenCode TUI logging system, including the model ID and selection reason.
- **Headers**: Optionally attaches `x-opencode-copilot-account` to outgoing requests for external debugging.

## Auth Flow

The plugin implements two OAuth device flows:

1. **GitHub.com**: Supports a custom **Account label** prompt during login to distinguish between multiple personal/work accounts.
2. **Enterprise**: Allows specifying a custom enterprise host.

## Account Management

Accounts are managed via the `opencode auth login` flow. When accounts already exist, the login flow shows an interactive menu to sign in, manage accounts (enable/disable), or remove accounts.
