import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

console.log('\n--- Cleanup ---');
{
  const { data, error } = await adminClient.from('trips').delete().eq('id', trip.id).select();
  if (error) {
    console.log(`Cleanup delete errored: ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log('Cleanup delete affected 0 rows — trips has no DELETE RLS policy (deliberate, "trip deletion isn\'t in spec"), so the test trip was NOT removed via the client. Manual cleanup needed.');
  } else {
    console.log(`Cleanup delete succeeded, trip ${trip.id} removed.`);
  }
}

console.log('\n=== Summary ===');
for (const r of results) {
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
}
const allPass = results.every((r) => r.pass);
console.log(allPass ? '\nAll cases passed.' : '\nSome cases FAILED — see above.');
