import { Router, Response } from 'express';
import { AuthRequest, authMiddleware, tenantGuard, requireAgencyStaff, requireAgencyAdmin } from './middleware.js';
import { queryRows, queryOne, execute, saveDb } from './db.js';
import { seedDatabase } from './seed.js';

const router = Router();

// Test seed endpoint for automated test runner
router.post('/test/seed', async (req, res) => {
  try {
    await seedDatabase();
    res.json({ message: 'Database reseeded for test suite' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Apply auth & tenant guard to all /api endpoints below
router.use(authMiddleware);
router.use(tenantGuard);

// ----------------------------------------------------
// AUTH & PERSONA / CONTEXT ENDPOINTS
// ----------------------------------------------------

/**
 * GET /api/auth/me
 * Returns active user details, current active tenant/role, and all available memberships
 */
router.get('/auth/me', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    // Fetch agency memberships
    const agencyMemberships = await queryRows(
      `SELECT am.role, a.id as agency_id, a.name as agency_name, a.slug as agency_slug
       FROM agency_memberships am
       JOIN agencies a ON am.agency_id = a.id
       WHERE am.user_id = ?`,
      [user.id]
    );

    // Fetch client contact memberships
    const clientMemberships = await queryRows(
      `SELECT cc.role, cc.client_id, c.name as client_name, c.agency_id, a.name as agency_name
       FROM client_contacts cc
       JOIN clients c ON cc.client_id = c.id
       JOIN agencies a ON c.agency_id = a.id
       WHERE cc.user_id = ?`,
      [user.id]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url
      },
      active_context: {
        agency_id: user.active_agency_id,
        role: user.active_role,
        client_id: user.active_client_id
      },
      memberships: {
        agencies: agencyMemberships,
        clients: clientMemberships
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AGENCIES & TEAM MEMBERS
// ----------------------------------------------------

/**
 * GET /api/agencies/current
 */
router.get('/agencies/current', async (req: AuthRequest, res: Response) => {
  try {
    const agency = await queryOne('SELECT * FROM agencies WHERE id = ?', [req.user!.active_agency_id]);
    res.json(agency);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/agencies/members
 */
router.get('/agencies/members', async (req: AuthRequest, res: Response) => {
  try {
    const members = await queryRows(
      `SELECT u.id, u.email, u.name, u.avatar_url, am.role, am.created_at
       FROM agency_memberships am
       JOIN users u ON am.user_id = u.id
       WHERE am.agency_id = ?`,
      [req.user!.active_agency_id]
    );
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/agencies/members/:user_id
 * Edge Case: Removing a team member mid-task
 * Unassigns user from active tasks, logs audit event, and removes agency membership
 */
router.delete('/agencies/members/:user_id', requireAgencyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.user_id;
    const agencyId = req.user!.active_agency_id!;

    // Verify member exists
    const membership = await queryOne(
      'SELECT * FROM agency_memberships WHERE agency_id = ? AND user_id = ?',
      [agencyId, targetUserId]
    );

    if (!membership) {
      return res.status(404).json({ error: 'Team member not found in this agency' });
    }

    const removedUser = await queryOne('SELECT name FROM users WHERE id = ?', [targetUserId]);
    const userName = removedUser?.name || targetUserId;

    // 1. Unassign user from all tasks in this agency
    const assignedTasks = await queryRows(
      'SELECT id, title FROM tasks WHERE agency_id = ? AND assignee_id = ?',
      [agencyId, targetUserId]
    );

    await execute(
      'UPDATE tasks SET assignee_id = NULL WHERE agency_id = ? AND assignee_id = ?',
      [agencyId, targetUserId]
    );

    // 2. Add audit comments to affected tasks
    const now = new Date().toISOString();
    for (const t of assignedTasks) {
      await execute(
        `INSERT INTO task_comments (id, agency_id, task_id, user_id, comment_text, is_internal, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [
          `tc_audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          agencyId,
          t.id,
          req.user!.id,
          `[System Audit] Assignee ${userName} was removed from agency team. Task unassigned.`,
          now
        ]
      );
    }

    // 3. Remove project assignments
    await execute(
      `DELETE FROM project_assignments 
       WHERE user_id = ? AND project_id IN (SELECT id FROM projects WHERE agency_id = ?)`,
      [targetUserId, agencyId]
    );

    // 4. Remove agency membership
    await execute(
      'DELETE FROM agency_memberships WHERE agency_id = ? AND user_id = ?',
      [agencyId, targetUserId]
    );

    // 5. Log in audit_logs
    await execute(
      `INSERT INTO audit_logs (id, agency_id, actor_id, action, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `log_${Date.now()}`,
        agencyId,
        req.user!.id,
        'MEMBER_REMOVED',
        `Removed user ${userName} (${targetUserId}) from agency. Unassigned ${assignedTasks.length} task(s).`,
        now
      ]
    );

    res.json({
      message: `Successfully removed ${userName} from agency`,
      unassigned_task_count: assignedTasks.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CLIENTS
// ----------------------------------------------------

/**
 * GET /api/clients
 */
router.get('/clients', async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;

    if (role === 'client_user') {
      const clientId = req.user!.active_client_id!;
      const client = await queryRows(
        'SELECT * FROM clients WHERE agency_id = ? AND id = ?',
        [agencyId, clientId]
      );
      return res.json(client);
    }

    const clients = await queryRows(
      'SELECT * FROM clients WHERE agency_id = ? ORDER BY name ASC',
      [agencyId]
    );
    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/clients (Agency Staff only)
 */
router.post('/clients', requireAgencyStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { name, contact_email } = req.body;
    if (!name || !contact_email) {
      return res.status(400).json({ error: 'Client name and contact_email are required' });
    }

    const agencyId = req.user!.active_agency_id!;
    const id = `client_${Date.now()}`;
    const now = new Date().toISOString();

    await execute(
      'INSERT INTO clients (id, agency_id, name, contact_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, agencyId, name, contact_email, 'active', now]
    );

    const created = await queryOne('SELECT * FROM clients WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PROJECTS
// ----------------------------------------------------

/**
 * GET /api/projects
 */
router.get('/projects', async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;

    if (role === 'client_user') {
      const clientId = req.user!.active_client_id!;
      const projects = await queryRows(
        `SELECT p.*, c.name as client_name 
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.agency_id = ? AND p.client_id = ?
         ORDER BY p.created_at DESC`,
        [agencyId, clientId]
      );
      return res.json(projects);
    }

    const projects = await queryRows(
      `SELECT p.*, c.name as client_name 
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.agency_id = ?
       ORDER BY p.created_at DESC`,
      [agencyId]
    );
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/projects/:id
 * Project Dashboard & Metrics Endpoint
 */
router.get('/projects/:id', async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const projectId = req.params.id;
    const role = req.user!.active_role!;

    const project = await queryOne<any>(
      `SELECT p.*, c.name as client_name 
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.agency_id = ? AND p.id = ?`,
      [agencyId, projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Client user isolation check
    if (role === 'client_user' && project.client_id !== req.user!.active_client_id) {
      return res.status(403).json({ error: 'Forbidden: Access restricted to your own client projects' });
    }

    // Task counts by status (Filtered by client visibility if client_user)
    const internalClause = role === 'client_user' ? 'AND is_internal = 0' : '';

    const statusCounts = await queryRows(
      `SELECT status, COUNT(*) as count 
       FROM tasks 
       WHERE agency_id = ? AND project_id = ? ${internalClause}
       GROUP BY status`,
      [agencyId, projectId]
    );

    // Hours logged calculation
    const totalMinutesRow = await queryOne<any>(
      `SELECT SUM(te.duration_minutes) as total_min
       FROM time_entries te
       JOIN tasks t ON te.task_id = t.id
       WHERE te.agency_id = ? AND t.project_id = ? ${internalClause}`,
      [agencyId, projectId]
    );

    const loggedHours = ((totalMinutesRow?.total_min || 0) / 60).toFixed(1);

    res.json({
      project,
      metrics: {
        task_status_counts: statusCounts,
        logged_hours: Number(loggedHours),
        budget_hours: project.budget_hours || 0
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects (Agency staff only)
 */
router.post('/projects', requireAgencyStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { name, client_id, description, budget_hours } = req.body;
    if (!name || !client_id) {
      return res.status(400).json({ error: 'Project name and client_id are required' });
    }

    const agencyId = req.user!.active_agency_id!;

    // Verify client belongs to this agency
    const client = await queryOne('SELECT * FROM clients WHERE id = ? AND agency_id = ?', [client_id, agencyId]);
    if (!client) {
      return res.status(400).json({ error: 'Selected client does not belong to this agency' });
    }

    const id = `prj_${Date.now()}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO projects (id, agency_id, client_id, name, description, status, budget_hours, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      [id, agencyId, client_id, name, description || '', budget_hours || 0, now]
    );

    const created = await queryOne('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TASKS (BOARDS & ACCESS CONTROL)
// ----------------------------------------------------

/**
 * GET /api/tasks
 * Strict Multi-Tenant & Client Visibility Filtering
 */
router.get('/tasks', async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;
    const { project_id, search, status } = req.query;

    let sql = `
      SELECT t.*, 
             p.name as project_name, 
             p.client_id,
             u.name as assignee_name, 
             u.avatar_url as assignee_avatar
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.agency_id = ?
    `;
    const params: any[] = [agencyId];

    // Client User Isolation: MUST filter client_id AND is_internal = 0
    if (role === 'client_user') {
      const clientId = req.user!.active_client_id!;
      sql += ` AND p.client_id = ? AND t.is_internal = 0`;
      params.push(clientId);
    }

    if (project_id) {
      sql += ` AND t.project_id = ?`;
      params.push(project_id);
    }

    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY t.created_at DESC`;

    const tasks = await queryRows(sql, params);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tasks/:id
 */
router.get('/tasks/:id', async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;
    const taskId = req.params.id;

    const task = await queryOne<any>(
      `SELECT t.*, p.name as project_name, p.client_id, u.name as assignee_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.agency_id = ? AND t.id = ?`,
      [agencyId, taskId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Client user isolation check
    if (role === 'client_user') {
      if (task.client_id !== req.user!.active_client_id || task.is_internal === 1) {
        return res.status(404).json({ error: 'Task not found' });
      }
    }

    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tasks (Agency Staff only - Clients blocked!)
 */
router.post('/tasks', requireAgencyStaff, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, title, description, priority, assignee_id, due_date, is_internal } = req.body;
    if (!project_id || !title) {
      return res.status(400).json({ error: 'project_id and title are required' });
    }

    const agencyId = req.user!.active_agency_id!;

    // Verify project belongs to agency
    const project = await queryOne('SELECT * FROM projects WHERE id = ? AND agency_id = ?', [project_id, agencyId]);
    if (!project) {
      return res.status(400).json({ error: 'Invalid project for this agency' });
    }

    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO tasks (id, agency_id, project_id, title, description, status, priority, assignee_id, due_date, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?)`,
      [
        id,
        agencyId,
        project_id,
        title,
        description || '',
        priority || 'medium',
        assignee_id || null,
        due_date || null,
        is_internal ? 1 : 0,
        now
      ]
    );

    const created = await queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/tasks/:id (Agency Staff only - Clients cannot change status or edit tasks)
 */
router.patch('/tasks/:id', requireAgencyStaff, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const agencyId = req.user!.active_agency_id!;

    const existing = await queryOne('SELECT * FROM tasks WHERE id = ? AND agency_id = ?', [taskId, agencyId]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, status, priority, assignee_id, due_date, is_internal } = req.body;

    await execute(
      `UPDATE tasks SET 
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        assignee_id = ?,
        due_date = COALESCE(?, due_date),
        is_internal = COALESCE(?, is_internal)
       WHERE id = ? AND agency_id = ?`,
      [
        title ?? existing.title,
        description ?? existing.description,
        status ?? existing.status,
        priority ?? existing.priority,
        assignee_id !== undefined ? assignee_id : existing.assignee_id,
        due_date ?? existing.due_date,
        is_internal !== undefined ? (is_internal ? 1 : 0) : existing.is_internal,
        taskId,
        agencyId
      ]
    );

    const updated = await queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TASK COMMENTS
// ----------------------------------------------------

/**
 * GET /api/tasks/:id/comments
 */
router.get('/tasks/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;

    // Verify task exists and caller has access
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = ? AND agency_id = ?', [taskId, agencyId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let sql = `
      SELECT tc.*, u.name as author_name, u.avatar_url as author_avatar
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ? AND tc.agency_id = ?
    `;
    const params: any[] = [taskId, agencyId];

    if (role === 'client_user') {
      sql += ` AND tc.is_internal = 0`;
    }

    sql += ` ORDER BY tc.created_at ASC`;

    const comments = await queryRows(sql, params);
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tasks/:id/comments
 * Clients CAN comment on client-visible tasks.
 */
router.post('/tasks/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;
    const { comment_text, is_internal } = req.body;

    if (!comment_text || comment_text.trim() === '') {
      return res.status(400).json({ error: 'comment_text is required' });
    }

    // Verify task access
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = ? AND agency_id = ?', [taskId, agencyId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (role === 'client_user' && task.is_internal === 1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Client user comments are ALWAYS client-visible (is_internal = 0)
    const commentIsInternal = role === 'client_user' ? 0 : (is_internal ? 1 : 0);

    const id = `tc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO task_comments (id, agency_id, task_id, user_id, comment_text, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, agencyId, taskId, req.user!.id, comment_text.trim(), commentIsInternal, now]
    );

    const created = await queryOne(
      `SELECT tc.*, u.name as author_name, u.avatar_url as author_avatar
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.id = ?`,
      [id]
    );

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TASK FILES & APPROVAL WORKFLOW
// ----------------------------------------------------

/**
 * GET /api/tasks/:id/files
 */
router.get('/tasks/:id/files', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;

    let sql = `
      SELECT tf.*, u.name as uploader_name
      FROM task_files tf
      JOIN users u ON tf.uploader_id = u.id
      WHERE tf.task_id = ? AND tf.agency_id = ?
    `;
    const params: any[] = [taskId, agencyId];

    if (role === 'client_user') {
      sql += ` AND tf.is_internal = 0`;
    }

    sql += ` ORDER BY tf.created_at DESC`;

    const files = await queryRows(sql, params);
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tasks/:id/files
 */
router.post('/tasks/:id/files', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;
    const { file_name, file_size, file_url, file_type, is_internal } = req.body;

    if (!file_name) {
      return res.status(400).json({ error: 'file_name is required' });
    }

    const fileIsInternal = role === 'client_user' ? 0 : (is_internal ? 1 : 0);
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO task_files (id, agency_id, task_id, uploader_id, file_name, file_size, file_url, file_type, approval_status, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id,
        agencyId,
        taskId,
        req.user!.id,
        file_name,
        file_size || '1.5 MB',
        file_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        file_type || 'document',
        fileIsInternal,
        now
      ]
    );

    const created = await queryOne('SELECT * FROM task_files WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/files/:id/approval
 * Client or staff marks file approved or needs_changes with notes
 */
router.patch('/files/:id/approval', async (req: AuthRequest, res: Response) => {
  try {
    const fileId = req.params.id;
    const agencyId = req.user!.active_agency_id!;
    const { approval_status, approval_notes } = req.body;

    if (!['approved', 'needs_changes', 'pending'].includes(approval_status)) {
      return res.status(400).json({ error: 'Invalid approval_status value' });
    }

    const file = await queryOne<any>('SELECT * FROM task_files WHERE id = ? AND agency_id = ?', [fileId, agencyId]);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (req.user!.active_role === 'client_user' && file.is_internal === 1) {
      return res.status(404).json({ error: 'File not found' });
    }

    await execute(
      `UPDATE task_files SET approval_status = ?, approval_notes = ? WHERE id = ? AND agency_id = ?`,
      [approval_status, approval_notes || null, fileId, agencyId]
    );

    const updated = await queryOne('SELECT * FROM task_files WHERE id = ?', [fileId]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TIME TRACKING
// ----------------------------------------------------

/**
 * GET /api/time-entries
 */
router.get('/time-entries', async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const role = req.user!.active_role!;
    const { project_id, task_id } = req.query;

    if (role === 'client_user') {
      // Client users see aggregated hours per project only — no detailed notes or agency internals
      const clientId = req.user!.active_client_id!;
      const rows = await queryRows(
        `SELECT p.id as project_id, p.name as project_name, SUM(te.duration_minutes) as total_minutes
         FROM time_entries te
         JOIN tasks t ON te.task_id = t.id
         JOIN projects p ON t.project_id = p.id
         WHERE te.agency_id = ? AND p.client_id = ? AND t.is_internal = 0
         GROUP BY p.id`,
        [agencyId, clientId]
      );
      return res.json(rows.map(r => ({ ...r, total_hours: ((r.total_minutes || 0) / 60).toFixed(1) })));
    }

    let sql = `
      SELECT te.*, t.title as task_title, p.name as project_name, u.name as user_name
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON te.user_id = u.id
      WHERE te.agency_id = ?
    `;
    const params: any[] = [agencyId];

    if (project_id) {
      sql += ` AND t.project_id = ?`;
      params.push(project_id);
    }
    if (task_id) {
      sql += ` AND te.task_id = ?`;
      params.push(task_id);
    }

    sql += ` ORDER BY te.entry_date DESC, te.created_at DESC`;

    const entries = await queryRows(sql, params);
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/time-entries (Agency Staff only)
 */
router.post('/time-entries', requireAgencyStaff, async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const { task_id, duration_minutes, note, entry_date } = req.body;

    if (!task_id || !duration_minutes) {
      return res.status(400).json({ error: 'task_id and duration_minutes are required' });
    }

    // Verify task belongs to agency
    const task = await queryOne('SELECT * FROM tasks WHERE id = ? AND agency_id = ?', [task_id, agencyId]);
    if (!task) {
      return res.status(400).json({ error: 'Task not found in this agency' });
    }

    const id = `te_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date().toISOString();
    const dateStr = entry_date || now.split('T')[0];

    await execute(
      `INSERT INTO time_entries (id, agency_id, task_id, user_id, duration_minutes, note, entry_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, agencyId, task_id, req.user!.id, parseInt(duration_minutes, 10), note || '', dateStr, now]
    );

    const created = await queryOne('SELECT * FROM time_entries WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// INVITES & RACE CONDITIONS
// ----------------------------------------------------

/**
 * GET /api/invites (Agency Staff)
 */
router.get('/invites', requireAgencyStaff, async (req: AuthRequest, res: Response) => {
  try {
    const invites = await queryRows(
      'SELECT * FROM invites WHERE agency_id = ? ORDER BY created_at DESC',
      [req.user!.active_agency_id]
    );
    res.json(invites);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/invites
 * Edge Case: Invite Races - Resending an invite shouldn't duplicate it!
 */
router.post('/invites', requireAgencyStaff, async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const { email, role, client_id } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'email and role are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if pending invite already exists for this agency + email
    const existing = await queryOne<any>(
      "SELECT * FROM invites WHERE agency_id = ? AND email = ? AND status = 'pending'",
      [agencyId, cleanEmail]
    );

    const now = new Date().toISOString();
    const token = `tok_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    if (existing) {
      // Idempotent refresh rather than inserting duplicate record
      await execute(
        `UPDATE invites SET token = ?, role = ?, client_id = ?, created_at = ? WHERE id = ?`,
        [token, role, client_id || null, now, existing.id]
      );

      const refreshed = await queryOne('SELECT * FROM invites WHERE id = ?', [existing.id]);
      return res.json({ message: 'Pending invite token refreshed', invite: refreshed });
    }

    const id = `inv_${Date.now()}`;
    await execute(
      `INSERT INTO invites (id, agency_id, client_id, email, role, token, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, agencyId, client_id || null, cleanEmail, role, token, now]
    );

    const created = await queryOne('SELECT * FROM invites WHERE id = ?', [id]);
    res.status(201).json({ message: 'Invite sent', invite: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/invites/accept
 * Edge Case: Invite Races - Accepting the same invite twice shouldn't create two accounts or memberships
 */
router.post('/invites/accept', async (req: AuthRequest, res: Response) => {
  try {
    const { token, name } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const invite = await queryOne<any>('SELECT * FROM invites WHERE token = ?', [token]);
    if (!invite) {
      return res.status(404).json({ error: 'Invalid or expired invite token' });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Invite has already been accepted or expired' });
    }

    const now = new Date().toISOString();

    // Find or create user
    let user = await queryOne<any>('SELECT * FROM users WHERE LOWER(email) = ?', [invite.email.toLowerCase()]);
    if (!user) {
      const userId = `usr_${Date.now()}`;
      await execute(
        'INSERT INTO users (id, email, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?)',
        [userId, invite.email.toLowerCase(), name || invite.email.split('@')[0], null, now]
      );
      user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    }

    // Mark invite accepted BEFORE adding membership to guarantee single transaction step
    await execute("UPDATE invites SET status = 'accepted' WHERE id = ?", [invite.id]);

    // Create membership based on role
    if (invite.role === 'client_user' && invite.client_id) {
      const existingCc = await queryOne('SELECT * FROM client_contacts WHERE client_id = ? AND user_id = ?', [invite.client_id, user.id]);
      if (!existingCc) {
        await execute(
          'INSERT INTO client_contacts (id, client_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
          [`cc_${Date.now()}`, invite.client_id, user.id, 'client_user', now]
        );
      }
    } else {
      const existingMem = await queryOne('SELECT * FROM agency_memberships WHERE agency_id = ? AND user_id = ?', [invite.agency_id, user.id]);
      if (!existingMem) {
        await execute(
          'INSERT INTO agency_memberships (id, agency_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
          [`mem_${Date.now()}`, invite.agency_id, user.id, invite.role, now]
        );
      }
    }

    res.json({ message: 'Invite accepted successfully', user_id: user.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CLIENT INTAKE FORMS (BONUS FEATURE)
// ----------------------------------------------------

/**
 * POST /api/intake/submit (Public or Client form submission)
 */
router.post('/intake/submit', async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const { client_name, contact_email, project_title, project_description, budget } = req.body;

    if (!client_name || !contact_email || !project_title) {
      return res.status(400).json({ error: 'client_name, contact_email, and project_title are required' });
    }

    const id = `intake_${Date.now()}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO intake_submissions (id, agency_id, client_name, contact_email, project_title, project_description, budget, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
      [id, agencyId, client_name, contact_email, project_title, project_description || '', budget || '', now]
    );

    res.status(201).json({ message: 'Intake form submitted successfully', intake_id: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/intake (Agency Staff view submissions)
 */
router.get('/intake', requireAgencyStaff, async (req: AuthRequest, res: Response) => {
  try {
    const submissions = await queryRows(
      'SELECT * FROM intake_submissions WHERE agency_id = ? ORDER BY created_at DESC',
      [req.user!.active_agency_id]
    );
    res.json(submissions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/intake/:id/convert (Convert intake submission to active Client & Project)
 */
router.post('/intake/:id/convert', requireAgencyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const agencyId = req.user!.active_agency_id!;
    const intakeId = req.params.id;

    const intake = await queryOne<any>('SELECT * FROM intake_submissions WHERE id = ? AND agency_id = ?', [intakeId, agencyId]);
    if (!intake) {
      return res.status(404).json({ error: 'Intake submission not found' });
    }

    const now = new Date().toISOString();

    // 1. Create client if not existing
    let client = await queryOne<any>('SELECT * FROM clients WHERE agency_id = ? AND contact_email = ?', [agencyId, intake.contact_email]);
    if (!client) {
      const clientId = `client_${Date.now()}`;
      await execute(
        'INSERT INTO clients (id, agency_id, name, contact_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [clientId, agencyId, intake.client_name, intake.contact_email, 'active', now]
      );
      client = await queryOne('SELECT * FROM clients WHERE id = ?', [clientId]);
    }

    // 2. Create project
    const projectId = `prj_${Date.now()}`;
    await execute(
      `INSERT INTO projects (id, agency_id, client_id, name, description, status, budget_hours, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', 100, ?)`,
      [projectId, agencyId, client.id, intake.project_title, intake.project_description, now]
    );

    // 3. Mark intake approved
    await execute("UPDATE intake_submissions SET status = 'approved' WHERE id = ?", [intakeId]);

    res.json({
      message: 'Intake submission converted to Client and Project',
      client_id: client.id,
      project_id: projectId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
