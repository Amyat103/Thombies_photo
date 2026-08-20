# Trip Photo Game — Concept

_Updated from v3 — changes below reflect the mandatory-account model, admin-configurable voting timing, a lower default entry cap, and a restructured gamification section._

A trip-scoped group photo game. A group traveling together (or on a single day out) gets a rotating set of photo prompts, submits and votes on them, and ends the trip with a shareable recap of winners. The trip is the container; the game is the point. Not a planner — no itineraries, bookings, or expense splitting.

---

## 2. Core Loop

1. **Create a trip** — name, cover photo, rough length (or "ongoing"), invite via a unique link/QR or a typeable room code. No dates required.
2. **Admin starts the trip once** — a single "Start Trip" tap. From that timestamp, a new batch of prompts (e.g. 3) auto-generates every 24 hours.
3. **Submit within each prompt-batch's window.** One photo per prompt per user by default (admin can raise the cap — see 4.1). Voting no longer opens on the same fixed schedule for every trip; it opens according to the trip's voting-timing setting (see 2a).
4. **Standings** update live as votes come in.
5. **Trip wraps** — winners per prompt + an overall Trip MVP (most prompt wins), packaged as a shareable recap card. A prompt that never got enough votes before its window closed still shows its submitted photos in the recap, just with no crowned winner — and doesn't count toward anyone's MVP tally.

---

## 2a. Voting Timing

_New in this revision._ Rather than one fixed window for every trip, the admin picks how the trip votes:

- **End of Day (EOD)** — a fixed daily time (e.g. 10pm) that every member sees as a live countdown on their screen. When it hits, that day's open prompts flip into voting.
- **End of Trip (EOT)** — no countdown. The admin manually opens voting (a "Vote Now" tap or equivalent) whenever the group is ready — the mode for groups coordinating off-app or in person, e.g. everyone's physically together and the admin just triggers it.
  **Note:** the "48-hour rolling window" from the original core loop (each batch stays open 48 hours, overlapping ~24 hours with the next) is being kept as the _interim default_ behavior until EOD/EOT settings are built — not the intended long-term design. Subject to change.

Open question: is `voting_mode` a single trip-wide setting, or configurable per prompt-batch? Not yet decided.

---

## 2b. Trip Wrap

_New in this revision — fleshing out what was previously just step 5 of the core loop and a stray bullet in MVP scope._

**What triggers it:**

- **Manual "End Trip"** (primary) — admin taps it whenever the group's done. Any prompt-batch still in submission or voting at that moment gets force-closed: if it had enough votes, it resolves normally; if not, it falls into the existing no-forced-winner state (entries still shown in the recap, no winner crowned, doesn't count toward MVP).
- **15-day-inactivity auto-wrap** (backstop) — same force-close behavior, triggered by the clock instead of a tap, so a trip nobody remembers to formally end doesn't just hang open forever.
  **What the recap contains:**
- Per-prompt winners (photo + who submitted it)
- Trip MVP (most prompt wins) — the headline of the recap
- A generated collage/card pulling the winning shots together, meant to be legible as a standalone image, not just an in-app screen
- Prompts that never got enough votes still show their submitted photos, just with no winner (per the existing no-forced-winner rule)
  **Format:** a shareable recap card — an auto-generated image (grid of winning photos, prompt labels, MVP callout) that can be exported/shared outside the app (group chat, social), plus a persistent in-app page so the trip stays browsable after it's wrapped rather than disappearing once shared.

**Ties to other sections:**

- Feeds the cross-trip meta-game (4.3) — wrapping a trip is the moment a member's profile/trophy case actually gets updated with that trip's results (e.g. "MVP — Amsterdam 2026").
- Open question: does the recap also roll up the in-trip meta-superlatives (4.2 — Slowest Submitter, Most Controversial Photo, etc.) into a trip-wide "best of," or do those stay scoped to each individual voting round's carousel and not persist past it? Not decided.

---

## 3. Prompts

Each batch (~3 prompts) is a mix of:

**Generic prompts** — trip-agnostic, always available. Needs a bank of ~24–30 to avoid repeats across a week-long trip and across repeat use (a pool of 6 repeats within 2 days at 3/day).

