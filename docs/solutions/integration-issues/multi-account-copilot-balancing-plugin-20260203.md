---
module: opencode-copilot-load-balancer
date: 2026-02-03
problem_type: integration_issue
component: plugin_auth
symptoms:
  - "Invalid 'tools[12].function.name': string does not match pattern"
  - "Multiple github.com accounts show identical 'github.com' label"
  - "Hybrid strategy sticks to one account indefinitely"
  - "Excessive toasts on every user message"
root_cause: validation_error
severity: medium
tags: [copilot, auth, load-balancing, opencode-plugin]
---

# Multi-Account Copilot Load Balancing & Visibility

## Symptoms

1.  **Tool Validation Error**: Adding the plugin caused OpenCode to crash or reject tools with:
    ```
    Invalid 'tools[12].function.name': string does not match pattern. Expected a string that matches the pattern '^[a-zA-Z0-9_-]+$'.
    ```
2.  **Identity Confusion**: When adding two `github.com` accounts, both were labeled "github.com" in logs and toasts, making it impossible to verify load balancing.
3.  **Stuck Strategy**: The `hybrid` strategy (default) would repeatedly select the same account even when others were healthy.
4.  **UI Noise**: Every single request (including user chat messages) triggered a "Copilot: github.com" toast.

## Root Cause

1.  **Tool Naming**: OpenCode tool names do not support dots (`.`). We were using `copilot.accounts.list`.
2.  **OAuth Flow**: The standard GitHub device flow does not provide a user-friendly label, and we weren't asking for one.
3.  **Scoring Logic**: The hybrid score calculation `(failures * -10) + lastUsed` gave a *higher* score to the most recently used account (larger timestamp), causing it to win every time.
4.  **Interceptor Logic**: The `copilot-fetch` wrapper did not distinguish between agent requests (which need attribution) and standard user messages.

## Solution

### 1. Rename Tools
Changed tool names to use hyphens instead of dots.

```typescript
// Before
'copilot.accounts.list': tool({...})

// After
'copilot-accounts-list': tool({...})
```

### 2. Add Account Labels
Modified the device flow to prompt for a label.

```typescript
// src/auth/device-flow.ts
prompts: [
  {
    type: 'text',
    key: 'label',
    message: 'Account label (e.g., personal, work)',
    // ...
  }
]
```

### 3. Fix Load Balancing Strategy
Inverted the scoring logic to prefer *least* recently used accounts (smaller timestamp = higher score).

```typescript
// src/accounts/manager.ts
// Before: + (account.lastUsed ?? 0)
// After:  - (account.lastUsed ?? 0)
const score = (account.consecutiveFailures ?? 0) * -10 - (account.lastUsed ?? 0);
```

### 4. Reduce Noise
Updated `copilot-fetch.ts` to only notify on agent requests, and `usage.ts` to use TUI logging.

```typescript
// src/fetch/copilot-fetch.ts
if (parsed.isAgent) {
  await manager.notifySelection(selection, modelId);
}
```

```typescript
// src/observe/usage.ts
// Switched from log.info (stdout) to log.debug (TUI hidden by default)
log.debug('account selected', { ... });
```

## Prevention

1.  **Tool Naming Convention**: Always use `kebab-case` or `snake_case` for OpenCode tools. Avoid special characters.
2.  **Load Balancing Verification**: When implementing LRU, verify the sort order (ascending vs descending timestamps).
3.  **User Experience**: For multi-instance resources (like accounts), always allow user-defined aliases/labels.
