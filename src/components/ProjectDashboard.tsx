import React, { useState, useEffect } from 'react';
import { Project, UserAuthData } from '../types';
import { apiFetch } from '../lib/api';
import { BarChart3, Clock, CheckCircle2, AlertCircle, Shield, Eye, Lock } from 'lucide-react';

interface ProjectDashboardProps {
  authData: UserAuthData;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ authData }) => {
  const isClient = authData.active_context.role === 'client_user';

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [authData.active_context.agency_id, authData.active_context.role]);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectMetrics(selectedProjectId);
    }
  }, [selectedProjectId, authData.active_context.role]);

  const loadProjects = async () => {
    try {
      const data = await apiFetch<Project[]>('/api/projects');
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects for dashboard:', err);
    }
  };

  const loadProjectMetrics = async (projectId: string) => {
    try {
      setLoading(true);
      const data = await apiFetch<any>(`/api/projects/${projectId}`);
      setMetrics(data.metrics);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      
      {/* Project Selector Bar */}
      <div className="bg-white border border-[#E5E2D9] rounded-xl p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[#4A5D4E]" />
          <span className="font-serif font-bold text-sm text-[#2C2C2C]">Project Dashboard:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-[#F9F8F4] border border-[#E5E2D9] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.client_name || 'Client'})
              </option>
            ))}
          </select>
        </div>

        {isClient ? (
          <span className="text-xs bg-[#8A9A8D]/20 text-[#3A4D3E] border border-[#8A9A8D]/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Client View (Internal Tasks Filtered Out)
          </span>
        ) : (
          <span className="text-xs bg-[#4A5D4E]/10 text-[#4A5D4E] border border-[#4A5D4E]/20 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Agency Staff View (Full Internal + Client Visibility)
          </span>
        )}
      </div>

      {metrics && selectedProject && (
        <div className="space-y-6">
          
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-xs space-y-1">
              <span className="text-xs uppercase tracking-wider text-[#8C8C7E] font-semibold">Total Logged Hours</span>
              <div className="text-3xl font-serif font-black text-[#4A5D4E]">
                {metrics.logged_hours} hrs
              </div>
              <p className="text-xs text-[#6B6B5E]">
                Out of {metrics.budget_hours || 0} budgeted hours ({Math.round((metrics.logged_hours / (metrics.budget_hours || 1)) * 100)}%)
              </p>
            </div>

            <div className="bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-xs space-y-1">
              <span className="text-xs uppercase tracking-wider text-[#8C8C7E] font-semibold">Tasks Completed</span>
              <div className="text-3xl font-serif font-black text-[#4A5D4E]">
                {metrics.task_status_counts?.find((s: any) => s.status === 'done')?.count || 0}
              </div>
              <p className="text-xs text-[#6B6B5E]">
                Scoped to {isClient ? 'Client-Visible' : 'Agency Staff'} view
              </p>
            </div>

            <div className="bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-xs space-y-1">
              <span className="text-xs uppercase tracking-wider text-[#8C8C7E] font-semibold">Project Status</span>
              <div className="text-3xl font-serif font-black capitalize text-[#2C2C2C]">
                {selectedProject.status}
              </div>
              <p className="text-xs text-[#6B6B5E]">Client: {selectedProject.client_name}</p>
            </div>

          </div>

          {/* Task Status Distribution Visual Bars */}
          <div className="bg-white border border-[#E5E2D9] rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-serif font-bold text-[#2C2C2C]">Task Status Breakdown</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['todo', 'in_progress', 'in_review', 'done'].map((statusKey) => {
                const count = metrics.task_status_counts?.find((s: any) => s.status === statusKey)?.count || 0;
                return (
                  <div key={statusKey} className="p-4 rounded-lg bg-[#F9F8F4] border border-[#E5E2D9] space-y-1">
                    <span className="text-xs uppercase tracking-wider font-semibold text-[#8C8C7E] block">
                      {statusKey.replace('_', ' ')}
                    </span>
                    <div className="text-2xl font-serif font-bold text-[#2C2C2C]">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
