# Trip Photo Game — Project Brief & Status

*Compiled 2026-08-19, corrected 2026-08-20. This is the handoff document — read this first if you're a new session (including Claude Code) picking up this repo with no other context. It does not duplicate the full product spec; it points to it and tells you what's decided, what's not, and what state the build is in.*

---

## 1. What this is

A trip-scoped group photo game (mobile app). A friend group traveling together gets rotating photo prompts, submits and votes on them, and ends the trip with a shareable recap of winners. The trip is the container; the game is the point. **Explicitly not a planner** — no itineraries, bookings, or expense splitting.

Target user (proposed by Claude, **never explicitly confirmed by the founder** — treat as a working hypothesis, not a locked decision): a friend group of ~4–10 already taking a ton of trip photos and dumping them in a group chat, who wants a game layer without another social network to manage.

## 2. Product spec — where it lives

The authoritative, detailed product spec is **`trip-photo-game-concept-v5.md`** (in project files). This brief does not restate it. v5 supersedes v4 — v4 is now historical only, not a source of truth for anything.

## 3. Product — open questions (genuinely unresolved, do not assume answers)

- Final app name — naming exploration never converged (see §4).
- Exact mechanics of the 15-day inactivity auto-wrap — still just a placeholder note in v5.md §2b, not designed.
- Exact RLS policy wording and schema-level detail — being worked out directly during implementation, not pre-specified.
- 3-month success definition, v1 timing, and retention story — proposed as hypotheses by Claude in an earlier session, never confirmed or pushed back on by the founder. Don't treat as locked.

**Everything else that was previously listed here is resolved as of v5.md — do not re-ask about:** prompt approval flow, the prompt selection mechanism (admin-add + top-voted-approved, admin can remove either), joiner account-creation flow (Google + Apple + email/password, no magic link), whether `voting_mode` is trip-wide (it is), or whether the recap rolls up meta-superlatives (it does).

## 4. Naming / branding — NOT finalized

A naming brainstorm happened but did not converge on a final name. Ruled out: disposable-camera/retro-film direction, chaos/group-chat-energy names, judge/voting-forward as a standalone direction. Still in play: game/competition energy × trip/travel portmanteaus, one-word brandable names, an "explorer" root, hunt/scout mechanical angle. No winner picked.

**`Thombies_photo` (the GitHub repo name) is almost certainly a placeholder, not a decided brand name.** Don't let it harden into bundle IDs, package names, or App Store listings without confirming first.

## 5. Tech stack — locked

- **Platform:** React Native via Expo (SDK 57), Expo Router, TypeScript
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions + RLS) — see §7 for the mental model
- **State:** React Query (server state) + Zustand (client state)
- **Styling:** NativeWind v4 + Tailwind v3 (the stable pairing — NativeWind v5/Tailwind v4 exists but is still preview software, deliberately not used)
- **Deploy:** EAS Build + EAS Submit + EAS Update
- **Scheduling:** Supabase `pg_cron`
- **Invites:** `nanoid`-based room code only — no tappable deep link, no domain, no Universal Links/App Links (cut from MVP, see v5.md §6.1)
- **Photos:** no filter/processing step (cut from MVP, see v5.md §6.4); thumbnails generated client-side before upload

`tech-stack-v1.md` exists as a real file now (created and iterated on during this conversation) — it has more detail and rationale (pros/cons, cost comparisons) behind each pick above than this brief restates. Not yet added to the actual repo — do that alongside v5.md.

## 6. Infrastructure & accounts — status

