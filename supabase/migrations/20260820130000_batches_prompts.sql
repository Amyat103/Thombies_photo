-- batches + prompts + prompt_votes: schema and RLS.
--
-- Extends the trips/members schema (20260820120000_trips_members.sql)
-- without modifying it. Matches trip-photo-game-concept-v5.md §6.3.
--
-- Deliberately NOT built here: any cron/scheduled logic (EOD auto-close,
-- batch-gap auto-open, top-voted-prompt auto-promotion) and any
-- entries/photo-votes tables — both are separate, later work. batches has
-- no INSERT/UPDATE policy for the same reason: opening batch #1 and
-- transitioning batch status belong to a security-definer RPC built
-- alongside that later scheduling work, not here.

-- ---------------------------------------------------------------------
-- batches
-- ---------------------------------------------------------------------

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  batch_number integer not null,
  opened_at timestamptz not null default now(),
  voting_deadline timestamptz,
  status text not null default 'submitting'
    check (status in ('submitting', 'voting', 'closed')),
  closed_at timestamptz,
  next_batch_opens_at timestamptz,
  unique (trip_id, batch_number)
);

alter table public.batches enable row level security;

create policy "batches_select_member_or_creator"
  on public.batches
  for select
  using (
    exists (
      select 1 from public.members
      where members.trip_id = batches.trip_id
        and members.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policy: opening batch #1 (Start Trip) and
-- transitioning status (manual EOD early-close, EOT trigger, and the
-- deferred auto-open/auto-close cron) all belong to a security-definer RPC
-- built in a later scheduling session, not this one.

-- ---------------------------------------------------------------------
-- prompts
-- ---------------------------------------------------------------------

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips (id) on delete cascade,
  batch_id uuid references public.batches (id),
  text text not null,
  category_tag text not null,
  location_tag text,
  source text not null check (source in ('generic', 'location', 'user')),
  approval_status text not null
    check (approval_status in ('pending', 'approved', 'rejected')),
  added_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.prompts enable row level security;

-- Forces approval_status from source regardless of what the caller passes,
-- so it can never be spoofed via a bad client or a future write path that
-- forgets to set it. BEFORE INSERT triggers run before RLS's WITH CHECK is
-- evaluated, so downstream policies see the corrected value.
create function public.prompts_enforce_approval_status()
returns trigger
language plpgsql
as $$
begin
  if new.source = 'user' then
    new.approval_status := 'pending';
  else
    new.approval_status := 'approved';
  end if;
  return new;
end;
$$;

create trigger prompts_set_approval_status
  before insert on public.prompts
  for each row
  execute function public.prompts_enforce_approval_status();

-- Only batch_id may ever change on an existing prompts row (the promotion
-- path). Mirrors members_prevent_immutable_column_changes.
create function public.prompts_prevent_immutable_column_changes()
returns trigger
language plpgsql
as $$
begin
  if new.trip_id is distinct from old.trip_id
     or new.text <> old.text
     or new.category_tag <> old.category_tag
     or new.location_tag is distinct from old.location_tag
     or new.source <> old.source
     or new.approval_status <> old.approval_status
     or new.added_by is distinct from old.added_by
     or new.created_at <> old.created_at then
    raise exception 'only batch_id can be changed on an existing prompt';
  end if;
  return new;
end;
$$;

create trigger prompts_immutable_columns
  before update on public.prompts
  for each row
  execute function public.prompts_prevent_immutable_column_changes();

-- SELECT: bank templates (trip_id null) are visible to anyone authenticated
-- (no trip to leak); trip-scoped rows are visible to that trip's members.
create policy "prompts_select_bank_or_member"
  on public.prompts
  for select
  using (
    trip_id is null
    or exists (
      select 1 from public.members
      where members.trip_id = prompts.trip_id
        and members.user_id = auth.uid()
    )
  );

-- INSERT: a trip member inserts a new, unbatched, self-attributed row into
-- a trip they belong to, gated further per source:
--   - source='user': any trip member (approval forced to 'pending' by the
--     trigger above) — the member's own custom prompt.
--   - source='generic': admin (trip creator) ONLY, and must match an
--     existing bank template's text and category_tag exactly (generic
--     text is never customized) — curating which always-available generic
--     prompts enter the trip's pool is an admin decision, not a
--     spontaneous member action.
--   - source='location': any trip member — inherently member-initiated
--     (dropping a pin) — must match a bank template's source+category_tag
--     (text is customized with the place name, so no exact-text match) and
--     must carry a location_tag.
create policy "prompts_insert_member_own_trip"
  on public.prompts
  for insert
  with check (
    trip_id is not null
    and batch_id is null
    and added_by = auth.uid()
    and exists (
      select 1 from public.members
      where members.trip_id = prompts.trip_id
        and members.user_id = auth.uid()
    )
    and (
      source = 'user'
      or (
        source = 'generic'
        and exists (
          select 1 from public.trips
          where trips.id = prompts.trip_id
            and trips.created_by = auth.uid()
        )
        and exists (
          select 1 from public.prompts tmpl
          where tmpl.trip_id is null
            and tmpl.source = 'generic'
            and tmpl.category_tag = prompts.category_tag
            and tmpl.text = prompts.text
        )
      )
      or (
        source = 'location'
        and location_tag is not null
        and exists (
          select 1 from public.prompts tmpl
          where tmpl.trip_id is null
            and tmpl.source = 'location'
            and tmpl.category_tag = prompts.category_tag
        )
      )
    )
  );

-- UPDATE: admin promotes an approved, unbatched trip prompt into one of
-- their trip's batches by setting batch_id. The immutable-columns trigger
-- above guarantees nothing else can change; this policy just gates who can
-- flip batch_id and that the target batch actually belongs to the same
-- trip.
create policy "prompts_update_admin_promote_to_batch"
  on public.prompts
  for update
  using (
    batch_id is null
    and approval_status = 'approved'
    and exists (
      select 1 from public.trips
      where trips.id = prompts.trip_id
        and trips.created_by = auth.uid()
    )
  )
  with check (
    batch_id is not null
    and exists (
      select 1 from public.batches
      where batches.id = prompts.batch_id
        and batches.trip_id = prompts.trip_id
    )
    and exists (
      select 1 from public.trips
      where trips.id = prompts.trip_id
        and trips.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- prompt_votes
-- ---------------------------------------------------------------------

create table public.prompt_votes (
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (prompt_id, user_id)
);

alter table public.prompt_votes enable row level security;

create policy "prompt_votes_select_trip_members"
  on public.prompt_votes
  for select
  using (
    exists (
      select 1 from public.prompts
      join public.members on members.trip_id = prompts.trip_id
      where prompts.id = prompt_votes.prompt_id
        and members.user_id = auth.uid()
    )
  );

-- Vote toggle = INSERT to cast, DELETE to unvote (same interaction model
-- v5 describes for photo-entry votes, applied here since the composite PK
-- already makes double-voting impossible). No UPDATE policy — a vote is
-- binary, not editable.
create policy "prompt_votes_insert_own_vote"
  on public.prompt_votes
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.prompts
      join public.members on members.trip_id = prompts.trip_id
      where prompts.id = prompt_votes.prompt_id
        and prompts.trip_id is not null
        and prompts.batch_id is null
        and prompts.approval_status = 'approved'
        and members.user_id = auth.uid()
    )
  );

create policy "prompt_votes_delete_own_vote"
  on public.prompt_votes
  for delete
  using (user_id = auth.uid());
