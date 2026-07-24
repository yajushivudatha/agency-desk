import React, { useState, useEffect } from 'react';
import { Task, TaskComment, TaskFile, UserAuthData } from '../types';
import { apiFetch } from '../lib/api';
import { X, MessageSquare, Paperclip, CheckCircle2, AlertCircle, Clock, Send, Lock, Eye, FileText, Check, FileCheck } from 'lucide-react';

interface TaskDetailsModalProps {
  task: Task;
  authData: UserAuthData;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  authData,
  onClose,
  onTaskUpdated
}) => {
  const isClient = authData.active_context.role === 'client_user';

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

  // File upload fields
  const [newFileName, setNewFileName] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [isFileInternal, setIsFileInternal] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // File approval notes
  const [selectedFileForApproval, setSelectedFileForApproval] = useState<TaskFile | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    loadTaskDetails();
  }, [task.id]);

  const loadTaskDetails = async () => {
    try {
      setLoadingComments(true);
      const [commentsData, filesData] = await Promise.all([
        apiFetch<TaskComment[]>(`/api/tasks/${task.id}/comments`),
        apiFetch<TaskFile[]>(`/api/tasks/${task.id}/files`)
      ]);
      setComments(commentsData);
      setFiles(filesData);
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await apiFetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          comment_text: newComment,
          is_internal: isClient ? false : isInternalComment
        })
      });
      setNewComment('');
      setIsInternalComment(false);
      loadTaskDetails();
    } catch (err: any) {
      alert(`Error posting comment: ${err.message}`);
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    try {
      await apiFetch(`/api/tasks/${task.id}/files`, {
        method: 'POST',
        body: JSON.stringify({
          file_name: newFileName,
          file_url: newFileUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
          file_size: '2.4 MB',
          file_type: newFileName.endsWith('.pdf') ? 'pdf' : 'image',
          is_internal: isClient ? false : isFileInternal
        })
      });
      setNewFileName('');
      setNewFileUrl('');
      setShowUploadForm(false);
      loadTaskDetails();
    } catch (err: any) {
      alert(`Error uploading file: ${err.message}`);
    }
  };

  const handleFileApproval = async (fileId: string, status: 'approved' | 'needs_changes') => {
    try {
      await apiFetch(`/api/files/${fileId}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({
          approval_status: status,
          approval_notes: approvalNotes
        })
      });
      setSelectedFileForApproval(null);
      setApprovalNotes('');
      loadTaskDetails();
      onTaskUpdated();
    } catch (err: any) {
      alert(`Error updating file approval: ${err.message}`);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (isClient) return; // Client users blocked
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      onTaskUpdated();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2C2C2C]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E2D9] flex items-start justify-between gap-4 bg-[#F2F0E9]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#E5E2D9] text-[#2C2C2C]">
                {task.project_name || 'Project Task'}
              </span>
              {task.is_internal === 1 ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#4A5D4E] text-white flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Agency Internal
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#8A9A8D]/20 text-[#3A4D3E] border border-[#8A9A8D]/30 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Client Visible
                </span>
              )}
            </div>
            <h2 className="text-lg font-serif font-bold text-[#2C2C2C]">{task.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="text-[#8C8C7E] hover:text-[#2C2C2C] p-1 rounded-lg hover:bg-[#E5E2D9]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-[#2C2C2C]">
          
          {/* Status & Priority Controls */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-[#F9F8F4] border border-[#E5E2D9] text-xs">
            <div>
              <span className="text-[#6B6B5E] block mb-1">Status</span>
              {isClient ? (
                <span className="font-semibold uppercase tracking-wider text-[#2C2C2C]">
                  {task.status.replace('_', ' ')}
                </span>
              ) : (
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="bg-white border border-[#E5E2D9] rounded px-2 py-1 font-semibold text-[#2C2C2C]"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              )}
            </div>

            <div>
              <span className="text-[#6B6B5E] block mb-1">Priority</span>
              <span className={`font-semibold uppercase px-2 py-0.5 rounded text-[11px] ${
                task.priority === 'urgent' ? 'bg-[#FDF2F2] text-[#C85A5A]' :
                task.priority === 'high' ? 'bg-[#F2F0E9] text-[#4A5D4E]' : 'bg-[#E5E2D9] text-[#2C2C2C]'
              }`}>
                {task.priority}
              </span>
            </div>

            <div>
              <span className="text-[#6B6B5E] block mb-1">Assignee</span>
              <span className="font-medium text-[#2C2C2C]">
                {task.assignee_name || 'Unassigned'}
              </span>
            </div>

            <div>
              <span className="text-[#6B6B5E] block mb-1">Due Date</span>
              <span className="font-medium text-[#2C2C2C]">
                {task.due_date || 'No due date'}
              </span>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-[#6B6B5E] mb-1">Description</h3>
              <p className="text-sm bg-[#F9F8F4] p-3 rounded-lg border border-[#E5E2D9] leading-relaxed text-[#2C2C2C]">
                {task.description}
              </p>
            </div>
          )}

          {/* Attachments & Client File Approval Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-serif font-bold flex items-center gap-2 text-[#2C2C2C]">
                <Paperclip className="w-4 h-4 text-[#4A5D4E]" />
                <span>Task Files & Approval ({files.length})</span>
              </h3>

              {!isClient && (
                <button
                  onClick={() => setShowUploadForm(!showUploadForm)}
                  className="text-xs text-[#4A5D4E] hover:underline font-medium"
                >
                  + Attach File
                </button>
              )}
            </div>

            {/* Upload form */}
            {showUploadForm && (
              <form onSubmit={handleAddFile} className="mb-4 p-3 bg-[#F2F0E9] rounded-lg border border-[#E5E2D9] text-xs space-y-2">
                <input
                  type="text"
                  placeholder="File name (e.g., Logo_Design_v2.pdf)"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-[#E5E2D9] bg-white text-[#2C2C2C]"
                  required
                />
                <input
                  type="text"
                  placeholder="File preview URL (optional)"
                  value={newFileUrl}
                  onChange={(e) => setNewFileUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-[#E5E2D9] bg-white text-[#2C2C2C]"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[#6B6B5E]">
                    <input
                      type="checkbox"
                      checked={isFileInternal}
                      onChange={(e) => setIsFileInternal(e.target.checked)}
                    />
                    <span>Internal File (Agency Only)</span>
                  </label>
                  <button type="submit" className="bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white px-3 py-1 rounded font-medium shadow-xs">
                    Upload
                  </button>
                </div>
              </form>
            )}

            {/* Files List */}
            {files.length === 0 ? (
              <p className="text-xs text-[#8C8C7E] italic">No files attached to this task yet.</p>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-[#E5E2D9] text-[#4A5D4E]">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-[#2C2C2C] flex items-center gap-2">
                          {file.file_name}
                          {file.is_internal === 1 && (
                            <span className="text-[10px] bg-[#4A5D4E] text-white px-1.5 py-0.2 rounded">
                              Internal
                            </span>
                          )}
                        </div>
                        <div className="text-[#8C8C7E]">
                          {file.file_size} • Uploaded by {file.uploader_name || 'Staff'}
                        </div>
                      </div>
                    </div>

                    {/* Approval Status Badge & Actions */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                        file.approval_status === 'approved' ? 'bg-[#A8B5A2]/30 text-[#2C3E30]' :
                        file.approval_status === 'needs_changes' ? 'bg-[#FDF2F2] text-[#C85A5A]' :
                        'bg-[#E5E2D9] text-[#2C2C2C]'
                      }`}>
                        {file.approval_status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {file.approval_status === 'needs_changes' && <AlertCircle className="w-3.5 h-3.5" />}
                        <span className="capitalize">{file.approval_status.replace('_', ' ')}</span>
                      </span>

                      {/* Approval Action Button */}
                      <button
                        onClick={() => setSelectedFileForApproval(selectedFileForApproval?.id === file.id ? null : file)}
                        className="px-2.5 py-1 bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white rounded font-medium transition shadow-xs"
                      >
                        Review
                      </button>
                    </div>

                    {/* File Approval Notes Expandable Drawer */}
                    {selectedFileForApproval?.id === file.id && (
                      <div className="w-full mt-2 pt-2 border-t border-[#E5E2D9] space-y-2">
                        <textarea
                          placeholder="Optional feedback note (e.g., 'Approved for release' or 'Please adjust color contrast')"
                          value={approvalNotes}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          className="w-full p-2 rounded border border-[#E5E2D9] bg-white text-xs text-[#2C2C2C]"
                          rows={2}
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleFileApproval(file.id, 'needs_changes')}
                            className="px-3 py-1 bg-[#C85A5A] hover:bg-[#A84A4A] text-white rounded font-medium"
                          >
                            Request Changes
                          </button>
                          <button
                            onClick={() => handleFileApproval(file.id, 'approved')}
                            className="px-3 py-1 bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white rounded font-medium"
                          >
                            Approve File
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="pt-4 border-t border-[#E5E2D9]">
            <h3 className="text-sm font-serif font-bold flex items-center gap-2 mb-3 text-[#2C2C2C]">
              <MessageSquare className="w-4 h-4 text-[#4A5D4E]" />
              <span>Discussion & Comments ({comments.length})</span>
            </h3>

            {/* Comments List */}
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-lg border text-xs ${
                    comment.is_internal === 1
                      ? 'bg-[#F2F0E9] border-[#4A5D4E]/30'
                      : 'bg-[#F9F8F4] border-[#E5E2D9]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#2C2C2C] flex items-center gap-2">
                      {comment.author_name}
                      {comment.is_internal === 1 && (
                        <span className="text-[10px] bg-[#4A5D4E] text-white px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Internal Staff Note
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-[#8C8C7E]">
                      {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[#2C2C2C] leading-relaxed">{comment.comment_text}</p>
                </div>
              ))}
            </div>

            {/* Post Comment Form */}
            <form onSubmit={handleAddComment} className="space-y-2">
              <textarea
                placeholder={isClient ? "Leave feedback or questions for the agency..." : "Write a comment..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full p-3 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-xs text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E]"
                rows={2}
                required
              />

              <div className="flex items-center justify-between">
                {!isClient ? (
                  <label className="flex items-center gap-1.5 text-xs text-[#6B6B5E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalComment}
                      onChange={(e) => setIsInternalComment(e.target.checked)}
                      className="rounded border-[#E5E2D9]"
                    />
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#4A5D4E]" /> Internal (Agency Only)
                    </span>
                  </label>
                ) : (
                  <span className="text-xs text-[#4A5D4E] flex items-center gap-1 font-medium">
                    <Eye className="w-3.5 h-3.5" /> Visible to agency staff
                  </span>
                )}

                <button
                  type="submit"
                  className="bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white px-4 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" /> Post Comment
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
