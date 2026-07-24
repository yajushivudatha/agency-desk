import React, { useState, useEffect } from 'react';
import { UserAuthData } from './types';
import { setPersonaContext, apiFetch } from './lib/api';
import { Navbar } from './components/Navbar';
import { ProjectBoard } from './components/ProjectBoard';
import { TimeTracker } from './components/TimeTracker';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ClientIntake } from './components/ClientIntake';
import { TeamManagement } from './components/TeamManagement';
import { ShieldCheck, Lock, Eye, Sparkles } from 'lucide-react';

export default function App() {
  const [authData, setAuthData] = useState<UserAuthData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('boards');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadAuthMe();
  }, []);

  const loadAuthMe = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<UserAuthData>('/api/auth/me');
      setAuthData(data);
    } catch (err) {
      console.error('Failed to load auth data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchPersona = async (persona: {
    userId: string;
    agencyId: string;
    role: 'agency_admin' | 'agency_member' | 'client_user';
    clientId?: string;
  }) => {
    const newHeaders: Record<string, string> = {
      'x-user-id': persona.userId,
      'x-agency-id': persona.agencyId,
      'x-role': persona.role
    };
    if (persona.clientId) {
      newHeaders['x-client-id'] = persona.clientId;
    }

    setPersonaContext(newHeaders);

    // If switching to client_user, default tab to boards or dashboards
    if (persona.role === 'client_user' && (activeTab === 'time' || activeTab === 'team')) {
      setActiveTab('boards');
    }

    try {
      const data = await apiFetch<UserAuthData>('/api/auth/me', { headers: newHeaders });
      setAuthData(data);
    } catch (err) {
      console.error('Error switching persona:', err);
    }
  };

  if (loading && !authData) {
    return (
      <div className="min-h-screen bg-[#F9F8F4] text-[#2C2C2C] flex items-center justify-center font-sans">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#4A5D4E] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-serif font-semibold">Initializing AgencyDesk Multi-Tenant Context...</span>
        </div>
      </div>
    );
  }

  const isClient = authData?.active_context.role === 'client_user';

  return (
    <div className="min-h-screen bg-[#F9F8F4] text-[#2C2C2C] flex flex-col font-sans">
      
      {/* Top Header & Persona Selector */}
      <Navbar
        authData={authData}
        onSwitchPersona={handleSwitchPersona}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Tab Content rendering */}
        {authData && (
          <div>
            {activeTab === 'boards' && <ProjectBoard authData={authData} />}
            {activeTab === 'time' && !isClient && <TimeTracker authData={authData} />}
            {activeTab === 'dashboards' && <ProjectDashboard authData={authData} />}
            {activeTab === 'intake' && <ClientIntake authData={authData} />}
            {activeTab === 'team' && !isClient && <TeamManagement authData={authData} />}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#F2F0E9] border-t border-[#E5E2D9] py-4 text-center text-xs text-[#6B6B5E]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-serif font-bold text-[#2C2C2C]">AgencyDesk — Multi-Tenant Client & Project Management Platform</span>
          <span className="text-[#8C8C7E]">Tested against tenant isolation, client visibility, invite idempotency & member removal</span>
        </div>
      </footer>
    </div>
  );
};