_Revision note:_ the original examples (Best View, Best Food) skew toward passive documentation — capturing what's already there rather than creating a moment. The bank should skew toward prompts that manufacture an interaction, not just a photo op:

- Get a stranger to pose with you
- Recruit someone local to be in the shot
- Funniest Moment, Chaos Shot, Best Candid, Worst Decision (kept — already interaction-flavored)
- Best View, Best Food (kept as lower-effort filler, but shouldn't dominate the bank)
  Still needs fleshing out to the full ~24–30 — this is a direction, not a final list.

**Location-flavored prompts** (opt-in) — user drops in a place name ("Statue of Liberty," "night market"), app generates a custom prompt tied to it. MVP approach: template library keyed to place type (monument/nature/food/beach/nightlife/other) — cheap, instant, offline-friendly. LLM-generated prompts (fresh, scales to any place, needs moderation) are a fast-follow, not MVP.

This stays opportunistic by design, not itinerary-aware — nobody pre-loads stops, and a location prompt only exists if someone bothers to drop a pin in the moment. There's no itinerary being tracked for it to fall out of sync with (see the "not a planner" note above), so there's nothing to reconcile.

**User-added prompts** — members can also add their own custom prompt to the rotation, not just pick from the generic/location list. Keeps things creative and personal to the group instead of purely templated. Default assumption: any member can add one directly (same trust-based pattern as the rest of the app), admin can edit/remove via existing moderation powers. Whether new prompts need admin approval before going live isn't pinned down yet.

Open idea: let members vote on which user-added prompts actually enter the rotation, rather than only voting on photo entries within a prompt once it's live. This would need a prompt-voting UI distinct from entry-voting, and it intersects with the approval question above — if members already vote a prompt in, does it still need admin sign-off?

---

## 4. Gamification Mechanics

Restructured into three tiers, roughly by how much weight each carries — from moment-to-moment fun up through cross-trip identity.

### 4.1 In-trip ritual (the core loop)

**Prompt → Countdown → Vote → Live leaderboard.** This is the moment-to-moment fun, and the sync-vs-async voting decision (2a) lives here — it determines whether "Countdown" means a literal admin-set clock (EOD) or an ad-hoc "gather round" moment (EOT).

- **Entry cap per prompt** — one photo per prompt per user by default (admin can raise it) — keeps each prompt's voting pool manageable and forces curation. Worth noting: since upload from an existing camera roll is expected to be the more common path (not live in-app capture), the cap's real job is pool-size/curation control, not "rationing shutter presses" the way a disposable-camera app frames it. The cap itself still makes sense — the old disposable-camera rationale just doesn't map cleanly onto an upload-heavy flow.
- **Delayed/rolling reveal** — a prompt doesn't show results until it has enough entries.
- **Leaderboard** — running trip-wide score (prompt wins), not just per-prompt standings.
- **Superlative-style voting** — many small categories rather than one "best photo overall," so more people get a moment to win something.
- **Trip MVP** — end-of-trip roll-up, most prompt wins, shareable.

### 4.2 In-trip texture (commentary, not game state)

Doesn't change standings — cheap to add, high fun-per-effort, low risk:

- **Emoji reactions on entries** — thumbs down, poop emoji, etc., tapped live during voting. Rapid taps trigger a live, stacked animation + sound burst visible to everyone in the trip (TikTok-Live-style) — five poop-emoji taps in a row shows up as a little flurry on screen, not just a static counter. Purely commentary — not stored as part of anyone's score.
- **Meta-superlatives carousel** — a Wavelength-style set of stats shown right after each voting round's winner is announced: Slowest Submitter, Most Votes Cast, Most Controversial Photo (closest vote split), etc. Doesn't feed the Trip MVP tally — it's there to make the feed funnier to scroll back through.
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

Chosen over Flutter and native Swift/Kotlin. React Native's New Architecture (JSI, Fabric, TurboModules) has been bridgeless by default since 0.78, with the legacy bridge fully removed as of 0.82. Flutter's Impeller engine is a comparable step forward on its side. For an app like this (feed, grid, voting UI, leaderboard), neither framework's raw performance is something end users would notice — the deciding factors are ecosystem and fit, not speed:

- Larger JS/TS talent pool and library ecosystem than Flutter's Dart — matters for a solo/small build.
- Mature camera/photo libraries via Expo (`expo-camera`, `expo-image-picker`, `expo-image-manipulator`) map directly onto this app's needs.
- Shares code/concepts with a future companion web view, which Flutter Web doesn't match as cleanly.
- Native Swift/Kotlin ruled out — doubles build effort before the concept is validated.
  React Native renders through real native components, so iOS/Android can look slightly different by default unless unified with a small shared design system — worth building early. Where native behavior genuinely differs (camera permissions, photo picker sheet, back-gesture), that's treated as a feature for a camera-centric app, not a bug.

Invite links use `nanoid` for the code (short, URL-safe, standard) and Universal Links (iOS) / App Links (Android) for the open-app-or-fallback behavior — both free, both built into Expo. The same nanoid code also works as a typeable room code, so a group that's physically together can join by typing a short code instead of tapping a link. Falls back to a small hosted web page (not directly to the App Store) if the app isn't installed; that page is what shows the store links. Revocation is just regenerating the invite code.

### 6.2 Backend — Supabase

Postgres database, Auth, S3-compatible Storage, Realtime (WebSocket subscriptions — powers live standings), Edge Functions (recap generation, later LLM calls), and Row Level Security (enforces "only trip members see this trip's data" — still needs care, since a misconfigured policy is how one trip's data leaks into another's, even with every member on a real account now).

Covers most of what Firebase would, except push notifications and analytics. Push is covered by Expo's own free push service — free, but still needs a server-side trigger (an Edge Function deciding when to call Expo's push API); it removes the need for Firebase Cloud Messaging specifically, not the engineering work. Analytics isn't needed at MVP scale. Firebase's offline sync is more mature, but this app's offline need is simple (queue an upload for when signal returns), so that gap doesn't really apply. Self-hosting the whole Supabase stack is available later if cost or data control becomes a priority.

