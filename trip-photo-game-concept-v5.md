# Trip Photo Game — Concept

*Updated from v4 — this revision folds in decisions made in a follow-up planning conversation (see trip-photo-game-project-brief.md and trip-photo-game-tech-stack-v1.md for the full discussion): EOD/EOT mechanics finalized, the default photo filter removed, invite links simplified to room-code-only for MVP, the prompt approval/selection mechanism decided, and several previously-open items resolved. Where this doc conflicts with anything in v4, this version is authoritative.*

A trip-scoped group photo game. A group traveling together (or on a single day out) gets a rotating set of photo prompts, submits and votes on them, and ends the trip with a shareable recap of winners. The trip is the container; the game is the point. Not a planner — no itineraries, bookings, or expense splitting.

---

## 2. Core Loop

1. **Create a trip** — name, cover photo, rough length (or "ongoing"), invite via a typeable room code. No dates required.
2. **Admin starts the trip once** — a single "Start Trip" tap. A new batch of prompts (e.g. 3) opens automatically after a gap once the previous batch's voting closes — not on a separate fixed timer, and not immediately (see 2a).
3. **Submit within each prompt-batch's window.** One photo per prompt per user by default (admin can raise the cap — see 4.1). Voting opens according to the trip's voting-timing setting (see 2a).
4. **Standings** update live as votes come in.
5. **Trip wraps** — winners per prompt + an overall Trip MVP (most prompt wins), packaged as a shareable recap. A prompt that never got enough votes before its window closed still shows its submitted photos in the recap, just with no crowned winner — and doesn't count toward anyone's MVP tally.

---

## 2a. Voting Timing

The admin picks how the trip votes, set once per trip as a labeled setting — kept as a named choice (not collapsed into one universal button) specifically so members know what to expect from the group, even though both modes are admin-triggered under the hood:

- **End of Day (EOD)** — a 48-hour timer starts when a round begins. If the admin doesn't act, voting auto-triggers when the timer runs out. The admin can also manually close the round early, anytime within that window. (This resolves what earlier drafts described as a temporary "rolling 48-hour window" — that behavior turned out to be EOD's actual intended design, not a placeholder.)
- **End of Trip (EOT)** — no fixed deadline. The admin manually triggers voting whenever the group's ready — typically once, often days after the trip itself has ended. Needs a rare auto-close backstop so a trip can't stay open indefinitely; this likely shares a mechanism with the Trip Wrap inactivity backstop (2b).

A batch is its own entity, independent of calendar days — there's no assumption of "one batch per day." When a batch closes (voting ends, under either mode), the next batch doesn't open right away: there's a deliberate gap before it opens, starting at **4 hours**. That number is explicitly tunable later, not a structural decision worth debating now. This gap needs its own scheduled check to open the next batch once the wait elapses — the same category of job as the EOD 48-hour auto-close, to be built in a later session, not now.

---

## 2b. Trip Wrap

**What triggers it:**
- **Manual "End Trip"** (primary) — admin taps it whenever the group's done. Any prompt-batch still in submission or voting at that moment gets force-closed: if it had enough votes, it resolves normally; if not, it falls into the existing no-forced-winner state (entries still shown in the recap, no winner crowned, doesn't count toward MVP).
- **15-day-inactivity auto-wrap** (backstop) — same force-close behavior, triggered by the clock instead of a tap, so a trip nobody remembers to formally end doesn't just hang open forever. Exact mechanics still just a placeholder note — not designed yet, may change.

**What the recap contains:**
- Per-prompt winners (photo + who submitted it)
- Trip MVP (most prompt wins) — the headline of the recap
- Prompts that never got enough votes still show their submitted photos, just with no winner (per the existing no-forced-winner rule)
- Per-round meta-superlatives (4.2) are shown live each round, and the underlying data persists so the trip-wide recap can pull a trip-wide version of them — resolved, no longer an open question.

**Format:** deliberately undesigned for now, post-MVP. Earlier drafts assumed a single auto-generated shareable image (grid of winning photos, prompt labels, MVP callout); current thinking leans toward something closer to a multi-slide in-app experience instead, but this is explicitly not decided and not to be built until designed properly.

**Ties to other sections:**
- Feeds the cross-trip meta-game (4.3) — wrapping a trip is the moment a member's profile/trophy case actually gets updated with that trip's results (e.g. "MVP — Amsterdam 2026").