**Done, confirmed (verified via actual terminal output or screenshots, not just instructions given):**
- [x] Supabase project created, RLS-safe security settings configured (Data API on, auto-expose-new-tables off, automatic RLS on)
- [x] Google Sign-In wired into Supabase Auth (Web application OAuth client, credentials saved)
- [x] Google Play Console account created (full production path, $25 paid, identity + Android device verification submitted, in progress)
- [x] Apple Developer account exists (already had)
- [x] GitHub repo created and cloned locally (`Thombies_photo`)
- [x] Expo project scaffolded (blank TypeScript template, SDK 57) — confirmed indirectly, since the subsequent `expo install` succeeded in an SDK 57 context
- [x] `expo-router` and its 5 peer dependencies installed (`react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`, `expo-status-bar`) — confirmed via successful terminal output
- [x] `.npmrc` created with `legacy-peer-deps=true` — works around a known conflict in expo-router's bundled web tooling, unrelated to this app's actual usage
- [x] `CLAUDE.md`, `trip-photo-game-concept-v5.md`, and this brief added to Claude project knowledge (corrected versions)
- [x] `trips` and `members` tables + RLS policies + join/create RPCs (migration `20260820120000_trips_members.sql`)
- [x] `batches`, `prompts`, `prompt_votes` tables + RLS policies (migration `20260820130000_batches_prompts.sql`)
- [x] Admin approve/reject flow for user-added prompts (migration `20260820140000_prompt_approval.sql`)
- [x] `entries` and `entry_flags` tables + RLS policies (migration `20260820180000_entries.sql`)
- [x] `authenticated` privilege lockdown fix across all seven tables — `trips`, `members`, `batches`, `prompts`, `prompt_votes`, `entries`, `entry_flags` — closing a TRUNCATE hole that existed on every one of them, not just the two new ones (migration `20260820190000_lock_down_authenticated_privileges.sql` — a fix, not a new feature; same standing gotcha as the recursion/grant bugs below)

**Bugs found and fixed during the approve/reject session (2026-08-20) — a future session should know this happened, not just that the tables exist now:**
- [x] `members` RLS policy recursion — a policy on `members` queried `members` itself, causing infinite recursion; fixed with a SECURITY DEFINER helper function (migration `20260820150000_fix_members_recursion.sql`)
- [x] `prompts` RLS policy recursion — same class of bug, same fix pattern (migration `20260820160000_fix_prompts_recursion.sql`)
- [x] Missing table-level `GRANT`s to `authenticated` — RLS alone doesn't grant access, every table needs an explicit `GRANT` in addition to its policies; this was missing project-wide and is now fixed (migration `20260820170000_grant_table_privileges.sql`)

This is now a standing gotcha (see CLAUDE.md) — check for both of these (self-referencing RLS policies, missing grants) on every new table going forward, not just when something breaks.

**Closed out 2026-08-20 — verified directly (not from prior instructions), see the new gotchas below:**
- [x] Expo Router manual wiring: `"main": "expo-router/entry"` was already set; `app/_layout.tsx` and `app/index.tsx` were genuinely missing (no `app/` dir existed) — created now. The stale root `App.tsx` + `index.ts` default-template files were deleted — `main` already bypassed them, so they were dead code, not a second valid entry point.
- [x] `@supabase/supabase-js`, `@tanstack/react-query`, `zustand` — confirmed already installed and working (verified via `node_modules`, not just `package.json`) — the brief's claim that these failed to install was stale; they clearly succeeded at some point after the `.npmrc` fix and have been used throughout backend verification since.
- [x] NativeWind v4.2.6 + Tailwind v3 — installed and wired (`tailwind.config.js`, `global.css`, `babel.config.js`, `metro.config.js`, `nativewind-env.d.ts`). Two non-obvious transitive gotchas hit and fixed along the way, worth knowing for next time:
  - `babel-preset-expo` was present in `node_modules` but only nested under `node_modules/expo/node_modules/babel-preset-expo`, not hoisted to root — a root `babel.config.js` referencing it by name couldn't resolve it. Fixed by adding `babel-preset-expo@~57.0.7` as an explicit root devDependency, which forced npm to hoist/dedupe it.
  - NativeWind's bundled `react-native-css-interop@0.2.6` unconditionally references `react-native-worklets/plugin` in its Babel config (a hardcoded string, no existence check) and unconditionally `require("react-native-reanimated")` in its runtime CSS-interop code — both regardless of whether the app actually uses Reanimated/worklets features. Without both packages installed, the bundler fails outright at babel-config-load time and again at module-resolution time. Installed `react-native-worklets` and `react-native-reanimated` (both via `npx expo install`, SDK-57-compatible versions) purely to satisfy this — not because the app uses either directly. Also added `worklets: false` to the `babel-preset-expo` preset options in `babel.config.js` to skip *that* preset's own (safely-gated) auto-detection, separate from the interop bug.
