import React, { useState, useEffect } from 'react';
import { Task, TimeEntry, UserAuthData } from '../types';
import { apiFetch } from '../lib/api';
import { Clock, Plus, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface TimeTrackerProps {
  authData: UserAuthData;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({ authData }) => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [durationHours, setDurationHours] = useState('1.5');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, [authData.active_context.agency_id]);

  const loadData = async () => {
    try {
      const [entries, taskList] = await Promise.all([
        apiFetch<TimeEntry[]>('/api/time-entries'),
        apiFetch<Task[]>('/api/tasks')
      ]);
      setTimeEntries(entries);
      setTasks(taskList);
      if (taskList.length > 0 && !selectedTaskId) {
        setSelectedTaskId(taskList[0].id);
      }
    } catch (err) {
      console.error('Failed to load time tracking data:', err);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !durationHours) return;

    try {
      const durationMinutes = Math.round(parseFloat(durationHours) * 60);
      await apiFetch('/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          task_id: selectedTaskId,
          duration_minutes: durationMinutes,
          note,
          entry_date: entryDate
        })
      });
      setNote('');
      loadData();
    } catch (err: any) {
      alert(`Error logging time: ${err.message}`);
    }
  };

  const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="space-y-6">
      
      {/* Header Metric */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#4A5D4E] text-white rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-[#A8B5A2] font-semibold block mb-1">
              Total Logged Agency Hours
            </span>
            <div className="text-3xl font-serif font-black">{totalHours} hrs</div>
            <p className="text-xs text-[#A8B5A2] mt-1">{timeEntries.length} time entries recorded</p>
          </div>
          <Clock className="w-10 h-10 opacity-30" />
        </div>
      </div>

      {/* Log Time Entry Form & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form */}
        <div className="bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-xs space-y-4 h-fit">
          <h3 className="text-sm font-serif font-bold text-[#2C2C2C] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#4A5D4E]" />
            <span>Log Time Entry</span>
          </h3>

          <form onSubmit={handleLogTime} className="space-y-3 text-xs">
            <div>
              <label className="block text-[#6B6B5E] font-medium mb-1">Select Task</label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C] font-medium"
                required
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.project_name || 'Project'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#6B6B5E] font-medium mb-1">Duration (Hours)</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  className="w-full p-2 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#6B6B5E] font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[#6B6B5E] font-medium mb-1">Note / Activity Work</label>
              <textarea
                placeholder="Work done (e.g., Vector icon creation and color contrast checks)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C]"
                rows={3}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white py-2 rounded-lg font-semibold shadow-xs flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Log Time
            </button>
          </form>
        </div>

        {/* Entries Table */}
        <div className="lg:col-span-2 bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-serif font-bold text-[#2C2C2C] mb-4">Time Entry History</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F2F0E9] text-[#6B6B5E] font-serif font-bold border-b border-[#E5E2D9]">
                <tr>
                  <th className="p-3">Task & Project</th>
                  <th className="p-3">Logged By</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2D9]">
                {timeEntries.map((te) => (
                  <tr key={te.id} className="hover:bg-[#F9F8F4] transition">
                    <td className="p-3">
                      <div className="font-bold text-[#2C2C2C]">{te.task_title || 'Task'}</div>
                      <div className="text-[10px] text-[#8C8C7E]">{te.project_name}</div>
                    </td>
                    <td className="p-3 font-medium text-[#2C2C2C]">{te.user_name || 'Staff'}</td>
                    <td className="p-3 font-bold text-[#4A5D4E]">
                      {(te.duration_minutes / 60).toFixed(1)} hrs
                    </td>
                    <td className="p-3 text-[#8C8C7E]">{te.entry_date}</td>
                    <td className="p-3 text-[#6B6B5E] max-w-xs truncate">{te.note || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
