const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('🧪 Starting AgencyDesk Automated Edge Case & Tenant Isolation Test Suite...\n');

  // Trigger server-side database re-seed via HTTP endpoint
  const seedRes = await fetch(`${BASE_URL}/test/seed`, { method: 'POST' });
  if (!seedRes.ok) {
    throw new Error(`Failed to seed database: ${seedRes.statusText}`);
  }
  console.log('✅ Database seeded on server successfully!\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Cross-Tenant Access Isolation
  // Apex Creative (agency_apex) vs Nexus Digital (agency_nexus)
  // ----------------------------------------------------
  console.log('--- 1. Testing Cross-Tenant Access ---');

  // Apex Admin tries to query task from Nexus Digital
  const nexusTaskId = 'task_star_1';

  const crossTenantRes = await fetch(`${BASE_URL}/tasks/${nexusTaskId}`, {
    headers: {
      'x-user-id': 'usr_apex_admin',
      'x-agency-id': 'agency_apex',
      'x-role': 'agency_admin'
    }
  });

  assert(
    crossTenantRes.status === 404 || crossTenantRes.status === 403,
    'Cross-Tenant Task Access Blocked',
    `Expected 404 or 403 when Apex Admin queries Nexus Task ${nexusTaskId}. Received status ${crossTenantRes.status}`
  );

  // Apex Admin listing tasks should NOT return any Nexus tasks
  const listTasksRes = await fetch(`${BASE_URL}/tasks`, {
    headers: {
      'x-user-id': 'usr_apex_admin',
      'x-agency-id': 'agency_apex',
      'x-role': 'agency_admin'
    }
  });
  const apexTasks = await listTasksRes.json();
  const leakedNexusTask = apexTasks.find((t: any) => t.agency_id !== 'agency_apex');

  assert(
    !leakedNexusTask,
    'Task List Strictly Isolated to Active Agency Tenant',
    leakedNexusTask ? `Found task from agency ${leakedNexusTask.agency_id}` : ''
  );

  // ----------------------------------------------------
  // TEST 2: Internal Content Protection for Clients
  // Client User (John Smith - Acme) querying Apex tasks & comments
  // ----------------------------------------------------
  console.log('\n--- 2. Testing Internal Content Protection for Clients ---');

  const clientHeaders = {
    'x-user-id': 'usr_client_acme',
    'x-agency-id': 'agency_apex',
    'x-role': 'client_user',
    'x-client-id': 'client_acme'
  };

  // 2a. List tasks as Client User
  const clientTasksRes = await fetch(`${BASE_URL}/tasks`, { headers: clientHeaders });
  const clientTasks = await clientTasksRes.json();
  const internalTaskInList = clientTasks.find((t: any) => t.is_internal === 1);

  assert(
    !internalTaskInList,
    'Client Task List Filters Out Internal Tasks (is_internal = 1)',
    internalTaskInList ? `Leaked internal task: ${internalTaskInList.title}` : ''
  );

  // 2b. Direct Query for Internal Task by ID
  const internalTaskId = 'task_acme_2';
  const directTaskRes = await fetch(`${BASE_URL}/tasks/${internalTaskId}`, { headers: clientHeaders });

  assert(
    directTaskRes.status === 404,
    'Direct Query for Internal Task ID Returns 404 to Client',
    `Received status ${directTaskRes.status}`
  );

  // 2c. Comments Filtering
  const clientVisibleTaskId = 'task_acme_1';
  const comments = await fetch(`${BASE_URL}/tasks/${clientVisibleTaskId}/comments`, { headers: clientHeaders }).then(r => r.json());
  const leakedComment = comments.find((c: any) => c.is_internal === 1);

  assert(
    !leakedComment,
    'Client Task Comments Filter Out Internal Staff Comments',
    leakedComment ? `Leaked internal comment: ${leakedComment.comment_text}` : ''
  );

  // 2d. Client User cannot create task
  const createTaskRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: { ...clientHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: 'prj_acme_rebrand', title: 'Unauthorized Client Task' })
  });

  assert(
    createTaskRes.status === 403,
    'Client User Blocked from Creating Tasks (HTTP 403 Forbidden)',
    `Received status ${createTaskRes.status}`
  );

  // ----------------------------------------------------
  // TEST 3: One Person Across Two Agencies Identity Model
  // Sarah Jenkins (usr_dual_sarah)
  // ----------------------------------------------------
  console.log('\n--- 3. Testing One Person Across Two Agencies ---');

  const sarahMeRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { 'x-user-id': 'usr_dual_sarah' }
  });
  const sarahData = await sarahMeRes.json();

  const isApexAdmin = sarahData.memberships.agencies.some((a: any) => a.agency_id === 'agency_apex' && a.role === 'agency_admin');
  const isStarlightClient = sarahData.memberships.clients.some((c: any) => c.agency_name.includes('Nexus') && c.role === 'client_user');

  assert(
    isApexAdmin && isStarlightClient,
    'User Identity Supports Dual Membership (Agency Admin in Apex + Client User in Nexus)',
    `Agencies: ${JSON.stringify(sarahData.memberships.agencies)}, Clients: ${JSON.stringify(sarahData.memberships.clients)}`
  );

  // ----------------------------------------------------
  // TEST 4: Invite Races & Idempotency
  // Resending an invite shouldn't duplicate it; accepting twice shouldn't duplicate
  // ----------------------------------------------------
  console.log('\n--- 4. Testing Invite Races & Idempotency ---');

  const adminHeaders = {
    'x-user-id': 'usr_apex_admin',
    'x-agency-id': 'agency_apex',
    'x-role': 'agency_admin'
  };

  // 4a. Resending same pending invite
  const inviteEmail = 'race_test@example.com';
  const invRes1 = await fetch(`${BASE_URL}/invites`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: inviteEmail, role: 'agency_member' })
  });

  const invRes2 = await fetch(`${BASE_URL}/invites`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: inviteEmail, role: 'agency_member' })
  });
  const inv2Data = await invRes2.json();

  const invitesListRes = await fetch(`${BASE_URL}/invites`, { headers: adminHeaders });
  const invitesList = await invitesListRes.json();
  const matchingInvites = invitesList.filter((i: any) => i.email.toLowerCase() === inviteEmail);

  assert(
    matchingInvites.length === 1,
    'Resending Invite Refreshes Existing Record without Duplication',
    `Found ${matchingInvites.length} invite records in DB`
  );

  // 4b. Accepting invite twice
  const token = inv2Data.invite.token;
  const acceptRes1 = await fetch(`${BASE_URL}/invites/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name: 'Race Tester' })
  });

  const acceptRes2 = await fetch(`${BASE_URL}/invites/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name: 'Race Tester' })
  });

  assert(
    acceptRes1.status === 200 && acceptRes2.status === 400,
    'Double Accepting Invite Handled Transactionally (First succeeds, second fails with HTTP 400)',
    `Res1: ${acceptRes1.status}, Res2: ${acceptRes2.status}`
  );

  // ----------------------------------------------------
  // TEST 5: Removing Team Member Mid-Task
  // ----------------------------------------------------
  console.log('\n--- 5. Testing Member Removal Mid-Task ---');

  const memberToRemove = 'usr_apex_member';

  const removeRes = await fetch(`${BASE_URL}/agencies/members/${memberToRemove}`, {
    method: 'DELETE',
    headers: adminHeaders
  });

  const remainingTasks = await fetch(`${BASE_URL}/tasks`, { headers: adminHeaders }).then(r => r.json());
  const tasksStillAssigned = remainingTasks.filter((t: any) => t.assignee_id === memberToRemove);

  assert(
    removeRes.status === 200 && tasksStillAssigned.length === 0,
    'Member Removal Unassigns Active Tasks Safely (assignee_id set to NULL)',
    `Status: ${removeRes.status}, Remaining assigned tasks: ${tasksStillAssigned.length}`
  );

  console.log(`\n========================================`);
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
