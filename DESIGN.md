# AgencyDesk — Architecture & Schema Design

## Overview
AgencyDesk is a multi-tenant client and project management platform designed specifically for agency-client collaboration. Isolation and access-control correctness are enforced at both the relational database schema layer and API middleware level.

---

## 1. Tenant Isolation
Tenant isolation is enforced via mandatory foreign key constraints and strict relational scoping:
- **Database Schema**: Every tenant entity (`clients`, `projects`, `tasks`, `task_comments`, `task_files`, `time_entries`, `invites`, `intake_submissions`) stores a non-nullable `agency_id TEXT REFERENCES agencies(id) ON DELETE CASCADE`.
- **Query Guard Middleware**: The `tenantGuard` Express middleware extracts `X-Agency-Id` from headers, validates that the authenticated `user_id` holds a valid `agency_memberships` or `client_contacts` relation for that agency, and injects `agency_id` into every SQL statement's `WHERE` clause.
- **Cross-Tenant Mitigation**: Even if an attacker guesses or provides a valid task or project UUID belonging to Agency B while operating under Agency A's context, the SQL query (`WHERE id = :task_id AND agency_id = :agency_id`) returns `404 Not Found` or `403 Forbidden`.

---

## 2. Blocking Client Access to Internal Content (Defense in Depth)
Client contacts (`client_user` role) require strict content boundaries:
- **Boolean Flag**: Tasks, task comments, and task files feature an `is_internal INTEGER DEFAULT 0` column (`0` = client-visible, `1` = agency internal only).
- **Relational Project Scoping**: Client users are restricted to projects where `projects.client_id = :active_client_id`.
- **Query-Level Defense**: When `req.user.active_role === 'client_user'`, every API endpoint (task list, search, task detail, comments list, files list, activity feed, and project dashboard metrics) automatically appends `AND is_internal = 0` to SQL queries.
- **RBAC Write Protections**: Client users are prohibited from creating tasks (`POST /api/tasks` -> 403) or modifying task status (`PATCH /api/tasks/:id` -> 403). Clients can comment on client-visible tasks and update file approval statuses (`approved` / `needs_changes`).

---

## 3. Multi-Membership Identity Model ("One Person, Two Agencies")
To support a single email address serving as a staff member or client contact across multiple agencies without account duplication:
- **Decoupled User Identity**: The `users` table contains globally unique identity details (`id`, `email`, `name`, `avatar_url`).
- **Normalized Join Tables**:
  - `agency_memberships(id, agency_id, user_id, role)` — maps user to agency staff roles (`agency_admin`, `agency_member`).
  - `client_contacts(id, client_id, user_id, role)` — maps user to client contact portal roles (`client_user`).
- **Context Switching**: Upon login (`GET /api/auth/me`), the user receives all available agency and client memberships. The frontend persona switcher sends `X-Agency-Id`, `X-Role`, and `X-Client-Id` headers with each request, allowing seamless context switching.

---

## 4. Featured Edge Case: Member Removal Mid-Task
When an agency team member (`agency_member`) is removed from an agency or unassigned from a project mid-sprint:
- **Safety Strategy**: The endpoint `DELETE /api/agencies/members/:user_id` unassigns active tasks by executing `UPDATE tasks SET assignee_id = NULL WHERE agency_id = :agency_id AND assignee_id = :user_id`.
- **Audit Trail**: Generates an automated internal comment on each affected task (`[System Audit] Assignee [Name] was removed...`) and logs an immutable record in `audit_logs`.
- **Data Integrity**: Time entries (`time_entries`) logged by the departing member remain intact with historic attribution, preventing broken billing calculations or lost work logs.

---

## 5. Invite Race Conditions & Idempotency
- **Invite Creation**: Executing `POST /api/invites` checks for existing `pending` invites for `(agency_id, email)`. If found, it updates the token and expiration rather than creating duplicate records.
- **Invite Acceptance**: `POST /api/invites/accept` transactionally verifies `status === 'pending'` before setting `status = 'accepted'` and creating the membership. Subsequent attempts fail gracefully with `HTTP 400 Invite already accepted`.
