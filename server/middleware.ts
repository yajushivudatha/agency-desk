import { Request, Response, NextFunction } from 'express';
import { queryOne, queryRows } from './db.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  active_agency_id?: string;
  active_role?: 'agency_admin' | 'agency_member' | 'client_user';
  active_client_id?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Authentication Middleware
 * Resolves current user and active context from headers:
 * - X-User-Id: User ID
 * - X-Agency-Id: Active Tenant (Agency) ID
 * - X-Role: Active Role ('agency_admin' | 'agency_member' | 'client_user')
 * - X-Client-Id: Active Client ID (if role is client_user)
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'usr_apex_admin';
    const reqAgencyId = req.headers['x-agency-id'] as string;
    const reqRole = req.headers['x-role'] as string;
    const reqClientId = req.headers['x-client-id'] as string;

    const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    // Default or requested active context
    let activeAgencyId = reqAgencyId;
    let activeRole = reqRole as any;
    let activeClientId = reqClientId;

    // Fallback: Find user's default membership if not specified
    if (!activeAgencyId || !activeRole) {
      const agencyMem = await queryOne<any>(
        'SELECT * FROM agency_memberships WHERE user_id = ? LIMIT 1',
        [userId]
      );

      if (agencyMem) {
        activeAgencyId = agencyMem.agency_id;
        activeRole = agencyMem.role;
      } else {
        const clientMem = await queryOne<any>(
          `SELECT cc.*, c.agency_id 
           FROM client_contacts cc 
           JOIN clients c ON cc.client_id = c.id 
           WHERE cc.user_id = ? LIMIT 1`,
          [userId]
        );

        if (clientMem) {
          activeAgencyId = clientMem.agency_id;
          activeRole = 'client_user';
          activeClientId = clientMem.client_id;
        }
      }
    }

    // Validate that client_user has an active_client_id
    if (activeRole === 'client_user' && !activeClientId) {
      const clientContact = await queryOne<any>(
        `SELECT cc.client_id 
         FROM client_contacts cc 
         JOIN clients c ON cc.client_id = c.id 
         WHERE cc.user_id = ? AND c.agency_id = ? LIMIT 1`,
        [userId, activeAgencyId]
      );
      if (clientContact) {
        activeClientId = clientContact.client_id;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      active_agency_id: activeAgencyId,
      active_role: activeRole,
      active_client_id: activeClientId
    };

    next();
  } catch (err: any) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal Auth Error' });
  }
}

/**
 * Tenant Isolation & Authorization Guard
 * Ensures user belongs to the target agency context and enforces tenant isolation
 */
export async function tenantGuard(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.active_agency_id) {
    return res.status(400).json({ error: 'Missing active agency tenant context' });
  }

  const { id: userId, active_agency_id: agencyId, active_role: role } = req.user;

  // Check if user has legitimate membership in this agency
  if (role === 'agency_admin' || role === 'agency_member') {
    const membership = await queryOne(
      'SELECT * FROM agency_memberships WHERE agency_id = ? AND user_id = ? AND role = ?',
      [agencyId, userId, role]
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access Denied: User is not a member of this agency tenant' });
    }
  } else if (role === 'client_user') {
    const contact = await queryOne(
      `SELECT cc.* 
       FROM client_contacts cc
       JOIN clients c ON cc.client_id = c.id
       WHERE cc.user_id = ? AND c.agency_id = ?`,
      [userId, agencyId]
    );

    if (!contact) {
      return res.status(403).json({ error: 'Access Denied: User is not a registered client contact for this tenant' });
    }
  }

  next();
}

/**
 * RBAC Helper: Require Agency Staff (agency_admin or agency_member)
 */
export function requireAgencyStaff(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.active_role !== 'agency_admin' && req.user.active_role !== 'agency_member')) {
    return res.status(403).json({ error: 'Forbidden: Client users cannot perform this action' });
  }
  next();
}

/**
 * RBAC Helper: Require Agency Admin
 */
export function requireAgencyAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.active_role !== 'agency_admin') {
    return res.status(403).json({ error: 'Forbidden: Requires Agency Admin privileges' });
  }
  next();
}
