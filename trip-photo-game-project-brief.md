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

**Instructed but NOT confirmed done — verify before assuming any of this works:**
- [ ] Expo Router manual wiring: `"main": "expo-router/entry"` in package.json, `app/_layout.tsx`, `app/index.tsx` — steps were given, execution was never confirmed
- [ ] `@supabase/supabase-js`, `@tanstack/react-query`, `zustand` — install *failed* with an ERESOLVE error; the `.npmrc` fix should resolve it, but the retry was never run/confirmed
- [ ] NativeWind — not attempted at all yet, only discussed
- [ ] `.env` with Supabase URL + anon key — not created
- [ ] `npx expo lint` — not run
- [ ] First git commit of the scaffold — not done
- [ ] The three corrected docs copied into the actual local repo (not just Claude project knowledge) and committed

**Not done, expected/deferred, not an oversight:**
- [ ] Sign in with Apple — deferred, not configured on Supabase side yet; needs to happen before App Store submission, not before
- [ ] Actual Postgres schema + RLS policies — only discussed conceptually (see §7), never written
- [ ] Auth flow UI (Google Sign-In button, email/password form, session handling) — not started
- [ ] Final app name / bundle identifiers / package names
- [ ] `tech-stack-v1.md` added to the repo itself (exists as a file, just not copied in yet)

## 7. Supabase mental model (for reference, already explained to founder once)

Plain CRUD (fetch prompts, submit photos, cast votes, read standings) → straight to Supabase's auto-generated REST API, secured entirely by RLS policies, no custom backend code. Anything with custom logic, secrets, third-party calls, or scheduled/triggered work (recap generation, later LLM calls for location prompts, push-notification triggers) → Edge Functions. Live vote/standings updates → Supabase Realtime (websocket subscriptions), also no server code. RLS is the actual security boundary — a misconfigured policy is the realistic failure mode for one trip's data leaking into another's, so policies need real care, not an afterthought.

## 8. Repo status

Not empty. Contains the three docs plus a working Expo scaffold with the full locked stack installed and verified running (`npx expo start -c` confirmed both Expo Router and NativeWind functioning).

## 9. Immediate next step

Two independent threads, neither blocks the other:

1. **Close out the scaffold** — confirm the Expo Router manual wiring, retry and confirm the failed package installs, add NativeWind, commit. Small, mechanical, should be quick to verify.
2. **Start the real backend work** — build the `trips` and `members` tables plus their RLS policies. This is genuinely backend-only, verifiable directly through Supabase without any screen needing to exist, and doesn't depend on the scaffold being finished.

Once both are done, the next slice is prompts/entries, then votes, then the auth flow UI, then trip creation/joining UI — each as its own scoped pass, `/clear` between major features per the workflow already agreed on.

## 10. Ground rules for whoever works on this next

- v5.md is the authoritative product spec. This brief is a status/delta layer on top of it, not a replacement.
- **Don't assume answers to anything listed in §3 or §4 as open.** Everything else has already been decided — check v5.md and this brief before asking the founder something already answered.
- Naming is unresolved — don't let a placeholder (`Thombies_photo`, "Trip Photo Game") harden into bundle IDs / store listings without confirming first.
