# Trip Photo Game — Project Brief & Status

*Compiled 2026-08-19 from the full prior conversation history (4 chats spanning Aug 9–17). This is the handoff document — read this first if you're a new session (including Claude Code) picking up this repo with no other context. It does not duplicate the full product spec; it points to it and tells you what's decided, what's not, and what state the build is in.*

---

## 1. What this is

A trip-scoped group photo game (mobile app). A friend group traveling together gets rotating photo prompts, submits and votes on them, and ends the trip with a shareable recap of winners. The trip is the container; the game is the point. **Explicitly not a planner** — no itineraries, bookings, or expense splitting.

Target user (proposed by Claude, **never explicitly confirmed by the founder** — treat as a working hypothesis, not a locked decision): a friend group of ~4–10 already taking a ton of trip photos and dumping them in a group chat, who wants a game layer without another social network to manage. Think college friend groups, bach trips, annual friend-group trips, festival crews — not solo travelers, not families, not influencer-style documentors.

## 2. Product spec — where it lives

The authoritative, detailed product spec is **`trip-photo-game-concept-v4.md`** (in project files). This brief does not restate it. Key things worth knowing about its state:

- v4 is a revision of v3, produced by walking through founder notes on: entry caps, mandatory accounts, invite flow, voting timing (EOD/EOT), gamification tiers, and prompt direction (steering away from passive "Best View"-style prompts toward interaction-forcing ones like "get a stranger to pose with you").
- Section 2b (Trip Wrap) was added in a later pass — what triggers a wrap, what the recap contains, how it ties to the cross-trip meta-game.
- **v4.md's own "Known open items" list is still fully open** — nothing in this brief resolves those. They're listed again in §3 below so they're not buried.

## 3. Product — open questions (not decided, do not assume answers)

From v4.md directly:
- Whether user-added prompts need admin approval before going live, or post directly.
- Whether members can vote on which user-added prompts enter the rotation (vs. only voting on entries within a live prompt).
- What the joiner account-creation flow actually looks like (email/password, magic link, OAuth-only) now that anonymous join is gone.
- Whether `voting_mode` (EOD/EOT) is set once per trip or configurable per prompt-batch.
- Whether the trip-wide recap rolls up in-trip meta-superlatives (4.2) into a "best of," or those stay scoped to each round's carousel.

From the fundamentals discussion (proposed answers exist but **founder never confirmed or pushed back**):
- 3-month success definition, v1 timing, and retention story were all proposed as hypotheses by Claude, contingent on team size/timeline info the founder never supplied. Don't treat any of it as locked — re-ask if it matters for a current decision.

## 4. Naming / branding — NOT finalized

A naming brainstorm happened but did not converge on a final name. Status:
- Ruled out: disposable-camera/retro-film direction (founder's reasoning: the filter is a minor feature, not core enough to brand around), chaos/group-chat-energy names, judge/voting-forward names as a standalone direction.
- Kept exploring: game/competition energy × trip/travel portmanteaus, and simple one-word brandable names.
- Landed on a 3-concept matrix (Friends × Roam/Travel/Explore × Photo), mixing 1–3 word combos. Last direction being explored: an "explorer" root (dual meaning: travel + searching/discovering) and a hunt/scout mechanical angle, plus invented blends (Roamzy, Snapzy, etc.). No winner was picked.
- **`Thombies_photo` (the GitHub repo name) is almost certainly a placeholder, not a decided brand name.** Don't treat it as final; ask before it ends up baked into bundle IDs, package names, or App Store listings.

## 5. Tech stack — locked

Confirmed directly by the founder (2026-08-19). **Note: no `tech-stack-v1.md` file actually exists in the project** — despite being referenced as if it does, it was never created in any prior session. This list is the closest thing to that doc right now; consider formalizing it as an actual file.

- **Platform:** React Native via Expo, using Expo Router
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions + RLS) — see §7 below for the mental-model summary already covered with the founder
- **State:** React Query (server state) + Zustand (client state)
- **Styling:** NativeWind
- **Deploy:** EAS Build + EAS Submit + EAS Update
- **Scheduling:** Supabase `pg_cron` (for things like the 15-day inactivity auto-wrap, EOD voting triggers)

Supporting details already settled in v4.md §6.1–6.6 (still valid, not superseded by anything above): `nanoid` for invite/room codes, Universal Links/App Links for invite open-or-fallback, Expo's push service (not FCM), client-side compression + thumbnail/full-res pairs for photos, one baked-in default photo filter (no filter picker at MVP).

## 6. Infrastructure & accounts — status

**Done, already live:**
- [x] Supabase project created, configured with RLS-safe defaults
- [x] Google Sign-In wired into Supabase Auth (Web application OAuth client, confirmed working)
- [x] Expo/EAS account created
- [x] Google Play Console account created (verification in progress)
- [x] Apple Developer account exists
- [x] GitHub repo created and cloned locally (`Thombies_photo`) — **currently empty**

**Not done:**
- [ ] Sign in with Apple — deferred, not configured on Supabase side yet
- [ ] Expo project itself — nothing scaffolded into the repo yet
- [ ] Actual Postgres schema + RLS policies — only discussed conceptually (see §7), never written
- [ ] `tech-stack-v1.md` as an actual file (see §5)
- [ ] Final app name / bundle identifiers / package names

## 7. Supabase mental model (for reference, already explained to founder once)

Plain CRUD (fetch prompts, submit photos, cast votes, read standings) → straight to Supabase's auto-generated REST API, secured entirely by RLS policies, no custom backend code. Anything with custom logic, secrets, third-party calls, or scheduled/triggered work (recap generation, later LLM calls for location prompts, push-notification triggers) → Edge Functions. Live vote/standings updates → Supabase Realtime (websocket subscriptions), also no server code. RLS is the actual security boundary — a misconfigured policy is the realistic failure mode for one trip's data leaking into another's, so policies need real care, not an afterthought.

## 8. Repo status

```
git clone git@github.com:Amyat103/Thombies_photo.git
```
Repo exists, cloned, **confirmed empty**. Nothing has been scaffolded into it yet. It's ready for `create-expo-app` right now — nothing is blocking that.

## 9. Immediate next step (unblocked, can start now)

From inside the cloned (empty) repo folder, locally:

```bash
npx create-expo-app@latest . --template tabs
# or a blank TS template if the tabs starter isn't wanted — founder preference, not yet asked
npx expo install expo-router
```

Then install the rest of the locked stack (`@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `nativewind` + its Tailwind peer deps), wire up Expo Router's file-based structure, and connect to the existing Supabase project using the founder's Project URL + anon key.

This matches the founder's original 4-step ask for "this session":
1. Scaffold a new Expo project using Expo Router
2. Install/configure supabase-js, React Query, Zustand, NativeWind
3. Connect to the existing Supabase project (URL + anon key needed from founder)
4. Build a minimal working auth flow (Google Sign-In + email/password) as the first milestone

## 10. Ground rules for whoever works on this next

- v4.md is the authoritative product spec. This brief is a status/delta layer on top of it, not a replacement.
- **Don't assume answers to anything listed in §3 or §4 as open.** Ask the founder before making a product or architecture call that isn't already pinned down in v4.md or §5 of this brief.
- If you create `tech-stack-v1.md` for real, keep it in sync with §5 here (or better, make this brief just link to it once it exists, instead of both drifting independently).
- Naming is unresolved — don't let a placeholder (`Thombies_photo`, "Trip Photo Game") harden into bundle IDs / store listings without confirming first.