"Real-time-ish" doesn't need to be true real-time — polling or foreground refresh is enough.

### 6.2a Accounts

**Updated: every member now needs a real account, not just the trip creator.** This removes the anonymous-session tier entirely, along with the fragility it caused — previously, a lost phone or reinstall wiping an anonymous session was fine to lose for a regular member but bad for an admin; now that everyone's on a real account, that asymmetry goes away for everyone.

Practical effects of the change:

- Drops the anonymous-auth path from Supabase entirely — no more "manual linking" upgrade flow, no anonymous-to-permanent conversion step, no need for the CAPTCHA-on-anonymous-signup Supabase recommends.
- Standard signup abuse protections (email verification, normal rate-limiting) now apply to everyone, not just the creator; friend-group trust is still the main deterrent against fake accounts or self-voting workarounds, same as before.
- Trade-off: joining used to be tap-link → type display name → in. Now every joiner goes through account creation, which adds friction. What that flow actually looks like (email + password, magic link, OAuth-only) isn't decided yet — see open items.
- Upside: this is what makes the cross-trip meta-game (4.3) — profile, trophy case, points — straightforward to build, since there's no longer an anonymous-user population that can't carry a persistent identity across trips.

### 6.3 Data model (rough sketch)

```
Trip
 ├─ id, name, cover_photo, created_by (permanent account), start_date?, end_date?, invite_code (doubles as room code), allow_self_vote (bool, default false), voting_mode (eod | eot | rolling_48hr_default), entry_cap_per_prompt (default 1)
 ├─ Members[]  (user_id — real account, display_name, joined_at)
 ├─ Days[]
 │    ├─ day_number
 │    └─ Prompts[]  (e.g. 3 per batch)
 │         ├─ text, category_tag, location_tag?
 │         ├─ Entries[]
 │         │    ├─ photo_url, submitted_by, submitted_at
 │         │    └─ Votes[] (voter_id, timestamp)
 └─ Recap (per-prompt winners, MVP, collage)
```

Entry and vote caps are scoped per prompt-instance, not per category (a category like "food" spans many prompts across the trip — capping per-category would mean one Best Food vote for the whole trip). Re-voting is allowed, not locked after the first vote — tap the same entry again to unvote.