---

## 3. Prompts

Each batch (~3 prompts) is a mix of:

**Generic prompts** — trip-agnostic, always available. Needs a bank of ~24–30 to avoid repeats across a week-long trip and across repeat use (a pool of 6 repeats within 2 days at 3/day).

The bank should skew toward prompts that manufacture an interaction, not just a photo op:
- Get a stranger to pose with you
- Recruit someone local to be in the shot
- Funniest Moment, Chaos Shot, Best Candid, Worst Decision (already interaction-flavored)
- Best View, Best Food (kept as lower-effort filler, but shouldn't dominate the bank)

Still needs fleshing out to the full ~24–30 — this is a direction, not a final list.

**Location-flavored prompts** (opt-in) — user drops in a place name ("Statue of Liberty," "night market"), app generates a custom prompt tied to it. MVP approach: template library keyed to place type (monument/nature/food/beach/nightlife/other) — cheap, instant, offline-friendly. LLM-generated prompts (fresh, scales to any place, needs moderation) are a fast-follow, not MVP.

This stays opportunistic by design, not itinerary-aware — nobody pre-loads stops, and a location prompt only exists if someone bothers to drop a pin in the moment.

**User-added prompts** — members can add their own custom prompt to the rotation, not just pick from the generic/location list.

- **Approval:** requires admin approval before going live. Approval is a content filter only (spam, duplicates, inappropriate) — not a quality or popularity judgment.
- **Selection into rotation — two parallel paths:** the admin can add any approved prompt directly into rotation, anytime, no vote needed. Separately, the highest-voted approved prompt gets pulled in automatically as slots open, with no admin action required. Either way, the admin can remove any prompt from rotation regardless of how it got there. This gives admin and members each a distinct role — admin gates for appropriateness, the group's votes decide priority among what's already approved — rather than one overruling the other.

---

## 4. Gamification Mechanics

Restructured into three tiers, roughly by how much weight each carries — from moment-to-moment fun up through cross-trip identity.

### 4.1 In-trip ritual (the core loop)

**Prompt → Countdown → Vote → Live leaderboard.** This is the moment-to-moment fun, and the sync-vs-async voting decision (2a) lives here — it determines whether "Countdown" means the EOD 48-hour timer or an ad-hoc "gather round" EOT moment.

- **Entry cap per prompt** — one photo per prompt per user by default (admin can raise it) — keeps each prompt's voting pool manageable and forces curation. Since upload from an existing camera roll is expected to be the more common path (not live in-app capture), the cap's real job is pool-size/curation control, not "rationing shutter presses."
- **Delayed/rolling reveal** — a prompt doesn't show results until it has enough entries.
- **Leaderboard** — running trip-wide score (prompt wins), not just per-prompt standings.
- **Superlative-style voting** — many small categories rather than one "best photo overall," so more people get a moment to win something.
- **Trip MVP** — end-of-trip roll-up, most prompt wins, shareable.

### 4.2 In-trip texture (commentary, not game state)

Doesn't change standings — cheap to add, high fun-per-effort, low risk:

- **Emoji reactions on entries** — thumbs down, poop emoji, etc., tapped live during voting. Rapid taps trigger a live, stacked animation + sound burst visible to everyone in the trip (TikTok-Live-style). Purely commentary — not stored as part of anyone's score.
- **Meta-superlatives carousel** — a Wavelength-style set of stats shown right after each voting round's winner is announced: Slowest Submitter, Most Votes Cast, Most Controversial Photo (closest vote split), etc. Doesn't feed the Trip MVP tally. Underlying data persists so it can also feed the trip-wide recap (see 2b) — shown live each round *and* rolled up at the end, not an either/or.
- **Iconic-shot reference thumbnail** (optional, location prompts) — shows the cliché tourist photo as a joke target to subvert.
- **Top Judge badge** — awarded to whoever casts the most votes. One badge at MVP; a fuller badge system is a later add-on.

### 4.3 Cross-trip meta-game (identity & retention)

This is the tier with real architectural weight — it depends on accounts, not anonymity, and is meaningfully more feasible now that every member has a real account (see 6.2a) rather than just the trip creator:

- **Profile / trophy case** — past trip wins surface on a member's profile (e.g. "MVP — Amsterdam 2026," "Most Votes Cast — Paris 2027"), giving members a persistent identity across trips instead of resetting each time.
- **Points system** — some cross-trip score sits under the trophy case; not yet designed (does a prompt win always equal 1 point, does Top Judge carry points, do points decay over time — all open).

This tier is about identity and retention, not in-trip fun, and is the natural next investment once the account model settles.

---

## 5. What this deliberately does NOT do

- No itinerary building, scheduling, or booking integrations.
- No expense splitting.
- No requirement to add locations — generic prompts alone run the whole game.

---

## 6. Tech Considerations

### 6.1 Platform — React Native (Expo)

Chosen over Flutter and native Swift/Kotlin. React Native's New Architecture (JSI, Fabric, TurboModules) has been bridgeless by default since 0.78. For an app like this (feed, grid, voting UI, leaderboard), neither framework's raw performance is something end users would notice — the deciding factors are ecosystem and fit, not speed:

- Larger JS/TS talent pool and library ecosystem than Flutter's Dart — matters for a solo/small build.
- Mature camera/photo libraries via Expo (`expo-camera`, `expo-image-picker`, `expo-image-manipulator`) map directly onto this app's needs.
- Native Swift/Kotlin ruled out — doubles build effort before the concept is validated.

Uses Expo Router for navigation.

**Invites use `nanoid` for the room code** (short, URL-safe, standard). **MVP is room-code only** — a group joins by typing a short code, no tappable link. This was deliberately simplified from an earlier tappable-deep-link design (which would have needed Universal Links/App Links, a domain, and a fallback web page) — none of that infrastructure is needed for MVP. A "smart" tappable invite link (opens the app directly if installed, or redirects to the store if not) remains a plausible fast-follow, not something to build now.

### 6.2 Backend — Supabase

Postgres database, Auth, S3-compatible Storage, Realtime (WebSocket subscriptions — powers live standings), Edge Functions (scheduling logic, later LLM calls), and Row Level Security (enforces "only trip members see this trip's data" — still needs care, since a misconfigured policy is how one trip's data leaks into another's, even with every member on a real account).

Push is covered by Expo's own free push service — still needs a server-side trigger (an Edge Function deciding when to call Expo's push API).

