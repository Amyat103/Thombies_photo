-- votes: schema and RLS, matching trip-photo-game-concept-v5.md §6.3.
--
-- Extends the trips/members/batches/prompts/entries schema
-- (20260820120000_trips_members.sql, 20260820130000_batches_prompts.sql,
-- 20260820180000_entries.sql) without modifying it. This is entry-level
-- voting for prompt winners -- a member holds at most one active vote per
-- prompt (PK is (prompt_id, user_id), not (entry_id, user_id)), matching
-- §4.1's "superlative-style voting" framing. Switching a vote to a
-- different entry within the same prompt is an UPDATE of entry_id;
-- removing a vote is a DELETE. No results/tally table -- standings stay a
-- live query (count(*) group by entry_id), per spec.
--
-- Deliberately NOT touched here: entries, entry_flags, prompt_votes, any
-- batches status-transition logic, and any cron/scheduled logic -- all
-- separate, untouched work.

create table public.votes (
  prompt_id uuid not null references public.prompts (id),
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (prompt_id, user_id)
);

alter table public.votes enable row level security;

-- RLS can gate which rows an UPDATE may target, not which columns change
-- within an allowed row. Only entry_id may ever change on an existing
-- votes row (the vote-switching path) -- mirrors
-- prompts_prevent_immutable_column_changes / members_prevent_immutable_
-- column_changes.
create function public.votes_prevent_immutable_column_changes()
returns trigger
language plpgsql
as $$
begin
  if new.prompt_id <> old.prompt_id
     or new.user_id <> old.user_id
     or new.created_at <> old.created_at then
    raise exception 'only entry_id can be changed on an existing vote';
  end if;
  return new;
end;
$$;

create trigger votes_immutable_columns
  before update on public.votes
  for each row
  execute function public.votes_prevent_immutable_column_changes();

create policy "votes_select_trip_members"
  on public.votes
  for select
  using (
    exists (
      select 1 from public.prompts
      where prompts.id = votes.prompt_id
        and public.is_trip_member(prompts.trip_id, auth.uid())
    )
  );

-- Insert requires, all at once: caller is a trip member, the prompt's
-- batch is currently accepting votes, entry_id actually belongs to
-- prompt_id (not some other prompt's entry), self-votes are only allowed
-- when the trip's allow_self_vote is true, and the row is attributed to
-- the caller.
create policy "votes_insert_own_vote"
  on public.votes
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.prompts
      join public.batches on batches.id = prompts.batch_id
      join public.entries on entries.id = votes.entry_id
      join public.trips on trips.id = prompts.trip_id
      where prompts.id = votes.prompt_id
        and entries.prompt_id = votes.prompt_id
        and batches.status = 'voting'
        and public.is_trip_member(prompts.trip_id, auth.uid())
        and (
          entries.submitted_by <> auth.uid()
          or trips.allow_self_vote = true
        )
    )
  );

-- Update is the vote-switching path: USING restricts which existing row
-- can be targeted (only your own vote); WITH CHECK re-evaluates the same
-- gating as INSERT against the new entry_id being switched to, plus a
-- membership re-check for defense-in-depth against a member being
-- removed between the original vote and the switch. prompt_id can't
-- actually differ from the old row (the immutable trigger above blocks
-- that), so re-deriving it from votes.prompt_id here is safe.
create policy "votes_update_switch_entry"
  on public.votes
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.prompts
      join public.batches on batches.id = prompts.batch_id
      join public.entries on entries.id = votes.entry_id
      join public.trips on trips.id = prompts.trip_id
      where prompts.id = votes.prompt_id
        and entries.prompt_id = votes.prompt_id
        and batches.status = 'voting'
        and public.is_trip_member(prompts.trip_id, auth.uid())
        and (
          entries.submitted_by <> auth.uid()
          or trips.allow_self_vote = true
        )
    )
  );

-- Removing your own vote is always safe regardless of current batch
-- state -- same reasoning as prompt_votes_delete_own_vote.
create policy "votes_delete_own_vote"
  on public.votes
  for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

-- Full lockdown from the start (per 20260820190000's convention) --
-- revoke authenticated's default privileges (including TRUNCATE) before
-- granting exactly what the policies above support.
revoke all on public.votes from public, anon, authenticated;

grant select, insert, update, delete on public.votes to authenticated;