- [x] `.env` with Supabase URL + anon key — was already present (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), brief incorrectly listed this as not done.
- [x] `npx expo start -c` — actually run and verified: iOS and Android bundles both build clean (`entry.bundle?platform=ios` / `=android` both return 200, ~1.7–1.8k modules, no babel/metro/NativeWind errors). Web bundling fails (`react-native-web` not installed) — expected and correct, not a bug: this app is mobile-only, web join/vote flow is explicitly out of MVP scope (v5.md §6.8).
- [x] `npx expo lint` — checked, not configured (no eslint config file, no eslint packages anywhere in the tree). Per scope discipline, did not trigger the interactive `eslint-config-expo` installer to "fix" this — that's a separate scope decision, not part of finishing the scaffold.
- [x] First git commit of the scaffold — done alongside this update.
- [x] The three corrected docs (`CLAUDE.md`, `trip-photo-game-concept-v5.md`, this brief) are already in the actual local repo, not just Claude project knowledge — confirmed via `git log`.

**Not done, expected/deferred, not an oversight:**
- [ ] Sign in with Apple — deferred, not configured on Supabase side yet; needs to happen before App Store submission, not before
- [ ] `votes` table (entry-level voting for prompt winners) + RLS policies — now modeled in v5.md §6.3, not yet built (current/next slice, see §9)
- [ ] Auth flow UI (Google Sign-In button, email/password form, session handling) — not started
- [ ] Final app name / bundle identifiers / package names
- [ ] `tech-stack-v1.md` added to the repo itself (exists as a file, just not copied in yet)

## 7. Supabase mental model (for reference, already explained to founder once)

Plain CRUD (fetch prompts, submit photos, cast votes, read standings) → straight to Supabase's auto-generated REST API, secured entirely by RLS policies, no custom backend code. Anything with custom logic, secrets, third-party calls, or scheduled/triggered work (recap generation, later LLM calls for location prompts, push-notification triggers) → Edge Functions. Live vote/standings updates → Supabase Realtime (websocket subscriptions), also no server code. RLS is the actual security boundary — a misconfigured policy is the realistic failure mode for one trip's data leaking into another's, so policies need real care, not an afterthought.

## 8. Repo status

Not empty. Contains the three docs plus a working Expo scaffold with the full locked stack installed and verified running — `npx expo start -c` actually run, iOS and Android bundles both confirmed clean (2026-08-20; see §6 for the transitive-dependency gotchas hit and fixed along the way).

## 9. Immediate next step

Backend work and the scaffold are now both closed out (see §6) — `trips`/`members`, `batches`/`prompts`/`prompt_votes`, admin approve/reject, `entries`/`entry_flags`, and the Expo Router + NativeWind scaffold are all done. One thread remains:

1. **Continue the backend work — `votes` table + RLS policies** (current/next slice). Schema shape is now spelled out in v5.md §6.3: primary key `(prompt_id, user_id)` (one active vote per member per prompt, not per entry), switching a vote is an `UPDATE` of `entry_id`, removing one is a `DELETE`, gated on the prompt's batch having `status='voting'` and on `allow_self_vote` for self-votes. Watch for the same two bug classes hit on every prior table: self-referencing RLS recursion (use a SECURITY DEFINER helper) and missing table-level `GRANT`s.

`votes` is the last table in the original `trips` → `prompts`/`batches` → `entries` → `votes` dependency chain — once it lands, remaining backend work is either the deferred cron/scheduling logic (EOD auto-close, inter-batch gap, 15-day inactivity auto-wrap) or the frontend thread, not another new table. After `votes`, the next step is the auth flow UI, then trip creation/joining UI — each as its own scoped pass, `/clear` between major features per the workflow already agreed on.

## 10. Ground rules for whoever works on this next

- v5.md is the authoritative product spec. This brief is a status/delta layer on top of it, not a replacement.
- **Don't assume answers to anything listed in §3 or §4 as open.** Everything else has already been decided — check v5.md and this brief before asking the founder something already answered.
- Naming is unresolved — don't let a placeholder (`Thombies_photo`, "Trip Photo Game") harden into bundle IDs / store listings without confirming first.
