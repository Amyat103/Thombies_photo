-- entries + entry_flags: schema and RLS.
--
-- Extends the trips/members/batches/prompts schema
-- (20260820120000_trips_members.sql, 20260820130000_batches_prompts.sql)
-- without modifying it. Matches trip-photo-game-concept-v5.md §6.3
-- (entries/entry_flags spelled out as real tables in this revision) and
-- implements §6.8's two moderation requirements: admin can delete any
-- entry, any member can flag one.
--
-- Deliberately NOT built here: any votes/photo-voting table (still
-- "table not yet defined" per §6.3), any batches status-transition
-- logic, and any cron/scheduled logic (EOD auto-close, batch-gap
-- auto-open) — all separate, later work. entries has no UPDATE policy
-- (submissions are immutable once made) and entry_flags has no
-- UPDATE/DELETE policy at all (insert-only — unflagging isn't in spec,
-- unlike prompt_votes and photo-voting which are toggleable).

-- ---------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts (id),
  submitted_by uuid not null references auth.users (id),
  thumbnail_url text,
  full_res_url text,
  submitted_at timestamptz not null default now()
);

alter table public.entries enable row level security;

-- thumbnail_url/full_res_url are plain text columns for now -- storage
-- bucket setup and real file upload are deferred until a frontend
-- exists to do the upload (v5 §6.3). Left nullable since there's
-- nothing to populate them with yet.

create function public.entry_count_for_user(
  p_prompt_id uuid,
  p_user_id uuid default auth.uid()
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.entries
  where entries.prompt_id = p_prompt_id
    and entries.submitted_by = p_user_id;
$$;

revoke all on function public.entry_count_for_user(uuid, uuid) from public;
grant execute on function public.entry_count_for_user(uuid, uuid) to authenticated;

create policy "entries_select_trip_members"
  on public.entries
  for select
  using (
    exists (
      select 1 from public.prompts
      where prompts.id = entries.prompt_id
        and public.is_trip_member(prompts.trip_id, auth.uid())
    )
  );

-- Insert requires, all at once: caller is a member of the prompt's trip,
-- the prompt's batch is currently accepting submissions, caller hasn't
-- hit the trip's entry_cap_per_prompt for this prompt yet, and the row
-- being inserted is attributed to the caller (not on someone else's
-- behalf).
create policy "entries_insert_member_within_cap"
  on public.entries
  for insert
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1
      from public.prompts
      join public.batches on batches.id = prompts.batch_id
      join public.trips on trips.id = prompts.trip_id
      where prompts.id = entries.prompt_id
        and batches.status = 'submitting'
        and public.is_trip_member(prompts.trip_id, auth.uid())
        and public.entry_count_for_user(entries.prompt_id, auth.uid())
              < trips.entry_cap_per_prompt
    )
  );

create policy "entries_delete_admin_only"
  on public.entries
  for delete
  using (
    exists (
      select 1 from public.prompts
      join public.trips on trips.id = prompts.trip_id
      where prompts.id = entries.prompt_id
        and trips.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- entry_flags
-- ---------------------------------------------------------------------

create table public.entry_flags (
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

alter table public.entry_flags enable row level security;

create policy "entry_flags_select_trip_members"
  on public.entry_flags
  for select
  using (
    exists (
      select 1 from public.entries
      join public.prompts on prompts.id = entries.prompt_id
      where entries.id = entry_flags.entry_id
        and public.is_trip_member(prompts.trip_id, auth.uid())
    )
  );

-- Any trip member may flag any entry in their trip, including their own
-- -- no self-flag restriction exists in the spec (unlike self-voting,
-- which has an explicit allow_self_vote trip setting).
create policy "entry_flags_insert_member"
  on public.entry_flags
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.entries
      join public.prompts on prompts.id = entries.prompt_id
      where entries.id = entry_flags.entry_id
        and public.is_trip_member(prompts.trip_id, auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

revoke all on public.entries from public, anon;
revoke all on public.entry_flags from public, anon;

grant select, insert, delete on public.entries to authenticated;
grant select, insert on public.entry_flags to authenticated;
