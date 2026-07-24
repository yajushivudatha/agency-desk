import React from 'react';
import { UserAuthData } from '../types';
import { Building2, ShieldCheck, UserCheck, Users, Eye, Sparkles } from 'lucide-react';

interface NavbarProps {
  authData: UserAuthData | null;
  onSwitchPersona: (persona: { userId: string; agencyId: string; role: any; clientId?: string }) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const PRESET_PERSONAS = [
  {
    label: 'Alex Rivera',
    sub: 'Apex Admin',
    userId: 'usr_apex_admin',
    agencyId: 'agency_apex',
    role: 'agency_admin',
    badge: 'Tenant 1 Admin',
    badgeColor: 'bg-[#4A5D4E]/15 text-[#4A5D4E]'
  },
  {
    label: 'David Kim',
    sub: 'Apex Staff',
    userId: 'usr_apex_member',
    agencyId: 'agency_apex',
    role: 'agency_member',
    badge: 'Tenant 1 Staff',
    badgeColor: 'bg-[#8A9A8D]/20 text-[#3A4D3E]'
  },
  {
    label: 'John Smith',
    sub: 'Acme Client',
    userId: 'usr_client_acme',
    agencyId: 'agency_apex',
    role: 'client_user',
    clientId: 'client_acme',
    badge: 'Client Guest',
    badgeColor: 'bg-[#A8B5A2]/30 text-[#2C3E30]'
  },
  {
    label: 'Elena Rostova',
    sub: 'Nexus Admin',
    userId: 'usr_nexus_admin',
    agencyId: 'agency_nexus',
    role: 'agency_admin',
    badge: 'Tenant 2 Admin',
    badgeColor: 'bg-[#4A5D4E]/20 text-[#2C2C2C]'
  },
  {
    label: 'Lisa Wong',
    sub: 'Starlight Client',
    userId: 'usr_client_starlight',
    agencyId: 'agency_nexus',
    role: 'client_user',
    clientId: 'client_starlight',
    badge: 'Tenant 2 Client',
    badgeColor: 'bg-[#8A9A8D]/20 text-[#3A4D3E]'
  },
  {
    label: 'Sarah Jenkins',
    sub: 'Dual-Membership',
    userId: 'usr_dual_sarah',
    agencyId: 'agency_apex',
    role: 'agency_admin',
    badge: 'Multi-Tenant',
    badgeColor: 'bg-[#E5E2D9] text-[#2C2C2C]'
  }
];

export const Navbar: React.FC<NavbarProps> = ({
  authData,
  onSwitchPersona,
  activeTab,
  setActiveTab
}) => {
  const currentUserId = authData?.user.id;
  const currentRole = authData?.active_context.role;
  const isClient = currentRole === 'client_user';

  return (
    <header className="bg-[#F2F0E9] border-b border-[#E5E2D9] text-[#2C2C2C] sticky top-0 z-40 shadow-xs">
      {/* Top Banner: Compact Persona Switcher */}
      <div className="bg-[#EAE7DE] border-b border-[#E5E2D9] px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#4A5D4E]" />
            <label htmlFor="persona-select" className="font-semibold text-xs text-[#2C2C2C] shrink-0">
              Demo Role Switcher:
            </label>
            <select
              id="persona-select"
              value={PRESET_PERSONAS.findIndex(
                (p) =>
                  currentUserId === p.userId &&
                  authData?.active_context.agency_id === p.agencyId &&
                  authData?.active_context.role === p.role
              )}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                if (!isNaN(idx) && PRESET_PERSONAS[idx]) {
                  onSwitchPersona(PRESET_PERSONAS[idx]);
                }
              }}
              className="bg-white border border-[#E5E2D9] rounded-md px-2.5 py-1 text-xs font-semibold text-[#2C2C2C] focus:outline-hidden focus:border-[#4A5D4E] cursor-pointer shadow-2xs"
            >
              {PRESET_PERSONAS.map((p, index) => (
                <option key={`${p.userId}_${p.agencyId}_${p.role}`} value={index}>
                  {p.label} — {p.badge} ({p.sub})
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#6B6B5E]">
            <span>Active Role:</span>
            <span className="font-semibold px-2 py-0.5 rounded bg-[#4A5D4E]/10 text-[#4A5D4E] border border-[#4A5D4E]/20">
              {PRESET_PERSONAS.find((p) => p.userId === currentUserId && p.agencyId === authData?.active_context.agency_id)?.label || authData?.user.name} ({authData?.active_context.role?.replace('_', ' ')})
            </span>
          </div>
        </div>
      </div>

      {/* Primary Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Agency Indicator */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-[#4A5D4E] p-2 rounded-lg text-white shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-serif font-bold text-xl tracking-tight text-[#2C2C2C] flex items-center gap-2">
                  AgencyDesk
                  <span className="font-sans text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold bg-[#4A5D4E]/10 text-[#4A5D4E] border border-[#4A5D4E]/20">
                    Multi-Tenant
                  </span>
                </h1>
                <p className="text-xs text-[#6B6B5E]">
                  Active Context: <strong className="text-[#2C2C2C]">{authData?.user.name}</strong> ({authData?.active_context.role})
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 ml-6 bg-[#F9F8F4] p-1 rounded-lg border border-[#E5E2D9]">
              <button
                id="nav-tab-boards"
                onClick={() => setActiveTab('boards')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'boards' ? 'bg-[#4A5D4E] text-white shadow-xs' : 'text-[#6B6B5E] hover:text-[#2C2C2C]'
                }`}
              >
                Projects & Boards
              </button>

              {!isClient && (
                <button
                  id="nav-tab-time"
                  onClick={() => setActiveTab('time')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'time' ? 'bg-[#4A5D4E] text-white shadow-xs' : 'text-[#6B6B5E] hover:text-[#2C2C2C]'
                  }`}
                >
                  Time Tracking
                </button>
              )}

              <button
                id="nav-tab-dashboards"
                onClick={() => setActiveTab('dashboards')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'dashboards' ? 'bg-[#4A5D4E] text-white shadow-xs' : 'text-[#6B6B5E] hover:text-[#2C2C2C]'
                }`}
              >
                Project Dashboard
              </button>

              <button
                id="nav-tab-intake"
                onClick={() => setActiveTab('intake')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'intake' ? 'bg-[#4A5D4E] text-white shadow-xs' : 'text-[#6B6B5E] hover:text-[#2C2C2C]'
                }`}
              >
                Client Intake (Bonus)
              </button>

              {!isClient && (
                <button
                  id="nav-tab-team"
                  onClick={() => setActiveTab('team')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'team' ? 'bg-[#4A5D4E] text-white shadow-xs' : 'text-[#6B6B5E] hover:text-[#2C2C2C]'
                  }`}
                >
                  Team & Isolation Test
                </button>
              )}
            </nav>
          </div>

          {/* User Badge / Role Indicator */}
          <div className="flex items-center gap-3">
            {isClient ? (
              <div className="flex items-center gap-2 bg-[#8A9A8D]/20 text-[#3A4D3E] px-3 py-1.5 rounded-full border border-[#8A9A8D]/30 text-xs font-medium">
                <Eye className="w-3.5 h-3.5 text-[#4A5D4E]" />
                <span>Client Portal Mode (Guest)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#4A5D4E]/10 text-[#4A5D4E] px-3 py-1.5 rounded-full border border-[#4A5D4E]/20 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4A5D4E]" />
                <span className="capitalize">{authData?.active_context.role?.replace('_', ' ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
