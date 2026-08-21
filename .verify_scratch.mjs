import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import fs from 'fs';

// batches has no client-side INSERT/UPDATE policy (deliberately deferred to
// a later security-definer scheduling RPC, per 20260820130000_batches_
// prompts.sql), so batch creation and status flips for these tests go
// through the CLI's linked-project SQL access instead of either client.
function runSql(sql) {
  const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', sql], {
    cwd: '/Users/hninleileitun/david-code/Thombies_photo',
    encoding: 'utf8',
  });
  return JSON.parse(out).rows;
}

const envPath = '/Users/hninleileitun/david-code/Thombies_photo/.env';
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const ADMIN_EMAIL = 'dev_admin@gmail.com';
const ADMIN_PASSWORD = '123';
const MEMBER_EMAIL = 'dev_member@gmail.com';
const MEMBER_PASSWORD = '123';

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function signIn(email, password) {
  const client = createClient(url, key);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`signInWithPassword(${email}) failed: ${error.message}`);
  }
  return client;
}

console.log('--- Sign in ---');
const adminClient = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
console.log(`Admin signed in: ${ADMIN_EMAIL}`);
const memberClient = await signIn(MEMBER_EMAIL, MEMBER_PASSWORD);
console.log(`Member signed in: ${MEMBER_EMAIL}`);

console.log('\n--- Setup: create trip, join, insert pending prompt ---');

const inviteCode = 'vf' + Math.random().toString(36).slice(2, 8);

const { data: trip, error: createTripError } = await adminClient.rpc('create_trip', {
  p_name: 'Verification Trip',
  p_invite_code: inviteCode,
  p_display_name: 'Admin Tester',
  p_voting_mode: 'eod',
});
if (createTripError) throw new Error(`create_trip failed: ${createTripError.message}`);
console.log(`Trip created: ${trip.id} (invite code ${inviteCode})`);

const { data: joinedTrip, error: joinError } = await memberClient.rpc('join_trip_by_code', {
  p_invite_code: inviteCode,
  p_display_name: 'Member Tester',
});
if (joinError) throw new Error(`join_trip_by_code failed: ${joinError.message}`);
console.log(`Member joined trip: ${joinedTrip.id}`);

const { data: pendingPrompt, error: insertPromptError } = await memberClient
  .from('prompts')
  .insert({
    trip_id: trip.id,
    text: 'Get a stranger to pose with you',
    category_tag: 'interaction',
    source: 'user',
    added_by: (await memberClient.auth.getUser()).data.user.id,
  })
  .select()
  .single();
if (insertPromptError) throw new Error(`prompt insert failed: ${insertPromptError.message}`);
console.log(`Pending prompt created: ${pendingPrompt.id}, approval_status=${pendingPrompt.approval_status}`);

console.log('\n--- Verification cases ---');

// 1. Non-admin attempts approval -> expect RLS rejection
{
  const { data, error } = await memberClient
    .from('prompts')
    .update({ approval_status: 'approved' })
    .eq('id', pendingPrompt.id)
    .select();
  const blocked = !!error || !data || data.length === 0;
  record(
    'Non-admin approve attempt is rejected',
    blocked,
    error ? error.message : `rows affected: ${data?.length ?? 0}`
  );
}

// 2. Admin does the same -> expect success
{
  const { data, error } = await adminClient
    .from('prompts')
    .update({ approval_status: 'approved' })
    .eq('id', pendingPrompt.id)
    .select();
  const ok = !error && data && data.length === 1 && data[0].approval_status === 'approved';
  record(
    'Admin approve succeeds',
    ok,
    error ? error.message : `resulting approval_status: ${data?.[0]?.approval_status}`
  );
}

// 3. Admin attempts invalid transition approved -> pending -> expect rejection
{
  const { data, error } = await adminClient
    .from('prompts')
    .update({ approval_status: 'pending' })
    .eq('id', pendingPrompt.id)
    .select();
  const blocked = !!error;
  record(
    'Admin approved->pending transition rejected',
    blocked,
    error ? error.message : `unexpectedly succeeded: ${JSON.stringify(data)}`
  );
}

