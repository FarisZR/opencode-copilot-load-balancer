---
title: feat: Copilot multi-account load balancing plugin
type: feat
date: 2026-02-03
---

# feat: Copilot multi-account load balancing plugin

## Overview
Create a new OpenCode plugin in `template/` that supports multiple GitHub Copilot accounts, balances requests across them for the same model, skips accounts that lack the requested model, and shows which account was used for each request. Use the official Copilot integration in `opencode-source` and load-balancing patterns from `opencode-antigravity-auth` as references.

## Problem Statement
OpenCode’s built-in Copilot auth supports a single account per provider. This prevents legitimate multi-account workflows (e.g., distinct personal/work Copilot subscriptions) and lacks transparent per-request account attribution. The new plugin should provide multi-account storage, safe rotation, and clear observability without modifying OpenCode core.

## Proposed Solution
Build a standalone plugin in `template/` that:
- Implements Copilot OAuth device flow (github.com + enterprise) based on `opencode-source/packages/opencode/src/plugin/copilot.ts`.
- Stores multiple accounts securely (0600) in a plugin-owned file.
- Wraps the Copilot provider fetch to choose an eligible account per request.
- Skips accounts lacking the requested model and retries using another account.
- Surfaces account selection per request via TUI toast + logs + metadata header.
- Applies rate-limit backoff and per-account cooldowns modeled on `opencode-antigravity-auth`.

## Technical Approach

### Architecture
- **Plugin entry point**: `template/src/index.ts` exports a plugin hook implementing `auth`, `chat.headers`, and a custom provider fetch override.
- **Auth flow**: Copy device-flow logic from `opencode-source/packages/opencode/src/plugin/copilot.ts` (client id, endpoints, polling), and extend with “add another account” prompts similar to `opencode-antigravity-auth` patterns.
- **Account storage**: Versioned JSON in `~/.config/opencode/copilot-accounts.json` (and project override `.opencode/copilot-accounts.json`).
- **Load balancing**: Strategy options (sticky/round-robin/hybrid) adapted from `opencode-antigravity-auth/src/plugin/accounts.ts`.
- **Model availability**: Maintain per-account model allow/deny list. Populate via `/models` if supported; otherwise “lazy detect” on model-not-found errors and cache with TTL.
- **Visibility**: For each request, emit a short TUI toast and write a log line; attach `x-opencode-copilot-account` header for debugging.

### Key design decisions (defaults)
- **Strategy**: `hybrid` (health + LRU) by default; optional `round-robin` for high throughput.
- **Model availability**: Lazy-detect + TTL cache; optional config to pre-seed allowlist.
- **Account visibility**: Toast per request (short duration) + logs; config to reduce noise.

### Compliance constraints (must be documented in README)
- **No account sharing** (GitHub Terms): https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#3-account-requirements
- **No token sharing to exceed rate limits**: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#h-api-terms
- **OAuth token issuance limit (10 tokens per user/app/scope)**: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#creating-multiple-tokens-for-oauth-apps

## Implementation Phases

### Phase 1: Plugin skeleton + config
- [x] Create plugin entry in `template/src/index.ts` with `Hooks` from `@opencode-ai/plugin`.
- [x] Add config schema in `template/src/config/schema.ts` (zod).
- [x] Add config loader in `template/src/config/load.ts` (project + global precedence).
- [x] Update package metadata in `template/package.json` and usage in `template/README.md`.

### Phase 2: Account storage + model cache
- [x] Implement account storage in `template/src/accounts/storage.ts` with 0600 permissions.
- [x] Add account manager in `template/src/accounts/manager.ts` with selection strategy and cooldowns.
- [x] Add model availability cache in `template/src/models/availability.ts` (TTL + lazy detection).

### Phase 3: OAuth + account management
- [x] Implement device flow in `template/src/auth/device-flow.ts` (github.com + enterprise).
- [x] Add “add account / manage accounts / disable account” prompts in `template/src/auth/cli.ts`.
- [x] Persist accounts and set a minimal auth entry for `github-copilot` in `template/src/auth/opencode-auth.ts` (to enable provider loading).

### Phase 4: Request routing + observability
- [x] Implement fetch wrapper in `template/src/fetch/copilot-fetch.ts`:
  - Select eligible account by model.
  - Inject Authorization + Copilot headers.
  - Retry on rate limits using backoff rules.
  - Mark model as unsupported on model-not-found.
- [x] Add per-request toast + log in `template/src/observe/usage.ts`.
- [x] Add `chat.headers` hook in `template/src/index.ts` for metadata header injection.

### Phase 5: Tests + docs
- [x] Add tests for selection and cooldown in `template/test/accounts.test.ts`.
- [x] Add tests for model availability handling in `template/test/models.test.ts`.
- [x] Add tests for fetch routing + fallback in `template/test/fetch.test.ts`.
- [x] Document config and security in `template/README.md` and `template/docs/CONFIGURATION.md`.

## Acceptance Criteria

### Functional
- [ ] Multiple Copilot accounts can be added, listed, enabled, and disabled.
- [ ] Each request selects an eligible account that supports the requested model.
- [ ] Accounts without a model are skipped (no request sent with that account).
- [ ] If an account is rate-limited, requests automatically fail over to another eligible account.
- [ ] If no eligible account remains, the user receives a clear error.

### Observability
- [ ] Every request emits account attribution (TUI toast + log + header).
- [ ] Logs include account label/host, model id, and selection reason.

### Compatibility
- [ ] Supports github.com and GitHub Enterprise hosts.
- [ ] Works with OpenCode’s existing Copilot provider wiring.

### Quality Gates
- [ ] `mise run test` passes in `template/`.
- [ ] `mise run typecheck` passes in `template/`.
- [ ] `mise run lint` passes in `template/`.
- [ ] `mise run build` passes in `template/`.

## Success Metrics
- Requests succeed across multiple accounts with reduced rate-limit errors.
- Clear per-request account visibility reported in TUI/logs.
- No regressions in Copilot provider behavior for single-account setups.

## Dependencies & Prerequisites
- Valid Copilot-enabled GitHub accounts.
- OAuth device flow endpoints (github.com + enterprise).
- `@opencode-ai/plugin` and `@opencode-ai/sdk` dependencies added to `template/package.json`.

## Risks & Mitigations
- **Policy risk**: Add explicit warnings to prevent account sharing and rate-limit evasion.
- **Token churn**: Respect GitHub’s 10-token limit by reusing stored tokens.
- **Log noise**: Provide config to reduce or suppress per-request toasts.
- **Model discovery uncertainty**: Use lazy detection with TTL fallback if `/models` isn’t supported.

## AI-era considerations
- Require full test + typecheck suite before marking complete.
- Document any AI-generated code sections for human review.

## References & Research

### Internal References
- `opencode-source/packages/opencode/src/plugin/copilot.ts`
- `opencode-source/packages/opencode/src/provider/provider.ts`
- `opencode-source/packages/plugin/src/index.ts`
- `opencode-antigravity-auth/src/plugin/accounts.ts`
- `opencode-antigravity-auth/docs/MULTI-ACCOUNT.md`
- `opencode-antigravity-auth/docs/CONFIGURATION.md`
- `opencode-source/packages/sdk/js/src/gen/sdk.gen.ts`

### External References
- GitHub OAuth device flow: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
- OAuth token limits: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#creating-multiple-tokens-for-oauth-apps
- GitHub Terms (account sharing): https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#3-account-requirements
- GitHub Terms (API token sharing): https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#h-api-terms
- GitHub Copilot product terms: https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#github-copilot
