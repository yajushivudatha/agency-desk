import { getDb, saveDb, execute } from './db.js';

export async function seedDatabase() {
  console.log('🌱 Seeding database for AgencyDesk...');
  
  const db = await getDb();

  // Wipe existing tables safely
  db.run('DELETE FROM time_entries;');
  db.run('DELETE FROM task_files;');
  db.run('DELETE FROM task_comments;');
  db.run('DELETE FROM tasks;');
  db.run('DELETE FROM project_assignments;');
  db.run('DELETE FROM projects;');
  db.run('DELETE FROM client_contacts;');
  db.run('DELETE FROM clients;');
  db.run('DELETE FROM agency_memberships;');
  db.run('DELETE FROM users;');
  db.run('DELETE FROM agencies;');
  db.run('DELETE FROM invites;');
  db.run('DELETE FROM intake_submissions;');
  db.run('DELETE FROM audit_logs;');

  const now = new Date().toISOString();

  // 1. Agencies
  db.run(`INSERT INTO agencies (id, name, slug, created_at) VALUES
    ('agency_apex', 'Apex Creative Studio', 'apex', '${now}'),
    ('agency_nexus', 'Nexus Digital Agency', 'nexus', '${now}');
  `);

  // 2. Users
  db.run(`INSERT INTO users (id, email, name, avatar_url, created_at) VALUES
    ('usr_apex_admin', 'alex@apexcreative.io', 'Alex Rivera (Apex Admin)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80', '${now}'),
    ('usr_apex_member', 'david@apexcreative.io', 'David Kim (Apex Staff)', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80', '${now}'),
    ('usr_nexus_admin', 'elena@nexusdigital.com', 'Elena Rostova (Nexus Admin)', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80', '${now}'),
    ('usr_nexus_member', 'marcus@nexusdigital.com', 'Marcus Vance (Nexus Staff)', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80', '${now}'),
    ('usr_client_acme', 'john@acme.corp', 'John Smith (Acme Client)', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80', '${now}'),
    ('usr_client_starlight', 'lisa@starlightretail.com', 'Lisa Wong (Starlight Client)', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80', '${now}'),
    ('usr_dual_sarah', 'sarah@crossagency.com', 'Sarah Jenkins (Multi-Agency)', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80', '${now}');
  `);

  // 3. Agency Memberships
  db.run(`INSERT INTO agency_memberships (id, agency_id, user_id, role, created_at) VALUES
    ('mem_apex_1', 'agency_apex', 'usr_apex_admin', 'agency_admin', '${now}'),
    ('mem_apex_2', 'agency_apex', 'usr_apex_member', 'agency_member', '${now}'),
    ('mem_apex_3', 'agency_apex', 'usr_dual_sarah', 'agency_admin', '${now}'),
    ('mem_nexus_1', 'agency_nexus', 'usr_nexus_admin', 'agency_admin', '${now}'),
    ('mem_nexus_2', 'agency_nexus', 'usr_nexus_member', 'agency_member', '${now}');
  `);

  // 4. Clients
  db.run(`INSERT INTO clients (id, agency_id, name, contact_email, status, created_at) VALUES
    ('client_acme', 'agency_apex', 'Acme Corporation', 'john@acme.corp', 'active', '${now}'),
    ('client_globex', 'agency_apex', 'Globex Systems', 'contact@globex.com', 'active', '${now}'),
    ('client_starlight', 'agency_nexus', 'Starlight Retail Group', 'lisa@starlightretail.com', 'active', '${now}');
  `);

  // 5. Client Contacts
  db.run(`INSERT INTO client_contacts (id, client_id, user_id, role, created_at) VALUES
    ('cc_acme_1', 'client_acme', 'usr_client_acme', 'client_user', '${now}'),
    ('cc_starlight_1', 'client_starlight', 'usr_client_starlight', 'client_user', '${now}'),
    ('cc_starlight_2', 'client_starlight', 'usr_dual_sarah', 'client_user', '${now}');
  `);

  // 6. Projects
  db.run(`INSERT INTO projects (id, agency_id, client_id, name, description, status, budget_hours, created_at) VALUES
    ('prj_acme_rebrand', 'agency_apex', 'client_acme', 'Acme Brand Overhaul', 'Complete brand identity refresh, vector assets, and brand guidelines.', 'active', 120, '${now}'),
    ('prj_globex_portal', 'agency_apex', 'client_globex', 'Globex B2B Dashboard', 'Enterprise portal with custom reporting and webhooks.', 'active', 200, '${now}'),
    ('prj_starlight_ecom', 'agency_nexus', 'client_starlight', 'Starlight Mobile E-Commerce Store', 'Next-gen React Native checkout and web catalog.', 'active', 150, '${now}');
  `);

  // 7. Project Assignments
  db.run(`INSERT INTO project_assignments (id, project_id, user_id, assigned_at) VALUES
    ('pa_1', 'prj_acme_rebrand', 'usr_apex_admin', '${now}'),
    ('pa_2', 'prj_acme_rebrand', 'usr_apex_member', '${now}'),
    ('pa_3', 'prj_globex_portal', 'usr_apex_admin', '${now}'),
    ('pa_4', 'prj_starlight_ecom', 'usr_nexus_admin', '${now}'),
    ('pa_5', 'prj_starlight_ecom', 'usr_nexus_member', '${now}');
  `);

  // 8. Tasks (Internal vs Client-Visible)
  db.run(`INSERT INTO tasks (id, agency_id, project_id, title, description, status, priority, assignee_id, due_date, is_internal, created_at) VALUES
    ('task_acme_1', 'agency_apex', 'prj_acme_rebrand', 'Logo Concept Variations', 'Create 3 initial logo concepts for client review.', 'in_progress', 'high', 'usr_apex_member', '2026-08-01', 0, '${now}'),
    ('task_acme_2', 'agency_apex', 'prj_acme_rebrand', 'Internal Costing & Margin Analysis', 'Calculate print vendor margins and contractor split.', 'in_review', 'urgent', 'usr_apex_admin', '2026-07-28', 1, '${now}'),
    ('task_acme_3', 'agency_apex', 'prj_acme_rebrand', 'Brand Guidelines PDF Export', 'Assemble typography, color palette, and usage rules.', 'todo', 'medium', 'usr_apex_member', '2026-08-10', 0, '${now}'),
    ('task_acme_4', 'agency_apex', 'prj_acme_rebrand', 'Contractor Payroll & Invoicing Prep', 'Internal accounting notes for project signoff.', 'done', 'low', 'usr_apex_admin', '2026-07-20', 1, '${now}'),
    ('task_star_1', 'agency_nexus', 'prj_starlight_ecom', 'Checkout Flow Wireframes', 'Interactive wireframe prototype for mobile basket & payment.', 'in_review', 'high', 'usr_nexus_member', '2026-08-05', 0, '${now}'),
    ('task_star_2', 'agency_nexus', 'prj_starlight_ecom', 'Payment API Key Provisioning', 'Configure production Stripe secret keys and Webhook secrets.', 'done', 'urgent', 'usr_nexus_admin', '2026-07-22', 1, '${now}');
  `);

  // 9. Task Comments
  db.run(`INSERT INTO task_comments (id, agency_id, task_id, user_id, comment_text, is_internal, created_at) VALUES
    ('tc_1', 'agency_apex', 'task_acme_1', 'usr_apex_member', 'Uploaded the first draft of concepts. Check out design concept B.', 0, '${now}'),
    ('tc_2', 'agency_apex', 'task_acme_1', 'usr_client_acme', 'Concept B looks sharp! Can we try a navy accent color instead of teal?', 0, '${now}'),
    ('tc_3', 'agency_apex', 'task_acme_1', 'usr_apex_admin', 'INTERNAL NOTE: Client requested navy accent. Estimate +2.5 billable hours.', 1, '${now}'),
    ('tc_4', 'agency_nexus', 'task_star_1', 'usr_nexus_member', 'Wireframe link attached in task files. Please review payment step.', 0, '${now}'),
    ('tc_5', 'agency_nexus', 'task_star_1', 'usr_client_starlight', 'Reviewed with product team. Approved with minor layout notes.', 0, '${now}');
  `);

  // 10. Task Files
  db.run(`INSERT INTO task_files (id, agency_id, task_id, uploader_id, file_name, file_size, file_url, file_type, approval_status, approval_notes, is_internal, created_at) VALUES
    ('file_1', 'agency_apex', 'task_acme_1', 'usr_apex_member', 'Acme_Logo_Concepts_v1.pdf', '4.2 MB', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80', 'pdf', 'pending', NULL, 0, '${now}'),
    ('file_2', 'agency_apex', 'task_acme_2', 'usr_apex_admin', 'Confidential_Margin_Sheet.xlsx', '1.1 MB', '#', 'xlsx', 'pending', NULL, 1, '${now}'),
    ('file_3', 'agency_nexus', 'task_star_1', 'usr_nexus_member', 'Starlight_Checkout_Wireframes.png', '2.8 MB', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80', 'image', 'approved', 'Approved by Lisa Wong (Starlight) for production handover.', 0, '${now}');
  `);

  // 11. Time Entries
  db.run(`INSERT INTO time_entries (id, agency_id, task_id, user_id, duration_minutes, note, entry_date, created_at) VALUES
    ('te_1', 'agency_apex', 'task_acme_1', 'usr_apex_member', 180, 'Drafting vector icon set and color explorations', '2026-07-20', '${now}'),
    ('te_2', 'agency_apex', 'task_acme_1', 'usr_apex_member', 120, 'Applying client feedback for navy color variations', '2026-07-21', '${now}'),
    ('te_3', 'agency_apex', 'task_acme_2', 'usr_apex_admin', 90, 'Vendor quote negotiations and profit modeling', '2026-07-21', '${now}'),
    ('te_4', 'agency_nexus', 'task_star_1', 'usr_nexus_member', 240, 'Figma wireframing for responsive mobile basket', '2026-07-19', '${now}');
  `);

  // 12. Invites (demonstrating idempotent invite & acceptance)
  db.run(`INSERT INTO invites (id, agency_id, client_id, email, role, token, status, created_at) VALUES
    ('inv_1', 'agency_apex', 'client_acme', 'newclient@acme.corp', 'client_user', 'tok_acme_invite_123', 'pending', '${now}'),
    ('inv_2', 'agency_apex', NULL, 'newdesigner@apexcreative.io', 'agency_member', 'tok_apex_invite_456', 'pending', '${now}');
  `);

  // 13. Client Intake Submissions
  db.run(`INSERT INTO intake_submissions (id, agency_id, client_name, contact_email, project_title, project_description, budget, status, created_at) VALUES
    ('intake_1', 'agency_apex', 'Vanguard Mobility', 'contact@vanguardmobility.com', 'iOS Fleet Tracking App', 'Need an iPad/iPhone app for fleet operators to track real-time locations and service logs.', '$25,000 - $40,000', 'new', '${now}');
  `);

  saveDb();
  console.log('✅ Database seeded successfully!');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase().catch((err) => {
    console.error('Failed to seed DB:', err);
    process.exit(1);
  });
}
