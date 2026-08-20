-- Fix: prompts_insert_member_own_trip's WITH CHECK self-joins prompts
-- (checking generic/location text against bank templates) from within a
-- policy on prompts itself. Postgres detects this as infinite recursion
-- at query-rewrite time -- rewriting must expand RLS quals for every
-- disjunct of WITH CHECK regardless of which branch is true at runtime --
-- so it blocks ALL inserts into prompts, not just generic/location ones.
-- Route the bank-template lookup through a SECURITY DEFINER function that
-- evaluates outside RLS, same fix pattern as is_trip_member().

create function public.bank_template_exists(
  p_source text,
  p_category_tag text,
  p_text text default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.prompts tmpl
    where tmpl.trip_id is null
      and tmpl.source = p_source
      and tmpl.category_tag = p_category_tag
      and (p_text is null or tmpl.text = p_text)
  );
$$;

revoke all on function public.bank_template_exists(text, text, text) from public;
grant execute on function public.bank_template_exists(text, text, text) to authenticated;

drop policy "prompts_insert_member_own_trip" on public.prompts;

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
        and public.bank_template_exists('generic', prompts.category_tag, prompts.text)
      )
      or (
        source = 'location'
        and location_tag is not null
        and public.bank_template_exists('location', prompts.category_tag)
      )
    )
  );
