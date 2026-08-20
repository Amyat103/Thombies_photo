-- Fix: `authenticated` has held TRUNCATE (plus TRIGGER, REFERENCES) on every
-- table since each table was created -- these come from Postgres's default
-- privilege behavior at table-creation time and were never actually
-- revoked, since every prior grants migration
-- (20260820170000_grant_table_privileges.sql and this feature's own
-- 20260820180000_entries.sql) only revoked from `public, anon`, not
-- `authenticated`. TRUNCATE specifically bypasses row security entirely --
-- Postgres does not apply RLS to TRUNCATE -- so any signed-in user could
-- wipe any table platform-wide, regardless of what its policies say.
--
-- Fix: revoke everything from `authenticated` on each table, then re-grant
-- exactly the privileges each table's RLS policies were already designed
-- to support (same lists as 20260820170000 and 20260820180000 -- no
-- behavior change, just closing the TRUNCATE/TRIGGER/REFERENCES gap those
-- migrations left open).

revoke all on public.trips from authenticated;
revoke all on public.members from authenticated;
revoke all on public.batches from authenticated;
revoke all on public.prompts from authenticated;
revoke all on public.prompt_votes from authenticated;
revoke all on public.entries from authenticated;
revoke all on public.entry_flags from authenticated;

grant select, update on public.trips to authenticated;
grant select, update, delete on public.members to authenticated;
grant select on public.batches to authenticated;
grant select, insert, update on public.prompts to authenticated;
grant select, insert, delete on public.prompt_votes to authenticated;
grant select, insert, delete on public.entries to authenticated;
grant select, insert on public.entry_flags to authenticated;
