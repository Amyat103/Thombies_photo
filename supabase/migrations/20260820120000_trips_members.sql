-- trips + members: schema, RLS, and the two RPCs that own all writes to
-- either table (see plan doc for the chicken-and-egg reasoning behind the
-- RPC-only write path).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_photo text,
  created_by uuid not null references auth.users (id),
  start_date date,
  end_date date,
  invite_code text not null unique,
  allow_self_vote boolean not null default false,
  voting_mode text not null check (voting_mode in ('eod', 'eot')),
  entry_cap_per_prompt integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.trips enable row level security;
alter table public.members enable row level security;

-- ---------------------------------------------------------------------
-- trips policies
-- ---------------------------------------------------------------------

-- No INSERT policy: creation only happens via create_trip() below, so the
-- creator's members row is always created atomically with the trip.
-- No DELETE policy: trip deletion isn't in spec.

create policy "trips_select_member_or_creator"
  on public.trips
  for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.members
      where members.trip_id = trips.id
        and members.user_id = auth.uid()
    )
  );

create policy "trips_update_creator_only"
  on public.trips
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ---------------------------------------------------------------------
-- members policies
-- ---------------------------------------------------------------------

-- No INSERT policy: joining only happens via join_trip_by_code() below.

create policy "members_select_own_trips"
  on public.members
  for select
  using (
    exists (
      select 1 from public.members m2
      where m2.trip_id = members.trip_id
        and m2.user_id = auth.uid()
    )
  );

create policy "members_update_own_display_name"
  on public.members
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members_delete_by_trip_creator"
  on public.members
  for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = members.trip_id
        and trips.created_by = auth.uid()
    )
  );

-- RLS + the update policy above only restrict which rows a member can
-- target, not which columns they change. This trigger enforces the
-- "own display_name only" part at the DB level.
create function public.members_prevent_immutable_column_changes()
returns trigger
language plpgsql
as $$
begin
  if new.trip_id <> old.trip_id
     or new.user_id <> old.user_id
     or new.joined_at <> old.joined_at then
    raise exception 'trip_id, user_id, and joined_at cannot be changed';
  end if;
  return new;
end;
$$;

create trigger members_immutable_columns
  before update on public.members
  for each row
  execute function public.members_prevent_immutable_column_changes();

-- ---------------------------------------------------------------------
-- RPCs (security definer — bypass RLS internally, callable by authenticated
-- clients via .rpc(), never by anon)
-- ---------------------------------------------------------------------

create function public.create_trip(
  p_name text,
  p_invite_code text,
  p_display_name text,
  p_voting_mode text,
  p_cover_photo text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_allow_self_vote boolean default false,
  p_entry_cap_per_prompt integer default 1
)
returns public.trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip public.trips;
begin
  insert into public.trips (
    name, invite_code, created_by, cover_photo, start_date, end_date,
    voting_mode, allow_self_vote, entry_cap_per_prompt
  )
  values (
    p_name, p_invite_code, auth.uid(), p_cover_photo, p_start_date, p_end_date,
    p_voting_mode, p_allow_self_vote, p_entry_cap_per_prompt
  )
  returning * into v_trip;

  insert into public.members (trip_id, user_id, display_name)
  values (v_trip.id, auth.uid(), p_display_name);

  return v_trip;
end;
$$;

revoke all on function public.create_trip(
  text, text, text, text, text, date, date, boolean, integer
) from public;
grant execute on function public.create_trip(
  text, text, text, text, text, date, date, boolean, integer
) to authenticated;

create function public.join_trip_by_code(
  p_invite_code text,
  p_display_name text
)
returns public.trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip public.trips;
begin
  select * into v_trip
  from public.trips
  where invite_code = p_invite_code;

  if not found then
    raise exception 'invalid invite code';
  end if;

  insert into public.members (trip_id, user_id, display_name)
  values (v_trip.id, auth.uid(), p_display_name)
  on conflict (trip_id, user_id) do nothing;

  return v_trip;
end;
$$;

revoke all on function public.join_trip_by_code(text, text) from public;
grant execute on function public.join_trip_by_code(text, text) to authenticated;
