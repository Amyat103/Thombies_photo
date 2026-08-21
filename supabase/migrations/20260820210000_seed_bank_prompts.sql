-- Seed the generic prompt bank (v5 §3): trip-agnostic templates, always
-- available, inserted as bank rows (trip_id null, source='generic').
--
-- approval_status is deliberately omitted from every INSERT below --
-- prompts_set_approval_status (20260820130000_batches_prompts.sql) forces
-- it to 'approved' for source='generic' rows in a BEFORE INSERT trigger,
-- which runs ahead of the NOT NULL constraint check, so leaving it unset
-- here is correct, not an oversight.
--
-- 'Funniest Moment' may already exist as a manually-inserted test row from
-- an earlier session and may or may not have survived subsequent
-- test-data purges. Guarded with WHERE NOT EXISTS so this migration is
-- safe to apply regardless of that row's current state, without needing
-- to check first. The other 29 rows are new and inserted unconditionally.

insert into public.prompts (trip_id, text, category_tag, source)
select null, 'Funniest Moment', 'reaction', 'generic'
where not exists (
  select 1 from public.prompts
  where trip_id is null
    and source = 'generic'
    and text = 'Funniest Moment'
);

insert into public.prompts (trip_id, text, category_tag, source) values
  (null, 'Chaos Shot', 'reaction', 'generic'),
  (null, 'Best Candid', 'candid', 'generic'),
  (null, 'Worst Decision', 'reaction', 'generic'),
  (null, 'Best View', 'filler', 'generic'),
  (null, 'Best Food', 'filler', 'generic'),
  (null, 'Get a stranger to pose with you', 'interaction', 'generic'),
  (null, 'Recruit someone local to be in the shot', 'interaction', 'generic'),
  (null, 'Trade something with a stranger and photograph it', 'interaction', 'generic'),
  (null, 'Get someone to teach you a local word or phrase', 'interaction', 'generic'),
  (null, 'Swap an item of clothing with someone in the group', 'interaction', 'generic'),
  (null, 'Photobomb a stranger''s photo', 'interaction', 'generic'),
  (null, 'Get a thumbs-up from someone you just met', 'interaction', 'generic'),
  (null, 'Find someone doing the exact same thing as you, pose together', 'interaction', 'generic'),
  (null, 'Ask a stranger for directions, capture the moment', 'interaction', 'generic'),
  (null, 'Get a stranger to be your "tour guide" for one photo', 'interaction', 'generic'),
  (null, 'Recreate a famous pose or statue with a stranger''s help', 'interaction', 'generic'),
  (null, 'Best high-five or handshake with someone new', 'interaction', 'generic'),
  (null, 'Whole group in one shot, no exceptions', 'group', 'generic'),
  (null, 'The group''s most absurd coordinated photo', 'group', 'generic'),
  (null, 'Group silhouette', 'group', 'generic'),
  (null, 'We probably shouldn''t be doing this', 'reaction', 'generic'),
  (null, 'Most overpacked or most underdressed member', 'reaction', 'generic'),
  (null, 'Best "we''re lost" moment', 'reaction', 'generic'),
  (null, 'Someone trying something for the first time', 'candid', 'generic'),
  (null, 'Worst selfie attempt', 'candid', 'generic'),
  (null, 'Someone asleep or completely zoned out', 'candid', 'generic'),
  (null, 'The group''s MVP snack', 'filler', 'generic'),
  (null, 'Best animal encounter (if one happens)', 'filler', 'generic'),
  (null, 'Best sunset or golden-hour shot', 'filler', 'generic');
