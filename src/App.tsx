/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from './services/api.js';
import { User } from './types.js';
import { Sidebar, NavTab } from './components/Sidebar.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { RepositoriesPage } from './pages/RepositoriesPage.js';
import { DeploymentsPage } from './pages/DeploymentsPage.js';
import { WebhooksPage } from './pages/WebhooksPage.js';
import { GitSshPage } from './pages/GitSshPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';
import { GuidePage } from './pages/GuidePage.js';
import { DockerPage } from './pages/DockerPage.js';
import { MonitoringPage } from './pages/MonitoringPage.js';
import { ServicesPage } from './pages/ServicesPage.js';
import { WebServerPage } from './pages/WebServerPage.js';
import { InstallerPage } from './pages/InstallerPage.js';
import { RefreshCw, Terminal } from 'lucide-react';
import { Logo } from './components/Logo.js';

const VALID_TABS: NavTab[] = [
  'dashboard',
  'repositories',
  'deployments',
  'docker',
  'monitoring',
  'services',
  'webserver',
  'installer',
  'webhooks',
  'git-ssh',
  'settings',
  'audit-logs',
  'guide'
];

function getTabFromHash(): NavTab {
  const seg = window.location.hash.replace(/^#\/?/, '').split('/')[0] as NavTab;
  return VALID_TABS.includes(seg) ? seg : 'dashboard';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>(getTabFromHash);

  useEffect(() => {
    const checkAuth = async () => {
      setLoadingUser(true);
      try {
        if (token) {
          const userData = await api.getMe();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn('Auth check failed:', err);
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };

    checkAuth();
  }, [token]);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTab = (tab: NavTab) => {
    setActiveTab(tab);
    const target = tab === 'dashboard' ? '#' : `#${tab}`;
    const current = window.location.hash;
    if (current === target || (tab === 'dashboard' && current === '')) return;
    window.location.hash = target;
  };

  const handleLoginSuccess = (loggedInUser: User, newToken: string) => {
    setUser(loggedInUser);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setActiveTab('dashboard');
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#F9F6F2] flex flex-col items-center justify-center p-4 text-[#2C2C2C]">
        <Logo size={48} className="mb-4 animate-pulse" />
        <div className="flex items-center gap-2 text-sm font-medium text-[#4A5D45]">
          <RefreshCw className="w-4 h-4 animate-spin text-[#82937E]" />
          <span>Loading Home Server Deploy Manager...</span>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-[#F9F6F2] text-[#2C2C2C] overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={navigateTab}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        {activeTab === 'dashboard' && (
          <DashboardPage
            onNavigateToRepo={() => navigateTab('repositories')}
            onNavigateToSsh={() => navigateTab('git-ssh')}
          />
        )}
        {activeTab === 'repositories' && <RepositoriesPage />}
        {activeTab === 'deployments' && <DeploymentsPage />}
        {activeTab === 'docker' && <DockerPage />}
        {activeTab === 'monitoring' && <MonitoringPage />}
        {activeTab === 'services' && <ServicesPage />}
        {activeTab === 'webserver' && <WebServerPage />}
        {activeTab === 'installer' && <InstallerPage />}
        {activeTab === 'webhooks' && <WebhooksPage />}
        {activeTab === 'git-ssh' && <GitSshPage />}
        {activeTab === 'settings' && <SettingsPage onAccountUpdated={handleLoginSuccess} />}
        {activeTab === 'audit-logs' && <AuditLogsPage />}
        {activeTab === 'guide' && <GuidePage />}
      </main>
    </div>
  );
}