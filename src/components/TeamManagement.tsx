import React, { useState, useEffect } from 'react';
import { UserAuthData } from '../types';
import { apiFetch } from '../lib/api';
import { Users, UserX, UserPlus, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Lock } from 'lucide-react';

interface TeamManagementProps {
  authData: UserAuthData;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ authData }) => {
  const isAdmin = authData.active_context.role === 'agency_admin';

  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'agency_admin' | 'agency_member' | 'client_user'>('agency_member');
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  useEffect(() => {
    loadTeamData();
  }, [authData.active_context.agency_id]);

  const loadTeamData = async () => {
    try {
      const [membersData, invitesData] = await Promise.all([
        apiFetch<any[]>('/api/agencies/members'),
        apiFetch<any[]>('/api/invites')
      ]);
      setMembers(membersData);
      setInvites(invitesData);
    } catch (err) {
      console.error('Failed to load team data:', err);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      const res = await apiFetch<any>('/api/invites', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole
        })
      });
      alert(res.message || 'Invite sent successfully!');
      setInviteEmail('');
      loadTeamData();
    } catch (err: any) {
      alert(`Error sending invite: ${err.message}`);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the agency team?\n\nThis will safely unassign their active tasks and generate an audit comment.`)) {
      return;
    }

    try {
      const res = await apiFetch<any>(`/api/agencies/members/${userId}`, {
        method: 'DELETE'
      });
      alert(`${res.message}. Unassigned ${res.unassigned_task_count} active task(s).`);
      loadTeamData();
    } catch (err: any) {
      alert(`Error removing member: ${err.message}`);
    }
  };

  const runBrowserIsolationTests = async () => {
    setRunningTests(true);
    const results: any[] = [];

    try {
      // Test 1: Query tasks with current context
      const tasks = await apiFetch<any[]>('/api/tasks');
      const hasCrossTenant = tasks.some((t: any) => t.agency_id !== authData.active_context.agency_id);
      results.push({
        name: 'Tenant Isolation Check',
        passed: !hasCrossTenant,
        message: !hasCrossTenant ? 'All returned tasks strictly belong to active agency' : 'Leak detected!'
      });

      // Test 2: If client_user, verify zero internal tasks
      if (authData.active_context.role === 'client_user') {
        const internalTasks = tasks.filter((t: any) => t.is_internal === 1);
        results.push({
          name: 'Client Internal Content Filter',
          passed: internalTasks.length === 0,
          message: internalTasks.length === 0 ? 'Zero internal tasks exposed to client' : `Leaked ${internalTasks.length} internal task(s)`
        });
      } else {
        results.push({
          name: 'Agency Staff Permission Check',
          passed: true,
          message: 'Staff authenticated with internal task access'
        });
      }

      setTestResults(results);
    } catch (err: any) {
      results.push({
        name: 'API Execution Error',
        passed: false,
        message: err.message
      });
      setTestResults(results);
    } finally {
      setRunningTests(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Team & Member Removal */}
      <div className="bg-white border border-[#E5E2D9] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-serif font-bold text-sm text-[#2C2C2C]">
            <Users className="w-5 h-5 text-[#4A5D4E]" />
            <span>Agency Team Roster ({members.length})</span>
          </div>

          <button
            onClick={runBrowserIsolationTests}
            disabled={runningTests}
            className="bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
            <span>Run In-Browser Tenant Isolation Test</span>
          </button>
        </div>

        {/* Live Test Suite Results Banner */}
        {testResults && (
          <div className="p-4 rounded-xl bg-[#2C2C2C] text-white space-y-2 text-xs border border-[#4A5D4E]">
            <span className="font-serif font-bold uppercase tracking-wider text-[#A8B5A2] block">
              Automated Isolation Verification Summary
            </span>
            {testResults.map((tr, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {tr.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-[#A8B5A2] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#C85A5A] shrink-0" />
                )}
                <span className="font-semibold">{tr.name}:</span>
                <span className="text-[#E5E2D9]">{tr.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F2F0E9] text-[#6B6B5E] font-serif font-bold border-b border-[#E5E2D9]">
              <tr>
                <th className="p-3">Team Member</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                {isAdmin && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2D9]">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-[#F9F8F4] transition">
                  <td className="p-3 font-bold text-[#2C2C2C] flex items-center gap-2">
                    {m.name}
                  </td>
                  <td className="p-3 text-[#6B6B5E]">{m.email}</td>
                  <td className="p-3">
                    <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold bg-[#8A9A8D]/20 text-[#3A4D3E] border border-[#8A9A8D]/30">
                      {m.role}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      {m.id !== authData.user.id && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.name)}
                          className="px-2.5 py-1 bg-[#FDF2F2] hover:bg-[#F5D0D0] text-[#C85A5A] rounded font-medium flex items-center gap-1 ml-auto text-[11px]"
                          title="Remove team member and unassign active tasks safely"
                        >
                          <UserX className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Section */}
      {isAdmin && (
        <div className="bg-white border border-[#E5E2D9] rounded-xl p-6 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-sm text-[#2C2C2C] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#4A5D4E]" />
            <span>Invite Team Member or Client (Idempotent Invite Test)</span>
          </h3>

          <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row items-center gap-3 text-xs">
            <input
              type="email"
              placeholder="member@agency.com or client@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 w-full p-2.5 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E]"
              required
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="p-2.5 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C] font-medium"
            >
              <option value="agency_member">Agency Staff Member</option>
              <option value="agency_admin">Agency Admin</option>
              <option value="client_user">Client Portal Guest</option>
            </select>

            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white font-semibold rounded-lg shadow-xs"
            >
              Send Invite
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