`entry_cap_per_prompt` and `voting_mode` are trip-level settings the admin controls. Entry cap now defaults to 1 (was 3); `voting_mode` defaults to the rolling 48-hour window pending EOD/EOT (see 2a).

### 6.4 Photo handling

In-app camera and gallery upload both available at submission — upload is probably the more common path in practice. Every submitted photo gets one default "disposable camera" look (grainy/old) baked in automatically as post-processing, applied identically regardless of capture path — cheaper than a live camera shader, same visual result. No filter picker at MVP. Client-side compression before upload. Thumbnail + full-res pair stored (feed/standings load thumbnails, full photo on tap). Offline capture queues uploads for when signal returns.

### 6.5 Notifications

Default-on, opt-out — but rate-capped (roughly one soft nudge per prompt) and casual in tone, not a guilt mechanic. For EOD trips, the nightly countdown itself doubles as a natural nudge; the existing rate cap still applies on top of that.

### 6.6 AI/LLM usage (fast-follow, not MVP)

Location → prompt generation via a small cached LLM call per place name, with light moderation on generated prompts (avoid anything inappropriate near religious/historic sites).

### 6.7 Cost estimate

Supabase free tier: 500MB database, 1GB file storage, 5GB egress/month, auto-pauses after 7 days inactive. A single real trip (8 people × 3 prompts/day × 1 photo × 5 days ≈ 120 photos, down from ~360 under the old 3-photo cap) runs roughly 130–230MB after compression — comfortably inside the free storage tier on its own, though egress from everyone repeatedly viewing the feed can still add up toward the 5GB/month cap. The lower cap pushes back, but doesn't eliminate, the point at which Pro tier ($25/month flat — 8GB database, 100GB storage, spend cap available) becomes worth budgeting for, especially once admins start raising the per-prompt cap above the new default of 1 — still worth planning for once this reaches an actual friend group, not treated as a later milestone.

### 6.8 MVP scope

**In:**

- Create trip (real account required for creator _and_ every joining member), invite via unique link/QR or typeable room code
- Generic + user-added prompts (location-flavored prompts are a fast-follow)
- Photo submission with per-prompt cap (default 1 photo per prompt per user, admin-configurable), in-app camera + gallery upload, default filter
- Voting with admin-configurable timing — EOD countdown or EOT manual trigger (see 2a); the 48-hour rolling window remains the interim default until EOD/EOT ships. Re-voting allowed.
- Live standings, end-of-trip recap with the no-forced-winner fallback
- Self-voting toggle (default off)
- Top Judge badge
- Minimal moderation: admin can delete any entry, any member can flag one — required for App Store review (guideline 1.2, user-generated content needs a report + removal path)
- Admin can remove a member (recalculates standings, keeps their existing photos unless separately deleted), edit/skip a prompt, edit trip settings anytime — single admin only, no co-admin capability yet; accepted for now, worth reconsidering if it becomes a real problem
- Trip Wrap (see 2b): manual "End Trip" is primary, 15-day-inactivity auto-wrap is a backstop
  **Out (fast-follows):**
- Location-aware LLM prompt generation
- Multiple/selectable filters (MVP ships with one default look)
- Fuller badge system beyond Top Judge
- Web join/vote flow
- Emoji reactions + meta-superlatives carousel (4.2) — cheap and self-contained, a good candidate for the first fast-follow after MVP
- Cross-trip meta-game: profile/trophy case + points system (4.3) — more feasible now that accounts are mandatory, but still real scope, not MVP

---

**Known open items:**

- Whether user-added prompts need admin approval before going live, or post directly.
- Whether members can vote on which user-added prompts enter the rotation, not just on entries within a prompt that's already live.
- What the joiner account-creation flow looks like (email/password, magic link, OAuth-only) now that anonymous join is gone.
- Whether `voting_mode` (EOD/EOT) is set once per trip or configurable per prompt-batch.
- Whether the trip-wide recap rolls up in-trip meta-superlatives (4.2) into a "best of," or those stay scoped to each round's carousel.
