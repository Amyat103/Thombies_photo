-- Fix: no table-level GRANT has ever been issued to the `authenticated`
-- role for any table in this schema. RLS policies only restrict access
-- that the underlying GRANT already permits -- without a GRANT, Postgres
-- denies with "permission denied for table X" before RLS is even
-- evaluated, making every existing policy moot. Grant exactly the
-- operations each table's existing RLS policies already gate (see the
-- comments in 20260820120000_trips_members.sql and
-- 20260820130000_batches_prompts.sql for why each omission below is
-- deliberate, not an oversight):
--   trips: no INSERT (create_trip() RPC only), no DELETE (not in spec)
--   members: no INSERT (join_trip_by_code() RPC only)
--   batches: SELECT only (INSERT/UPDATE/DELETE deferred to a later
--     security-definer scheduling RPC)
--   prompts: no DELETE (no policy exists for it)
--   prompt_votes: no UPDATE (a vote is binary -- insert to cast, delete to
--     unvote -- not editable)
-- Nothing granted to anon: every member needs a real account (v5 §6.2a),
-- so there's no anonymous-access tier to support.
--
-- Explicitly revoke first rather than assuming public/anon start with
-- nothing -- lock the starting state down instead of relying on it.

revoke all on all tables in schema public from public, anon;

grant select, update on public.trips to authenticated;
grant select, update, delete on public.members to authenticated;
grant select on public.batches to authenticated;
grant select, insert, update on public.prompts to authenticated;
grant select, insert, delete on public.prompt_votes to authenticated;