// 4. Admin attempts approval_status change AND batch_id set in same update -> expect rejection
{
  // Need a valid batch in this trip to attempt setting batch_id; create one
  // directly isn't exposed via client (no INSERT policy on batches per
  // schema), so just attempt with a syntactically valid but arbitrary uuid —
  // the trigger should reject the combined change before batch existence
  // would even matter.
  const fakeBatchId = '00000000-0000-0000-0000-000000000001';
  const { data, error } = await adminClient
    .from('prompts')
    .update({ approval_status: 'rejected', batch_id: fakeBatchId })
    .eq('id', pendingPrompt.id)
    .select();
  const blocked = !!error;
  record(
    'Admin combined approval_status+batch_id update rejected',
    blocked,
    error ? error.message : `unexpectedly succeeded: ${JSON.stringify(data)}`
  );
}

console.log('\n--- Recursion-fix proof: member reads batches/prompts for their trip ---');
{
  const { data, error } = await memberClient.from('batches').select('*').eq('trip_id', trip.id);
  record('Member SELECT on batches succeeds (no recursion error)', !error, error ? error.message : `rows: ${data.length}`);
}
{
  const { data, error } = await memberClient.from('prompts').select('*').eq('trip_id', trip.id);
  record('Member SELECT on prompts succeeds (no recursion error)', !error, error ? error.message : `rows: ${data.length}`);
}

console.log('\n--- Entries setup: second prompt, two batches, promote both prompts ---');

const memberUserId = (await memberClient.auth.getUser()).data.user.id;
const adminUserId = (await adminClient.auth.getUser()).data.user.id;

// pendingPrompt (from the prompts section above) is already approved and
// unbatched — reuse it as promptA rather than creating a third prompt.
const { data: pendingPrompt2, error: insertPrompt2Error } = await memberClient
  .from('prompts')
  .insert({
    trip_id: trip.id,
    text: 'Recruit someone local to be in the shot',
    category_tag: 'interaction',
    source: 'user',
    added_by: memberUserId,
  })
  .select()
  .single();
if (insertPrompt2Error) throw new Error(`prompt2 insert failed: ${insertPrompt2Error.message}`);

const { error: approve2Error } = await adminClient
  .from('prompts')
  .update({ approval_status: 'approved' })
  .eq('id', pendingPrompt2.id);
if (approve2Error) throw new Error(`prompt2 approve failed: ${approve2Error.message}`);
console.log(`Second prompt created and approved: ${pendingPrompt2.id}`);

const [batchA] = runSql(
  `insert into public.batches (trip_id, batch_number, status) values ('${trip.id}'::uuid, 1, 'submitting') returning id;`
);
const [batchB] = runSql(
  `insert into public.batches (trip_id, batch_number, status) values ('${trip.id}'::uuid, 2, 'submitting') returning id;`
);
console.log(`Batch A created (submitting): ${batchA.id}`);
console.log(`Batch B created (submitting, will flip to voting): ${batchB.id}`);

const { data: promotedA, error: promoteAError } = await adminClient
  .from('prompts')
  .update({ batch_id: batchA.id })
  .eq('id', pendingPrompt.id)
  .select()
  .single();
if (promoteAError) throw new Error(`promote promptA failed: ${promoteAError.message}`);
console.log(`promptA promoted into batch A: batch_id=${promotedA.batch_id}`);

const { data: promotedB, error: promoteBError } = await adminClient
  .from('prompts')
  .update({ batch_id: batchB.id })
  .eq('id', pendingPrompt2.id)
  .select()
  .single();
if (promoteBError) throw new Error(`promote promptB failed: ${promoteBError.message}`);
console.log(`promptB promoted into batch B: batch_id=${promotedB.batch_id}`);

runSql(`update public.batches set status = 'voting' where id = '${batchB.id}'::uuid;`);
console.log('Batch B flipped to status=voting');

console.log('\n--- Entries verification cases ---');

