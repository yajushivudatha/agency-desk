export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface ActiveContext {
  agency_id: string;
  role: 'agency_admin' | 'agency_member' | 'client_user';
  client_id?: string;
}

export interface AgencyMembership {
  agency_id: string;
  agency_name: string;
  agency_slug: string;
  role: 'agency_admin' | 'agency_member';
}

export interface ClientMembership {
  client_id: string;
  client_name: string;
  agency_id: string;
  agency_name: string;
  role: 'client_user';
}

export interface UserAuthData {
  user: User;
  active_context: ActiveContext;
  memberships: {
    agencies: AgencyMembership[];
    clients: ClientMembership[];
  };
}

export interface Client {
  id: string;
  agency_id: string;
  name: string;
  contact_email: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface Project {
  id: string;
  agency_id: string;
  client_id: string;
  client_name?: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  budget_hours: number;
  created_at: string;
}

export interface Task {
  id: string;
  agency_id: string;
  project_id: string;
  project_name?: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id?: string | null;
  assignee_name?: string;
  assignee_avatar?: string;
  due_date?: string;
  is_internal: number; // 0 = client-visible, 1 = internal
  created_at: string;
}

export interface TaskComment {
  id: string;
  agency_id: string;
  task_id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  comment_text: string;
  is_internal: number;
  created_at: string;
}

export interface TaskFile {
  id: string;
  agency_id: string;
  task_id: string;
  uploader_id: string;
  uploader_name?: string;
  file_name: string;
  file_size: string;
  file_url: string;
  file_type: string;
  approval_status: 'pending' | 'approved' | 'needs_changes';
  approval_notes?: string;
  is_internal: number;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  agency_id: string;
  task_id: string;
  task_title?: string;
  project_name?: string;
  user_id: string;
  user_name?: string;
  duration_minutes: number;
  note?: string;
  entry_date: string;
  created_at: string;
}

export interface IntakeSubmission {
  id: string;
  agency_id: string;
  client_name: string;
  contact_email: string;
  project_title: string;
  project_description?: string;
  budget?: string;
  status: 'new' | 'approved' | 'declined';
  created_at: string;
}
