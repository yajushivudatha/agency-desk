import React, { useState, useEffect } from 'react';
import { IntakeSubmission, UserAuthData } from '../types';
import { apiFetch } from '../lib/api';
import { FilePlus, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface ClientIntakeProps {
  authData: UserAuthData;
}

export const ClientIntake: React.FC<ClientIntakeProps> = ({ authData }) => {
  const isStaff = authData.active_context.role === 'agency_admin' || authData.active_context.role === 'agency_member';

  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([]);
  const [clientName, setClientName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [budget, setBudget] = useState('$15,000 - $30,000');
  const [submittedMessage, setSubmittedMessage] = useState(false);

  useEffect(() => {
    if (isStaff) {
      loadSubmissions();
    }
  }, [isStaff, authData.active_context.agency_id]);

  const loadSubmissions = async () => {
    try {
      const data = await apiFetch<IntakeSubmission[]>('/api/intake');
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to load intake submissions:', err);
    }
  };

  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/intake/submit', {
        method: 'POST',
        body: JSON.stringify({
          client_name: clientName,
          contact_email: contactEmail,
          project_title: projectTitle,
          project_description: projectDesc,
          budget
        })
      });
      setSubmittedMessage(true);
      setClientName('');
      setContactEmail('');
      setProjectTitle('');
      setProjectDesc('');
      if (isStaff) loadSubmissions();
    } catch (err: any) {
      alert(`Error submitting intake: ${err.message}`);
    }
  };

  const handleConvertIntake = async (intakeId: string) => {
    try {
      await apiFetch(`/api/intake/${intakeId}/convert`, { method: 'POST' });
      alert('Converted intake submission into active Client and Project!');
      loadSubmissions();
    } catch (err: any) {
      alert(`Error converting intake: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Intake Submission Form */}
        <div className="bg-white border border-[#E5E2D9] rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#4A5D4E] font-serif font-bold text-base">
            <FilePlus className="w-5 h-5" />
            <span>Client Project Intake Form</span>
          </div>
          <p className="text-xs text-[#6B6B5E]">
            Prospects and client partners use this intake form to request new project engagements.
          </p>

          {submittedMessage ? (
            <div className="p-4 bg-[#A8B5A2]/20 border border-[#8A9A8D]/30 text-[#2C3E30] rounded-lg text-xs space-y-2">
              <div className="font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#4A5D4E]" /> Intake Submitted Successfully!
              </div>
              <p>The agency team has received your project details and will follow up shortly.</p>
              <button
                onClick={() => setSubmittedMessage(false)}
                className="text-xs font-semibold text-[#3A4D3E] underline"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitIntake} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#6B6B5E] font-medium mb-1">Company / Client Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp or Vanguard Mobility"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#6B6B5E] font-medium mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="contact@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#6B6B5E] font-medium mb-1">Project Title</label>
                <input
                  type="text"
                  placeholder="e.g., iOS Mobile Commerce App"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E]"
                  required
                />
              </div>

              <div>
                <label className="block text-[#6B6B5E] font-medium mb-1">Project Requirements / Description</label>
                <textarea
                  placeholder="Outline key deliverables..."
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E]"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white py-2.5 rounded-lg font-semibold shadow-xs transition"
              >
                Submit Project Request
              </button>
            </form>
          )}
        </div>

        {/* Agency Review & 1-Click Convert Panel */}
        {isStaff && (
          <div className="bg-white border border-[#E5E2D9] rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="font-serif font-bold text-sm text-[#2C2C2C] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#4A5D4E]" />
              <span>Agency Intake Requests ({submissions.length})</span>
            </h3>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {submissions.map((sub) => (
                <div key={sub.id} className="p-4 rounded-lg border border-[#E5E2D9] bg-[#F9F8F4] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#2C2C2C]">{sub.project_title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      sub.status === 'approved' ? 'bg-[#A8B5A2]/30 text-[#2C3E30]' : 'bg-[#F2F0E9] text-[#6B6B5E]'
                    }`}>
                      {sub.status}
                    </span>
                  </div>

                  <p className="text-[#6B6B5E]">{sub.client_name} • {sub.contact_email}</p>
                  <p className="text-[#8C8C7E] italic">{sub.project_description || 'No description provided'}</p>

                  {sub.status === 'new' && authData.active_context.role === 'agency_admin' && (
                    <button
                      onClick={() => handleConvertIntake(sub.id)}
                      className="mt-2 w-full bg-[#4A5D4E] hover:bg-[#3A4D3E] text-white py-1.5 rounded font-semibold flex items-center justify-center gap-1.5 shadow-xs transition"
                    >
                      <span>1-Click Convert to Client & Project</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
