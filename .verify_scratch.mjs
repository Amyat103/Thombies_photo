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