// 1. Member inserts an entry for the live (submitting-batch) prompt -> success
let entryA1;
{
  const { data, error } = await memberClient
    .from('entries')
    .insert({
      prompt_id: promotedA.id,
      submitted_by: memberUserId,
      thumbnail_url: 'thumb-1.jpg',
      full_res_url: 'full-1.jpg',
    })
    .select()
    .single();
  entryA1 = data;
  record(
    'Member insert entry on submitting-batch prompt succeeds',
    !error && !!data,
    error ? error.message : `entry id: ${data?.id}`
  );
}

// 2. Member attempts a second entry on the SAME prompt (cap=1) -> rejected
{
  const { data, error } = await memberClient
    .from('entries')
    .insert({
      prompt_id: promotedA.id,
      submitted_by: memberUserId,
      thumbnail_url: 'thumb-2.jpg',
      full_res_url: 'full-2.jpg',
    })
    .select();
  const blocked = !!error || !data || data.length === 0;
  record(
    'Member second entry on same prompt (over entry_cap_per_prompt) rejected',
    blocked,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// 3. Member attempts an entry on a prompt whose batch is NOT submitting -> rejected
{
  const { data, error } = await memberClient
    .from('entries')
    .insert({
      prompt_id: promotedB.id,
      submitted_by: memberUserId,
      thumbnail_url: 'thumb-3.jpg',
      full_res_url: 'full-3.jpg',
    })
    .select();
  const blocked = !!error || !data || data.length === 0;
  record(
    'Member entry on non-submitting-batch prompt rejected',
    blocked,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// Setup for the delete/flag tests: admin (also a trip member) submits their
// own entry on promptA — a different user, so the cap doesn't block it.
const { data: entryAdmin, error: entryAdminError } = await adminClient
  .from('entries')
  .insert({
    prompt_id: promotedA.id,
    submitted_by: adminUserId,
    thumbnail_url: 'admin-thumb.jpg',
    full_res_url: 'admin-full.jpg',
  })
  .select()
  .single();
if (entryAdminError) throw new Error(`admin entry insert failed: ${entryAdminError.message}`);
console.log(`Admin's own entry created (for delete/flag tests): ${entryAdmin.id}`);

// 6. Member flags an entry, including their own and another's -> both succeed
{
  const { data, error } = await memberClient
    .from('entry_flags')
    .insert({ entry_id: entryA1.id, user_id: memberUserId })
    .select();
  record(
    'Member flags own entry succeeds',
    !error && data && data.length === 1,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}
{
  const { data, error } = await memberClient
    .from('entry_flags')
    .insert({ entry_id: entryAdmin.id, user_id: memberUserId })
    .select();
  record(
    "Member flags another user's entry succeeds",
    !error && data && data.length === 1,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// 7. UPDATE/DELETE on an entry_flags row -> both rejected (insert-only, no policy)
{
  const { data, error } = await memberClient
    .from('entry_flags')
    .update({ created_at: new Date().toISOString() })
    .eq('entry_id', entryA1.id)
    .eq('user_id', memberUserId)
    .select();
  const blocked = !!error || !data || data.length === 0;
  record(
    'UPDATE on entry_flags row rejected (no UPDATE policy)',
    blocked,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}
{
  const { data, error } = await memberClient
    .from('entry_flags')
    .delete()
    .eq('entry_id', entryA1.id)
    .eq('user_id', memberUserId)
    .select();
  const blocked = !!error || !data || data.length === 0;
  record(
    'DELETE on entry_flags row rejected (no DELETE policy)',
    blocked,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// 4. Non-admin member attempts to DELETE another user's (admin's) entry -> rejected
{
  const { data, error } = await memberClient.from('entries').delete().eq('id', entryAdmin.id).select();
  const blocked = !!error || !data || data.length === 0;
  record(
    "Non-admin member DELETE of another user's entry rejected",
    blocked,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// 5. Admin deletes that same entry -> succeeds
{
  const { data, error } = await adminClient.from('entries').delete().eq('id', entryAdmin.id).select();
  const ok = !error && data && data.length === 1;
  record('Admin DELETE of entry succeeds', ok, error ? error.message : `rows: ${data?.length ?? 0}`);
}

console.log('\n--- Votes setup: second admin entry on promptA, entry on promptB, flip batchA to voting ---');

// Need a second admin entry on promptA -- the original (entryAdmin) was
// deleted during the entries tests above -- so the member has an
// admin-submitted entry to vote for. Insert it while batchA is still
// 'submitting' (its current state since the entries tests never flipped
// it), then flip batchA to 'voting' -- the "relevant batch" for the votes
// tests below.
const { data: entryAdminVotes, error: entryAdminVotesError } = await adminClient
  .from('entries')
  .insert({
    prompt_id: promotedA.id,
    submitted_by: adminUserId,
    thumbnail_url: 'admin-votes-thumb.jpg',
    full_res_url: 'admin-votes-full.jpg',
  })
  .select()
  .single();
if (entryAdminVotesError) throw new Error(`admin votes-entry insert failed: ${entryAdminVotesError.message}`);
console.log(`Admin's entry for voting tests created: ${entryAdminVotes.id}`);

// A "wrong prompt" entry, used later to prove entry_id must belong to
// prompt_id. batchB is currently 'voting' (flipped earlier, in the
// entries-setup section) and never accepted a submission -- flip it back
// to 'submitting' just long enough to create one; nothing later depends
// on batchB's status, so it's left as 'submitting' afterward.
runSql(`update public.batches set status = 'submitting' where id = '${batchB.id}'::uuid;`);
const { data: entryB1, error: entryB1Error } = await adminClient
  .from('entries')
  .insert({
    prompt_id: promotedB.id,
    submitted_by: adminUserId,
    thumbnail_url: 'promptB-thumb.jpg',
    full_res_url: 'promptB-full.jpg',
  })
  .select()
  .single();
if (entryB1Error) throw new Error(`promptB entry insert failed: ${entryB1Error.message}`);
console.log(`Entry on promptB (different prompt, for the cross-prompt test) created: ${entryB1.id}`);

// 1. Set the relevant batch (batchA, holding promptA) to 'voting'.
runSql(`update public.batches set status = 'voting' where id = '${batchA.id}'::uuid;`);
console.log('Batch A flipped to status=voting');

console.log('\n--- Votes verification cases ---');

// 3. Member attempts to vote for their OWN entry (entryA1) while
// allow_self_vote is still false (default) -- expect rejection. Run this
// BEFORE the member's first successful vote (case 2): the PK is
// (prompt_id, user_id), so once a vote row exists for (promptA, member) a
// second INSERT for the same pair would fail on the unique constraint
// rather than the self-vote check, muddying the signal.
{
  const { data, error } = await memberClient
    .from('votes')
    .insert({ prompt_id: promotedA.id, entry_id: entryA1.id, user_id: memberUserId })
    .select();
  const blocked = !!error || !data || data.length === 0;
  record(
    'Member self-vote rejected while allow_self_vote=false',
    blocked,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// 2. Member votes for the admin's entry in that prompt -- expect success.
{
  const { data, error } = await memberClient
    .from('votes')
    .insert({ prompt_id: promotedA.id, entry_id: entryAdminVotes.id, user_id: memberUserId })
    .select();
  const ok = !error && data && data.length === 1;
  record(
    "Member votes for admin's entry succeeds",
    ok,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// Setup for case 9 (delete someone else's vote): admin casts a genuine
// vote too, for the member's entry.
{
  const { error } = await adminClient
    .from('votes')
    .insert({ prompt_id: promotedA.id, entry_id: entryA1.id, user_id: adminUserId });
  if (error) throw new Error(`admin vote insert (setup for case 9) failed: ${error.message}`);
  console.log("Admin's own vote (for member's entry) created, for the delete-someone-else's-vote case");
}

// 4. Flip allow_self_vote to true, member votes for their own entry. The
// member already has a vote row for (promptA, member) from case 2, so this
// is necessarily an UPDATE (switch entry_id to entryA1), not a new INSERT
// -- exactly the vote-switching path v5 §6.3 describes.
runSql(`update public.trips set allow_self_vote = true where id = '${trip.id}'::uuid;`);
{
  const { data, error } = await memberClient
    .from('votes')
    .update({ entry_id: entryA1.id })
    .eq('prompt_id', promotedA.id)
    .eq('user_id', memberUserId)
    .select();
  const ok = !error && data && data.length === 1 && data[0].entry_id === entryA1.id;
  record(
    'Member self-vote succeeds after allow_self_vote=true (via UPDATE)',
    ok,
    error ? error.message : `resulting entry_id: ${data?.[0]?.entry_id}`
  );
}

// 5. Attempt to insert a vote where entry_id belongs to a DIFFERENT prompt
// than prompt_id -- expect rejection. Admin hasn't voted on promptA under
// this (prompt_id, user_id) pair yet, so use admin as the tester:
// prompt_id=promptA but entry_id=entryB1 (which belongs to promptB).
{
  const { data, error } = await adminClient
    .from('votes')
    .insert({ prompt_id: promotedA.id, entry_id: entryB1.id, user_id: adminUserId })
    .select();
  const blocked = !!error || !data || data.length === 0;
  record(
    'Vote with entry_id from a different prompt rejected',
    blocked,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// 6. Flip the batch to 'submitting', then 'closed' -- both insert and
// update should be rejected in each state.
for (const status of ['submitting', 'closed']) {
  runSql(`update public.batches set status = '${status}' where id = '${batchA.id}'::uuid;`);
  {
    const { data, error } = await adminClient
      .from('votes')
      .insert({ prompt_id: promotedA.id, entry_id: entryA1.id, user_id: adminUserId })
      .select();
    const blocked = !!error || !data || data.length === 0;
    record(
      `Vote INSERT rejected while batch status='${status}'`,
      blocked,
      error ? error.message : `rows: ${data?.length ?? 0}`
    );
  }
  {
    const { data, error } = await memberClient
      .from('votes')
      .update({ entry_id: entryAdminVotes.id })
      .eq('prompt_id', promotedA.id)
      .eq('user_id', memberUserId)
      .select();
    const blocked = !!error || !data || data.length === 0;
    record(
      `Vote UPDATE rejected while batch status='${status}'`,
      blocked,
      error ? error.message : `rows: ${data?.length ?? 0}`
    );
  }
}

// 7. Flip status back to 'voting'; member updates their vote's entry_id to
// a different valid entry in the same prompt -- expect success.
runSql(`update public.batches set status = 'voting' where id = '${batchA.id}'::uuid;`);
{
  const { data, error } = await memberClient
    .from('votes')
    .update({ entry_id: entryAdminVotes.id })
    .eq('prompt_id', promotedA.id)
    .eq('user_id', memberUserId)
    .select();
  const ok = !error && data && data.length === 1 && data[0].entry_id === entryAdminVotes.id;
  record(
    'Member switches vote to a different valid entry (UPDATE) succeeds',
    ok,
    error ? error.message : `resulting entry_id: ${data?.[0]?.entry_id}`
  );
}

// 8. Attempt to directly change prompt_id on an existing vote row (not
// entry_id) -- expect the immutable-columns trigger exception.
{
  const { data, error } = await memberClient
    .from('votes')
    .update({ prompt_id: promotedB.id })
    .eq('prompt_id', promotedA.id)
    .eq('user_id', memberUserId)
    .select();
  const blocked = !!error;
  record(
    'Direct prompt_id change on existing vote rejected by immutable-columns trigger',
    blocked,
    error ? error.message : `unexpectedly succeeded: ${JSON.stringify(data)}`
  );
}

// 9. Member deletes their own vote -- succeeds regardless of batch status.
// Then attempt to delete someone ELSE's (admin's) vote -- expect 0 rows.
{
  const { data, error } = await memberClient
    .from('votes')
    .delete()
    .eq('prompt_id', promotedA.id)
    .eq('user_id', memberUserId)
    .select();
  const ok = !error && data && data.length === 1;
  record('Member deletes own vote succeeds', ok, error ? error.message : `rows: ${data?.length ?? 0}`);
}
{
  const { data, error } = await memberClient
    .from('votes')
    .delete()
    .eq('prompt_id', promotedA.id)
    .eq('user_id', adminUserId)
    .select();
  const blocked = !error && (!data || data.length === 0);
  record(
    "Member DELETE of another user's (admin's) vote affects 0 rows",
    blocked,
    error ? error.message : `rows: ${data?.length ?? 0}`
  );
}

// 10. As a non-member (unauthenticated) client: SELECT returns nothing and
// INSERT is rejected.
{
  const outsiderClient = createClient(url, key);
  const { data: outsiderSelect, error: outsiderSelectError } = await outsiderClient
    .from('votes')
    .select('*')
    .eq('prompt_id', promotedA.id);
  const selectBlocked = !!outsiderSelectError || !outsiderSelect || outsiderSelect.length === 0;
  record(
    'Non-member/unauthenticated SELECT on votes returns nothing',
    selectBlocked,
    outsiderSelectError ? outsiderSelectError.message : `rows: ${outsiderSelect?.length ?? 0}`
  );

  const { data: outsiderInsert, error: outsiderInsertError } = await outsiderClient
    .from('votes')
    .insert({ prompt_id: promotedA.id, entry_id: entryAdminVotes.id, user_id: adminUserId })
    .select();
  const insertBlocked = !!outsiderInsertError || !outsiderInsert || outsiderInsert.length === 0;
  record(
    'Non-member/unauthenticated INSERT on votes rejected',
    insertBlocked,
    outsiderInsertError ? outsiderInsertError.message : `rows: ${outsiderInsert?.length ?? 0}`
  );
}

console.log('\n--- Votes introspection: policies + grants ---');
{
  const rows = runSql(
    `select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'votes' order by cmd;`
  );
  const cmds = rows.map((r) => r.cmd).sort();
  const ok =
    rows.length === 4 &&
    JSON.stringify(cmds) === JSON.stringify(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
  record('pg_policies: exactly 4 policies on votes (select/insert/update/delete)', ok, JSON.stringify(rows));
}
{
  const rows = runSql(
    `select privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'votes' and grantee = 'authenticated' order by privilege_type;`
  );
  const privs = rows.map((r) => r.privilege_type).sort();
  const ok = JSON.stringify(privs) === JSON.stringify(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
  record(
    'role_table_grants: authenticated has exactly select/insert/update/delete on votes',
    ok,
    JSON.stringify(privs)
  );
}
{
  const [row] = runSql(
    `select
       has_table_privilege('authenticated', 'public.votes', 'TRUNCATE')::text as truncate_priv,
       has_table_privilege('authenticated', 'public.votes', 'TRIGGER')::text as trigger_priv,
       has_table_privilege('authenticated', 'public.votes', 'REFERENCES')::text as references_priv;`
  );
  const ok = row.truncate_priv === 'false' && row.trigger_priv === 'false' && row.references_priv === 'false';
  record('has_table_privilege: authenticated has NO truncate/trigger/references on votes', ok, JSON.stringify(row));
}

console.log('\n--- Cleanup ---');
{
  const { data, error } = await adminClient.from('trips').delete().eq('id', trip.id).select();
  if (error) {
    console.log(`Cleanup delete errored: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log('Client-side cleanup delete affected 0 rows — trips has no DELETE RLS policy (deliberate, "trip deletion isn\'t in spec"). Purging remaining test data via direct SQL instead.');
  } else {
    console.log(`Cleanup delete succeeded, trip ${trip.id} removed.`);
  }
}
{
  // Safety-net purge regardless of what the client-side tests above already
  // cleaned up: batches/prompts have no client DELETE policy either, and
  // entries.prompt_id has no ON DELETE CASCADE (entries are meant to
  // outlive an individual prompt-batch transition), so delete any leftover
  // entries first, then the trip — which cascades members, prompts, and
  // batches (all declared ON DELETE CASCADE on trip_id). entry_flags
  // cascades from entries (ON DELETE CASCADE on entry_id), so nothing
  // separate is needed for it.
  runSql(
    `delete from public.entries where prompt_id in (select id from public.prompts where trip_id = '${trip.id}'::uuid);`
  );
  runSql(`delete from public.trips where id = '${trip.id}'::uuid;`);
  console.log('Direct-SQL purge complete: entries, trip (cascades members/prompts/batches) removed.');
}

console.log('\n=== Summary ===');
for (const r of results) {
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
}
const allPass = results.every((r) => r.pass);
console.log(allPass ? '\nAll cases passed.' : '\nSome cases FAILED — see above.');
