---
title: Rework account management without agent tools
type: feat
date: 2026-02-08
---

# Rework account management without agent tools

## Overview

Remove agent-exposed account management tools and re-implement account management in a human-only `opencode auth login` flow aligned with the opencode-antigravity-auth reference. The login flow should present interactive options (add/manage/remove) before device auth, while keeping runtime routing unchanged.

## Problem Statement / Motivation

The plugin currently exposes account management tools to agents, which is not desired in this plugin. Account operations should be human-initiated through `opencode auth login`, using an interactive menu (like opencode-antigravity-auth) to add accounts, disable/enable them, or remove them. Runtime routing, storage, and observability must remain intact.

## Proposed Solution

- Remove OpenCode tool registrations for account management from the plugin.
- Implement an interactive `opencode auth login` menu modeled on the reference UI:
  - Show existing accounts with status (enabled/disabled, last used).
  - Offer actions: Add new account, Manage accounts (enable/disable), Remove account, Remove all, Cancel.
  - Non-TTY fallback prompt that mirrors the menu choices.
- Use the chosen action to drive the device flow (GitHub.com or Enterprise) and persist changes to `~/.config/opencode/copilot-accounts.json`.
- Update documentation to describe the new login menu and remove all tool references.

## Technical Considerations

- **Auth login flow**: Integrate menu prompts into the auth method `authorize()` path used by `opencode auth login` (mirroring antigravity’s CLI behavior).
- **Account operations**: Implement enable/disable/remove using the same storage used by `CopilotAccountManager`.
- **Compatibility**: Maintain the current store schema (`version: 1`) and default missing `enabled` to true.
- **Agent access**: No account-management tools exposed; only the CLI path is supported.
- **Error handling**: Provide clear CLI messages for device auth failures and storage errors.

## Acceptance Criteria

- [x] `copilot-accounts-*` tools are no longer registered in `src/plugin.ts`.
- [x] Running `opencode auth login` shows an interactive menu when accounts exist.
- [x] Menu supports: Add new account, Manage (enable/disable), Remove account, Remove all, Cancel.
- [x] Non-TTY fallback prompt offers equivalent choices.
- [x] Add flow uses existing device authorization and label prompts; enterprise flow uses the enterprise URL prompt.
- [x] Disabled accounts are excluded from selection; removing or disabling the last enabled account is blocked or requires explicit override.
- [x] Duplicate account handling is defined (same account re-auth replaces tokens).
- [x] Documentation removes tool usage and describes the new login menu.
- [x] Tests cover menu selection, enable/disable, remove, and add flows.

## Success Metrics

- Zero references to account tools in docs and runtime registration.
- CLI account management is usable end-to-end without agent tools.
- No regressions in account rotation or selection for existing users.

## Dependencies & Risks

- **Reference parity**: Align menu and fallback behavior with the reference UI and CLI flow.
- **Schema changes**: Risk of breaking existing account store if migrations are not handled.
- **Last-account removal**: Potential for users to lock themselves out without guardrails.

## Implementation Notes

- **Tool removal**: Remove tool registrations in `src/plugin.ts` and delete usages of `src/auth/cli.ts` in tool definitions.
- **Auth login menu**: Add a new `src/auth/login-menu.ts` (or expand `src/auth/cli.ts`) with:
  - `promptLoginMode(existingAccounts)` using a TTY menu and fallback prompt (ported from `reference/opencode-antigravity-auth/src/plugin/ui/auth-menu.ts` and `reference/opencode-antigravity-auth/src/plugin/cli.ts`).
  - `promptAccountAction(account)` for per-account enable/disable/remove.
- **Integrate with auth methods**: In `src/auth/device-flow.ts` and `src/plugin.ts` loader, call the menu when `authorize()` is invoked via `opencode auth login` and accounts exist. Map menu result to:
  - Add: continue into the selected device flow.
  - Fresh start: clear store, then continue into device flow.
  - Manage/remove: update store and loop back to the menu.
  - Cancel: return a failed auth result with a clear message.
- **Storage rules**: Use account email/label + host or refresh token to dedupe on re-auth (see reference `persistAccountPool`), updating existing entries instead of adding duplicates.
- **Selection filtering**: Keep disabled accounts filtered in `src/accounts/manager.ts` (already enforced).
- **Docs**: Update `docs/ARCHITECTURE.md` and `docs/CONFIGURATION.md` to remove tool references and document the login menu.
- **Tests**: Add unit tests for menu selection and storage side effects (enable/disable/remove/add), using fixtures based on current store schema.

## Open Questions

- Should `opencode auth login` always show the menu when accounts exist, or only when invoked with a flag (e.g., `--manage`)?

Answer: always when selecting github copilot as the provider, the new options should be visible after selecting Github Copilot and then either just sign in or manage, and manage opens the new management list.

- Should removal/disable of the last enabled account be blocked by default or allowed with a `--force` flag?

Answer:allow it, opencode should then not show any models from github copilot

- How should duplicates be detected (label+host, refresh token, or user id if available)?
  Answer: just rely on the IDs, but the list should show Label and then a short Id after that as a list.
- Should a non-interactive `--json` output mode be supported for future automation?
  Answer:No

## References & Research

### Internal References

- Tool registration: `src/plugin.ts`
- Account manager: `src/accounts/manager.ts`
- Account storage: `src/accounts/storage.ts`
- Auth CLI: `src/auth/cli.ts`
- Docs (tools mentioned): `docs/ARCHITECTURE.md`, `docs/CONFIGURATION.md`
- Learnings: `docs/solutions/integration-issues/multi-account-copilot-balancing-plugin-20260203.md`

### External References

- opencode-antigravity-auth: `reference/opencode-antigravity-auth/docs/MULTI-ACCOUNT.md`
- Auth menu UI: `reference/opencode-antigravity-auth/src/plugin/ui/auth-menu.ts`
- CLI login flow: `reference/opencode-antigravity-auth/src/plugin/cli.ts`
- Login integration: `reference/opencode-antigravity-auth/src/plugin.ts`
