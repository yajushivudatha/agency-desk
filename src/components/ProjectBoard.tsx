import React, { useState, useEffect } from 'react';
import { Project, Task, UserAuthData } from '../types';
import { apiFetch } from '../lib/api';
import { TaskDetailsModal } from './TaskDetailsModal';
import { LayoutGrid, List, Plus, Lock, Eye, Search, AlertCircle, Clock, CheckCircle2, User, Filter } from 'lucide-react';

interface ProjectBoardProps {
  authData: UserAuthData;
}

export const ProjectBoard: React.FC<ProjectBoardProps> = ({ authData }) => {
  const isClient = authData.active_context.role === 'client_user';

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // New task form modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newIsInternal, setNewIsInternal] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [authData.active_context.agency_id, authData.active_context.role, authData.active_context.client_id]);

  useEffect(() => {
    loadTasks();
  }, [selectedProjectId, searchQuery, authData.active_context.agency_id, authData.active_context.role]);

  const loadProjects = async () => {
    try {
      const data = await apiFetch<Project[]>('/api/projects');
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadTasks = async () => {
    try {
      let url = `/api/tasks?`;
      if (selectedProjectId) url += `project_id=${selectedProjectId}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const data = await apiFetch<Task[]>(url);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !selectedProjectId) return;

    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          project_id: selectedProjectId,
          title: newTitle,
          description: newDescription,
          priority: newPriority,
          is_internal: newIsInternal
        })
      });
      setNewTitle('');
      setNewDescription('');
      setShowCreateModal(false);
      loadTasks();
    } catch (err: any) {
      alert(`Error creating task: ${err.message}`);
    }
  };

  const COLUMNS = [
    { key: 'todo', label: 'To Do', color: 'border-[#E5E2D9] bg-[#F2F0E9]/60' },
    { key: 'in_progress', label: 'In Progress', color: 'border-[#A8B5A2] bg-[#A8B5A2]/10' },
    { key: 'in_review', label: 'In Review', color: 'border-[#8A9A8D] bg-[#8A9A8D]/10' },
    { key: 'done', label: 'Done', color: 'border-[#4A5D4E] bg-[#4A5D4E]/10' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Controls & Filter Bar */}
      <div className="bg-white border border-[#E5E2D9] rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Project Selector & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#8C8C7E]" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-[#F9F8F4] border border-[#E5E2D9] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E]"
            >
              <option value="">All Client Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.client_name || 'Client'})
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-[#8C8C7E] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#F9F8F4] border border-[#E5E2D9] rounded-lg text-xs text-[#2C2C2C] placeholder-[#8C8C7E] focus:outline-hidden focus:border-[#4A5D4E]"
            />
          </div>
        </div>

        {/* View Mode Toggle & Create Button */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center bg-[#F2F0E9] p-1 rounded-lg border border-[#E5E2D9]">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded text-xs font-medium ${viewMode === 'kanban' ? 'bg-white text-[#4A5D4E] shadow-xs font-bold' : 'text-[#6B6B5E]'}`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs font-medium ${viewMode === 'list' ? 'bg-white text-[#4A5D4E] shadow-xs font-bold' : 'text-[#6B6B5E]'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {!isClient ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          ) : (
            <div className="text-xs text-[#6B6B5E] italic bg-[#F2F0E9] px-3 py-1.5 rounded-lg border border-[#E5E2D9]">
              Client Portal Mode: View & Comment Only
            </div>
          )}
        </div>
      </div>

      {/* Board View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                className="bg-[#F2F0E9]/80 border border-[#E5E2D9] rounded-xl p-3 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5E2D9]">
                  <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#2C2C2C]">
                    {col.label}
                  </span>
                  <span className="bg-[#E5E2D9] text-[#2C2C2C] text-xs px-2 py-0.5 rounded-full font-semibold">
                    {colTasks.length}
                  </span>
                </div>

                {/* Task Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#8C8C7E] italic">No tasks</div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="bg-white p-3.5 rounded-lg border border-[#E5E2D9] shadow-xs hover:border-[#4A5D4E] hover:shadow-md transition cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-xs text-[#2C2C2C] line-clamp-2 group-hover:text-[#4A5D4E] transition">
                            {task.title}
                          </h4>

                          {task.is_internal === 1 ? (
                            <span className="text-[10px] bg-[#4A5D4E] text-white px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5 shrink-0" title="Internal agency task (hidden from clients)">
                              <Lock className="w-2.5 h-2.5" /> Internal
                            </span>
                          ) : (
                            <span className="text-[10px] bg-[#8A9A8D]/20 text-[#3A4D3E] border border-[#8A9A8D]/30 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5 shrink-0" title="Client-visible task">
                              <Eye className="w-2.5 h-2.5" /> Client
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-[#6B6B5E] line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        <div className="pt-2 border-t border-[#F2F0E9] flex items-center justify-between text-[11px] text-[#8C8C7E]">
                          <span className={`px-2 py-0.5 rounded font-semibold uppercase text-[10px] ${
                            task.priority === 'urgent' ? 'bg-[#FDF2F2] text-[#C85A5A] border border-[#F5D0D0]' :
                            task.priority === 'high' ? 'bg-[#F2F0E9] text-[#4A5D4E] border border-[#E5E2D9]' : 'bg-[#F9F8F4] text-[#6B6B5E]'
                          }`}>
                            {task.priority}
                          </span>

                          <div className="flex items-center gap-1.5 text-[#2C2C2C] font-medium">
                            <User className="w-3 h-3 text-[#8C8C7E]" />
                            <span>{task.assignee_name?.split(' ')[0] || 'Unassigned'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white border border-[#E5E2D9] rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F2F0E9] text-[#6B6B5E] font-serif font-bold border-b border-[#E5E2D9]">
              <tr>
                <th className="p-3.5">Task Title</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Assignee</th>
                <th className="p-3.5">Visibility</th>
                <th className="p-3.5">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2D9]">
              {tasks.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className="hover:bg-[#F9F8F4] cursor-pointer transition"
                >
                  <td className="p-3.5 font-bold text-[#2C2C2C]">{t.title}</td>
                  <td className="p-3.5 uppercase font-medium text-[#6B6B5E]">{t.status.replace('_', ' ')}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded font-semibold uppercase text-[10px] ${
                      t.priority === 'urgent' ? 'bg-[#FDF2F2] text-[#C85A5A]' : 'bg-[#F2F0E9] text-[#6B6B5E]'
                    }`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="p-3.5 font-medium text-[#2C2C2C]">{t.assignee_name || 'Unassigned'}</td>
                  <td className="p-3.5">
                    {t.is_internal === 1 ? (
                      <span className="bg-[#4A5D4E] text-white px-2 py-0.5 rounded font-semibold text-[10px]">Internal</span>
                    ) : (
                      <span className="bg-[#8A9A8D]/20 text-[#3A4D3E] border border-[#8A9A8D]/30 px-2 py-0.5 rounded font-semibold text-[10px]">Client Visible</span>
                    )}
                  </td>
                  <td className="p-3.5 text-[#8C8C7E]">{t.due_date || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          authData={authData}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={() => {
            loadTasks();
            if (selectedTask) {
              apiFetch<Task>(`/api/tasks/${selectedTask.id}`)
                .then(setSelectedTask)
                .catch(() => setSelectedTask(null));
            }
          }}
        />
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#2C2C2C]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E2D9] rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-base font-serif font-bold text-[#2C2C2C]">Create New Task</h3>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#6B6B5E] font-medium mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g., Design Vector Brand Guidelines"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#6B6B5E] font-medium mb-1">Description</label>
                <textarea
                  placeholder="Task details..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C]"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B6B5E] font-medium mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsInternal}
                      onChange={(e) => setNewIsInternal(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-semibold text-[#4A5D4E]">Internal Only</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E2D9]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#E5E2D9] font-medium text-[#6B6B5E] hover:bg-[#F2F0E9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white font-semibold shadow-xs"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
