# Trip Photo Game

React Native (Expo) + Expo Router app, Supabase backend (no custom API server). Full product spec and current build status: @trip-photo-game-concept-v4.md and @trip-photo-game-project-brief.md — read both before making any product or architecture decision that isn't already answered there. Ask, don't assume.

## Architecture

- No hand-written backend routes. Supabase auto-generates REST access per table; authorization is enforced via RLS policies on the table, not application code. A new table without a matching RLS policy is a bug, not a later step.
- Anything needing real logic (scheduled auto-close, recap generation) goes in a Supabase Edge Function — never a separately hosted server.
- Invite flow is room-code only for MVP. No tappable deep link, no domain dependency, no Universal Links/App Links. Don't reintroduce that without confirming first — it was deliberately cut.
- One game mode only. This app doesn't have configurable game types or hypothetical variants — don't add abstraction or config surface for cases that don't exist yet.

## Scope discipline

Build only what the current requirement asks for. Don't add config options,
abstraction layers, or handling for scenarios not in the spec docs — even if
they seem likely to come up later. If a future need seems real, flag it in
the response instead of building for it.

When reviewing a diff (self-review or adversarial subagent review), ask:
"Does every piece of this diff trace back to something in the spec docs?"
Flag anything that doesn't — don't just check whether the code looks reasonable.

## Bash commands

- `npx expo start` — run the dev server
- `npx expo install <package>` — use this instead of `npm install` for any Expo-managed package; it resolves compatible versions automatically
- `eas build --profile development` — local dev build

_(test/lint/typecheck commands: fill in once they exist)_

## Gotchas

- RLS policy correctness is this app's actual security boundary — a missing or wrong policy is how one trip's data leaks into another's.
- Supabase Auth bills per monthly active user past the free tier (50k MAU) — irrelevant at this app's scale, but don't assume Auth is unconditionally free at any scale.
- App name is not finalized. Don't let a placeholder harden into a bundle ID, package name, or store listing without confirming first.

## Open product decisions — ask, don't assume

- Whether user-added prompts need admin approval before going live
- Whether members vote on which user-added prompts enter rotation
- Whether `voting_mode` (EOD/EOT) is trip-wide or per prompt-batch
- Whether the trip-wide recap rolls up in-trip meta-superlatives
- Final app name

See @trip-photo-game-project-brief.md §3–4 for full context on each.