"Real-time-ish" doesn't need to be true real-time — polling or foreground refresh is enough.

### 6.2a Accounts

Every member needs a real account, not just the trip creator — removes the anonymous-session tier entirely.

**Account creation:** Google Sign-In, Apple Sign-In, and email/password — all three, no magic link. (Apple's App Store rule requires Sign in with Apple once any other third-party social login — here, Google — is offered; this is already satisfied.)

Standard signup abuse protections (email verification, normal rate-limiting) apply to everyone; friend-group trust is still the main deterrent against fake accounts or self-voting workarounds.

Upside: this is what makes the cross-trip meta-game (4.3) — profile, trophy case, points — straightforward to build, since there's no anonymous-user population that can't carry a persistent identity across trips.

### 6.3 Data model (rough sketch)
```
Trip
 ├─ id, name, cover_photo, created_by (permanent account), start_date?, end_date?, invite_code (room code), allow_self_vote (bool, default false), voting_mode (eod | eot), entry_cap_per_prompt (default 1)
 ├─ Members[]  (user_id — real account, display_name, joined_at)
 ├─ Batches[]  (id, batch_number, opened_at, voting_deadline?, status: submitting|voting|closed, closed_at?, next_batch_opens_at?)
 │    └─ Prompts[]  (~3 per batch, via prompts.batch_id — see below)
 │         ├─ Entries[]
 │         │    ├─ photo_url, submitted_by, submitted_at
 │         │    └─ Votes[] (voter_id, timestamp)
 └─ Recap — design deferred, post-MVP; table shape not yet decided

Prompts (standalone table — bank templates and trip instances share it)
 ├─ id
 ├─ trip_id (nullable — null = reusable bank template, set = trip-specific instance)
 ├─ batch_id (nullable — null until selected into an open batch)
 ├─ text, category_tag, location_tag (nullable), source (generic | location | user)
 ├─ approval_status (pending | approved | rejected), added_by (nullable), created_at

Prompt_votes
 ├─ prompt_id, user_id, created_at — primary key (prompt_id, user_id)
```
Entry and vote caps are scoped per prompt-instance, not per category. Re-voting is allowed, not locked after the first vote — tap the same entry again to unvote.

`entry_cap_per_prompt` and `voting_mode` are trip-level settings the admin controls. Entry cap defaults to 1.

**Batches replace the old Days[] model.** A batch (~3 prompts) is its own entity, independent of calendar days — see 2a for the inter-batch gap and its `next_batch_opens_at` field. `voting_deadline` is only set for EOD-mode trips; EOT-mode batches leave it null and rely on the admin's manual trigger.

**Bank vs. instance:** selecting a bank template (`trip_id` null) into a trip creates a **new** `prompts` row — `trip_id` set, `text` copied, the original template row untouched. Selecting an already-pending trip prompt (`trip_id` already set, `batch_id` still null) into a live batch is an **update to that same row** — setting `batch_id` — not a new row. This keeps `prompt_votes` correctly attached through the pending→live transition, since votes are cast against the trip-scoped row from the moment it's created, not from the moment it enters a batch.

**Auto-approval:** `approval_status` is set to `approved` automatically at insert time when `source` is `generic` or `location` — only `source = 'user'` starts as `pending`, since location prompts are template-generated (not freeform user text) and don't need content moderation at MVP.

`prompt_votes` exists to support the top-voted-approved-prompt selection path (§3), but automatic promotion of the top-voted prompt into an open batch slot is deferred logic, not built yet — same deferred bucket as the EOD auto-close and the inter-batch gap timer.

### 6.4 Photo handling

In-app camera and gallery upload both available at submission — upload is probably the more common path in practice. **No filter or processing step** — an earlier idea (a default baked-in "disposable camera" grainy look) was considered and dropped; photos are stored as submitted. Client-side compression before upload. Thumbnail generated client-side (on the phone, before upload — cheapest option, no server compute per photo) + full-res pair stored (feed/standings load thumbnails, full photo on tap). Offline capture queues uploads for when signal returns.

### 6.5 Notifications

Default-on, opt-out — but rate-capped (roughly one soft nudge per prompt) and casual in tone, not a guilt mechanic.

### 6.6 AI/LLM usage (fast-follow, not MVP)

Location → prompt generation via a small cached LLM call per place name, with light moderation on generated prompts (avoid anything inappropriate near religious/historic sites).

### 6.7 Cost estimate

Supabase free tier comfortably covers MVP-scale usage for a real trip (8 people × 3 prompts/day × 1 photo × 5 days ≈ 120 photos). Worth planning for Pro tier ($25/month) once admins start raising the per-prompt cap above the default of 1, or once egress from repeated feed-scrolling adds up.

### 6.8 MVP scope

**In:**
- Create trip (real account required for creator *and* every joining member), invite via typeable room code only
- Generic + user-added prompts (admin-approved, selected via the two-path mechanism in §3), location-flavored prompts are a fast-follow
- Photo submission with per-prompt cap (default 1 photo per prompt per user, admin-configurable), in-app camera + gallery upload, no filter
- Voting with admin-configurable timing — EOD (48-hour timer, manual early-close available) or EOT (manual trigger, rare auto-close backstop) — see 2a. Re-voting allowed.
- Live standings, end-of-trip recap with the no-forced-winner fallback (recap format itself deferred, post-MVP)
- Self-voting toggle (default off)
- Top Judge badge
- Minimal moderation: admin can delete any entry, any member can flag one — required for App Store review (guideline 1.2)
- Admin can remove a member, edit/skip a prompt, edit trip settings anytime — single admin only, no co-admin capability yet
- Trip Wrap (see 2b): manual "End Trip" is primary, 15-day-inactivity auto-wrap is a backstop

**Out (fast-follows):**
- Location-aware LLM prompt generation
- A default photo filter or filter picker of any kind
- Tappable "smart" invite link (Universal Links/App Links, fallback web page)
- Fuller badge system beyond Top Judge
- Web join/vote flow
- Cross-trip meta-game: profile/trophy case + points system (4.3)

---

**Known open items (genuinely unresolved, do not assume answers):**
- Exact RLS policy wording and schema-level details — being worked out directly during implementation, not pre-specified here.
- Final app name — naming brainstorm never converged (see project-brief.md §4).
- Exact mechanics of the 15-day inactivity auto-wrap — still just a placeholder note, may change.
- Recap format/design — deliberately undesigned, post-MVP (see 2b).
