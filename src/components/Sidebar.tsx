import React from 'react';
import {
  LayoutDashboard,
  GitPullRequest,
  History,
  Webhook,
  Key,
  Settings,
  ShieldCheck,
  LogOut,
  Terminal,
  FolderGit2,
  BookOpen,
  Container,
  Activity,
  Server,
  Globe,
  Package
} from 'lucide-react';
import { User } from '../types.js';
import { Logo } from './Logo.js';

export type NavTab =
  | 'dashboard'
  | 'repositories'
  | 'deployments'
  | 'webhooks'
  | 'git-ssh'
  | 'settings'
  | 'audit-logs'
  | 'guide'
  | 'docker'
  | 'monitoring'
  | 'services'
  | 'webserver'
  | 'installer';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: User | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'repositories', label: 'Repositories', icon: FolderGit2 },
    { id: 'deployments', label: 'Deployments', icon: History },
    { id: 'docker', label: 'Docker', icon: Container },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
    { id: 'services', label: 'System Services', icon: Server },
    { id: 'webserver', label: 'Web Server', icon: Globe },
    { id: 'installer', label: 'Installer', icon: Package },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'git-ssh', label: 'Git / SSH', icon: Key },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'audit-logs', label: 'Audit Log', icon: ShieldCheck },
    { id: 'guide', label: 'Panduan Tool', icon: BookOpen }
  ];

  return (
    <aside className="w-64 bg-[#F3EFEA] border-r border-[#E5E0D8] flex flex-col justify-between shrink-0 select-none shadow-sm">
      <div>
        {/* Logo / Header */}
        <div className="p-5 border-b border-[#E5E0D8] flex items-center gap-3">
          <Logo size={38} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-[#2C2C2C] tracking-tight leading-snug">
              HSDM
            </h1>
            <p className="text-[10px] font-medium text-[#4A5D45] truncate">Home Server Deploy Manager</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as NavTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-[#4A5D45] text-white shadow-md shadow-[#4A5D45]/20'
                    : 'text-[#6E6760] hover:text-[#4A5D45] hover:bg-[#EAE4DC]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#82937E]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-[#E5E0D8] bg-[#EAE4DC]/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-[#D4A373] border-2 border-white flex items-center justify-center text-xs font-serif font-bold text-white shadow-sm shrink-0">
            {user?.username ? user.username.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="truncate text-xs">
            <span className="font-semibold text-[#2C2C2C] block truncate">{user?.username || 'admin'}</span>
            <span className="text-[10px] text-[#8C857E] uppercase tracking-wider block font-medium">{user?.role || 'admin'}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Log out"
          className="p-2 rounded-xl text-[#8C857E] hover:text-[#C86D51] hover:bg-[#C86D51]/10 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
