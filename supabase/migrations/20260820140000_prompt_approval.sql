-- Admin approve/reject for pending, user-submitted prompts (v5 §3: approval
-- is a content filter only -- spam/duplicates/inappropriate -- not a
-- quality or popularity judgment).

-- UPDATE: the trip's admin (creator) transitions a source='user' prompt
-- from approval_status='pending' to 'approved' or 'rejected', only within
-- their own trip. The immutable-columns trigger below independently
-- re-verifies this exact transition (defense-in-depth): with multiple
-- permissive UPDATE policies on this table, USING and WITH CHECK clauses
-- combine via OR across policies, so RLS alone can't stop a single UPDATE
-- from also sneaking a batch_id change past prompts_update_admin_promote_
-- to_batch's WITH CHECK while satisfying this policy's USING.
create policy "prompts_update_admin_approve_reject"
  on public.prompts
  for update
  using (
    source = 'user'
    and approval_status = 'pending'
    and exists (
      select 1 from public.trips
      where trips.id = prompts.trip_id
        and trips.created_by = auth.uid()
    )
  )
  with check (
    approval_status in ('approved', 'rejected')
    and exists (
      select 1 from public.trips
      where trips.id = prompts.trip_id
        and trips.created_by = auth.uid()
    )
  );

-- Extend the immutable-columns trigger: approval_status becomes
-- conditionally mutable (pending -> approved/rejected only), and may
-- never change in the same statement as batch_id.
create or replace function public.prompts_prevent_immutable_column_changes()
returns trigger
language plpgsql
as $$
begin
  if new.trip_id is distinct from old.trip_id
     or new.text <> old.text
     or new.category_tag <> old.category_tag
     or new.location_tag is distinct from old.location_tag
     or new.source <> old.source
     or new.added_by is distinct from old.added_by
     or new.created_at <> old.created_at then
    raise exception 'only batch_id and approval_status can be changed on an existing prompt';
  end if;

  if new.approval_status is distinct from old.approval_status then
    if new.batch_id is distinct from old.batch_id then
      raise exception 'approval_status and batch_id cannot change in the same update';
    end if;
    if old.approval_status <> 'pending'
       or new.approval_status not in ('approved', 'rejected') then
      raise exception 'approval_status may only transition from pending to approved or rejected';
    end if;
  end if;

  return new;
end;
$$;
