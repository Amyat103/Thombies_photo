-- Admin un-batching (v5 §3: "the admin can remove any prompt from
-- rotation regardless of how it got there," no qualification on the
-- batch's current voting state). Mirrors
-- prompts_update_admin_promote_to_batch (20260820130000_batches_prompts.sql)
-- reversed: same inline admin-ownership check on trips.created_by (no
-- helper, matching that policy's and prompts_update_admin_approve_reject's
-- convention), same approval_status defense-in-depth style, but moving
-- batch_id from set back to null instead of null to set.
--
-- No grants migration needed: prompts already has UPDATE granted to
-- authenticated (20260820170000_grant_table_privileges.sql, reaffirmed by
-- 20260820190000_lock_down_authenticated_privileges.sql). This migration
-- only adds a new policy gating an already-granted operation.

create policy "prompts_update_admin_unbatch"
  on public.prompts
  for update
  using (
    batch_id is not null
    and approval_status = 'approved'
    and exists (
      select 1 from public.trips
      where trips.id = prompts.trip_id
        and trips.created_by = auth.uid()
    )
  )
  with check (
    batch_id is null
    and exists (
      select 1 from public.trips
      where trips.id = prompts.trip_id
        and trips.created_by = auth.uid()
    )
  );

-- Cross-policy check (done before applying, per the requested walkthrough):
-- prompts now carries three permissive UPDATE policies. Postgres RLS
-- combines multiple permissive policies on the same command via OR across
-- both USING and WITH CHECK independently -- a single UPDATE need only
-- satisfy *some* policy's USING on the old row and *some* policy's WITH
-- CHECK on the new row, not the same policy's pair. That's exactly the
-- mechanism that caused the approve/reject-session loophole (a single
-- UPDATE satisfying promote_to_batch's USING while sneaking a WITH CHECK
-- from approve_reject, or vice versa), fixed there by extending
-- prompts_prevent_immutable_column_changes to block approval_status and
-- batch_id changing together.
--
-- Checked every new cross-combination this policy introduces:
--
-- 1. unbatch USING (batch_id not null, approved) + approve_reject WITH
--    CHECK (approval_status in approved/rejected): would let an admin flip
--    an already-approved, still-batched prompt to 'rejected' while leaving
--    batch_id untouched. Blocked by the existing trigger: it already
--    requires old.approval_status = 'pending' before allowing any
--    approval_status change, and a batched prompt is never pending
--    (invariant: batch_id only becomes non-null via promote_to_batch,
--    which requires approval_status = 'approved' already). No new
--    exposure -- already covered.
--
-- 2. approve_reject USING (source=user, pending) + unbatch WITH CHECK
--    (batch_id null): a pending prompt's batch_id is already null (INSERT
--    policy forces batch_id null for source='user' rows, and only
--    promote_to_batch -- which requires approval_status='approved' -- can
--    set it). WITH CHECK's batch_id is null requirement is then a no-op
--    against an already-null value. No new capability.
--
-- 3. promote_to_batch USING (batch_id null, approved) + unbatch WITH CHECK
--    (batch_id null): both sides require batch_id null, so this is a
--    no-op update (batch_id doesn't actually change). Not dangerous.
--
-- 4. unbatch USING (batch_id not null, approved) + promote_to_batch WITH
--    CHECK (batch_id not null, target batch belongs to the same trip):
--    THIS IS NEW AND DANGEROUS. It lets a single UPDATE move a prompt's
--    batch_id directly from one live batch to a *different* live batch in
--    the same trip, skipping the null intermediate state that both
--    policies individually assume. Neither policy alone allows this (each
--    only handles one direction against a null endpoint), but the OR
--    combination does. This matters because entries/votes are attached to
--    prompt_id, not batch_id -- silently reassigning an already-populated
--    prompt to a different batch would transplant its existing
--    entries/votes into a batch with a possibly different status
--    (submitting/voting/closed), corrupting that batch's data.
--
-- (4) is not covered by the existing immutable-columns trigger, which only
-- blocks approval_status+batch_id changing *together* -- it says nothing
-- about batch_id moving between two non-null values on its own. Closing
-- it requires a new check, added below by extending the same trigger:
-- batch_id may move null -> set (promote) or set -> null (unbatch), but
-- never directly between two non-null values in one step. An admin who
-- wants to move a prompt to a different batch still can -- just as two
-- separate UPDATEs (unbatch, then promote) -- which re-passes it through
-- both policies' individual gates instead of exploiting the OR-combined
-- gap.
--
-- 5. A second gap, pre-existing since the approve/reject migration and not
--    introduced by this one, but only found by this same walkthrough:
--    approve_reject's USING never checks batch_id, and promote_to_batch's
--    WITH CHECK never checks approval_status. Take a still-pending
--    source='user' prompt (batch_id null) and run an UPDATE that touches
--    ONLY batch_id (null -> a real batch in the same trip), leaving
--    approval_status untouched at 'pending'. USING is satisfied by
--    approve_reject (source='user', approval_status='pending', admin --
--    all true against the old row). WITH CHECK is satisfied by
--    promote_to_batch (batch_id not null, valid batch, admin -- all true
--    against the new row, since it never inspects approval_status). The
--    approval_status-change guard in the trigger doesn't fire because
--    approval_status never actually changes (still 'pending' before and
--    after). Net effect: a prompt that was never approved gets promoted
--    straight into a live batch, skipping admin approval entirely.
--    Closed below by independently requiring old.approval_status =
--    'approved' whenever batch_id transitions null -> non-null,
--    regardless of which policy's clauses admitted the write -- the same
--    defense-in-depth reasoning as the original approve/reject fix: don't
--    trust RLS's OR-combined policies alone to enforce a precondition the
--    trigger can re-verify directly.

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

  if new.batch_id is distinct from old.batch_id
     and old.batch_id is not null
     and new.batch_id is not null then
    raise exception 'batch_id cannot move directly from one batch to another; unset it first';
  end if;

  if new.batch_id is distinct from old.batch_id
     and old.batch_id is null
     and new.batch_id is not null
     and old.approval_status <> 'approved' then
    raise exception 'only an approved prompt can be promoted into a batch';
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
