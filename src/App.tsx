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
import { RefreshCw, Terminal } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

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

  const handleLoginSuccess = (loggedInUser: User, newToken: string) => {
    setUser(loggedInUser);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#F9F6F2] flex flex-col items-center justify-center p-4 text-[#2C2C2C]">
        <div className="w-12 h-12 rounded-full bg-[#82937E] flex items-center justify-center text-white font-serif text-xl shadow-md mb-4 animate-pulse">
          T
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-[#4A5D45]">
          <RefreshCw className="w-4 h-4 animate-spin text-[#82937E]" />
          <span>Initializing Terra Server Environment...</span>
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
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        {activeTab === 'dashboard' && (
          <DashboardPage
            onNavigateToRepo={() => setActiveTab('repositories')}
            onNavigateToSsh={() => setActiveTab('git-ssh')}
          />
        )}
        {activeTab === 'repositories' && <RepositoriesPage />}
        {activeTab === 'deployments' && <DeploymentsPage />}
        {activeTab === 'webhooks' && <WebhooksPage />}
        {activeTab === 'git-ssh' && <GitSshPage />}
        {activeTab === 'settings' && <SettingsPage onAccountUpdated={handleLoginSuccess} />}
        {activeTab === 'audit-logs' && <AuditLogsPage />}
        {activeTab === 'guide' && <GuidePage />}
      </main>
    </div>
  );
}

