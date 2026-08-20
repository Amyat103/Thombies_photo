-- Fix: members_select_own_trips' USING clause queries public.members from
-- within a policy on public.members, which re-triggers the same policy and
-- raises "infinite recursion detected in policy for relation members" for
-- any authenticated read of a trip-scoped row (this table can never safely
-- re-query itself under RLS). Route the membership check through a
-- SECURITY DEFINER function instead, which evaluates outside RLS.

create function public.is_trip_member(
  p_trip_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.members
    where members.trip_id = p_trip_id
      and members.user_id = p_user_id
  );
$$;

revoke all on function public.is_trip_member(uuid, uuid) from public;
grant execute on function public.is_trip_member(uuid, uuid) to authenticated;

drop policy "members_select_own_trips" on public.members;

create policy "members_select_own_trips"
  on public.members
  for select
  using (public.is_trip_member(members.trip_id, auth.uid()));
