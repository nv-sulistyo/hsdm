import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { AppSettings, SystemEnvironment, User, ActionTemplate } from '../types.js';
import { Settings, Shield, Plus, Trash2, Check, AlertCircle, Save, FolderCheck, UserCheck, RefreshCw, CheckCircle2, UserCog, Terminal, Edit2, X, Database, Loader2, Server, Eye, EyeOff } from 'lucide-react';

interface SettingsPageProps {
  onAccountUpdated: (user: User, token: string) => void;
}

type SettingsTab = 'server' | 'account' | 'templates' | 'data';

const SETTINGS_TABS: SettingsTab[] = ['server', 'account', 'templates', 'data'];

function getSettingsTabFromHash(): SettingsTab {
  const seg = window.location.hash.replace(/^#\/?/, '').split('/')[1] as SettingsTab;
  return SETTINGS_TABS.includes(seg) ? seg : 'server';
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onAccountUpdated }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [systemEnv, setSystemEnv] = useState<SystemEnvironment | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>(getSettingsTabFromHash);

  // Execution user state
  const [executionUser, setExecutionUser] = useState('nova');

  // Allowed roots state
  const [allowedRoots, setAllowedRoots] = useState<string[]>([]);
  const [newRootInput, setNewRootInput] = useState('');

  // System paths state
  const [gitExecutable, setGitExecutable] = useState('git');
  const [sshKeyPath, setSshKeyPath] = useState('~/.ssh/id_ed25519');
  const [knownHostsPath, setKnownHostsPath] = useState('~/.ssh/known_hosts');

  // VPS stack state
  const [deployRoot, setDeployRoot] = useState('/opt/hsdm/projects');
  const [proxyNetwork, setProxyNetwork] = useState('proxy');
  const [infrastructureDir, setInfrastructureDir] = useState('/opt/hsdm/infrastructure');

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [testingEnv, setTestingEnv] = useState(false);

  const [settingsMsg, setSettingsMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Action templates state
  const [templates, setTemplates] = useState<ActionTemplate[]>([]);
  const [templateMsg, setTemplateMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ActionTemplate | null>(null);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateStack, setTemplateStack] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateCommands, setTemplateCommands] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Data & Logs state
  const [clearingData, setClearingData] = useState<string | null>(null);
  const [dataMsg, setDataMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleClearData = async (key: 'deployments' | 'webhooks' | 'audit' | 'actions' | 'all') => {
    const labels: Record<string, string> = {
      deployments: 'deployment history',
      webhooks: 'webhook events',
      audit: 'audit logs',
      actions: 'action run history',
      all: 'ALL logs & history'
    };
    if (!window.confirm(`Clear ${labels[key]}? This cannot be undone.`)) return;
    setClearingData(key);
    setDataMsg(null);
    try {
      let msg = '';
      if (key === 'deployments' || key === 'all') {
        const r = await api.clearDeployments();
        msg += `Deployments: ${r.deleted}. `;
      }
      if (key === 'webhooks' || key === 'all') {
        const r = await api.clearWebhookEvents();
        msg += `Webhook events: ${r.deleted}. `;
      }
      if (key === 'audit' || key === 'all') {
        const r = await api.clearAuditLogs();
        msg += `Audit logs: ${r.deleted}. `;
      }
      if (key === 'actions' || key === 'all') {
        const r = await api.clearActionRuns();
        msg += `Action runs: ${r.deleted}.`;
      }
      setDataMsg({ text: `Cleared — ${msg}`, type: 'success' });
    } catch (err: any) {
      setDataMsg({ text: err.message || 'Failed to clear data', type: 'error' });
    } finally {
      setClearingData(null);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [data, envData, me] = await Promise.all([
        api.getSettings(),
        api.detectEnvironment().catch(() => null),
        api.getMe().catch(() => null)
      ]);
      setSettings(data);
      if (envData) setSystemEnv(envData);
      if (me) setNewUsername(me.user.username);
      setExecutionUser(data.execution_user || 'nova');
      setAllowedRoots(data.allowed_deploy_roots || ['/www/wwwroot']);
      setGitExecutable(data.git_executable || 'git');
      setSshKeyPath(data.ssh_key_path || '~/.ssh/id_ed25519');
      setKnownHostsPath(data.known_hosts_path || '~/.ssh/known_hosts');
      setDeployRoot(data.deploy_root || '/opt/hsdm/projects');
      setProxyNetwork(data.proxy_network || 'proxy');
      setInfrastructureDir(data.infrastructure_dir || '/opt/hsdm/infrastructure');
    } catch (err: any) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    api.getActionTemplates()
      .then(setTemplates)
      .catch(err => console.error('Failed to load action templates:', err));
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const top = window.location.hash.replace(/^#\/?/, '').split('/')[0];
      if (top === 'settings') setActiveTab(getSettingsTabFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const selectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    const target = `#settings/${tab}`;
    if (window.location.hash === target) return;
    window.location.hash = target;
  };

  const fetchTemplates = async () => {
    const t = await api.getActionTemplates();
    setTemplates(t);
    return t;
  };

  const openTemplateForm = (t?: ActionTemplate) => {
    setEditingTemplate(t || null);
    setTemplateName(t?.name || '');
    setTemplateStack(t?.tech_stack || '');
    setTemplateDesc(t?.description || '');
    setTemplateCommands(t?.commands.join('\n') || '');
    setTemplateMsg(null);
    setTemplateFormOpen(true);
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    setTemplateMsg(null);
    try {
      const commands = templateCommands.split('\n').map(c => c.trim()).filter(Boolean);
      const payload = { name: templateName.trim(), tech_stack: templateStack.trim() || 'General', description: templateDesc.trim(), commands };
      if (editingTemplate) {
        await api.updateActionTemplate(editingTemplate.id, payload);
        setTemplateMsg({ text: `Template '${templateName}' updated.`, type: 'success' });
      } else {
        await api.createActionTemplate(payload);
        setTemplateMsg({ text: `Template '${templateName}' created.`, type: 'success' });
      }
      await fetchTemplates();
      setEditingTemplate(null);
      setTemplateFormOpen(false);
    } catch (err: any) {
      setTemplateMsg({ text: err.message || 'Failed to save template', type: 'error' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (t: ActionTemplate) => {
    const hint = t.is_builtin ? ' This is a built-in recommendation — the app will recreate it after a fresh start.' : '';
    if (!window.confirm(`Delete template '${t.name}'?${hint}`)) return;
    setTemplateMsg(null);
    try {
      await api.deleteActionTemplate(t.id);
      await fetchTemplates();
      setTemplateMsg({ text: `Template '${t.name}' deleted.`, type: 'success' });
    } catch (err: any) {
      setTemplateMsg({ text: err.message || 'Failed to delete template', type: 'error' });
    }
  };

  const handleScanEnvironment = async () => {
    setTestingEnv(true);
    try {
      const envData = await api.detectEnvironment();
      setSystemEnv(envData);
    } catch (err) {
      console.error('Environment test failed:', err);
    } finally {
      setTestingEnv(false);
    }
  };

  const handleAddRoot = () => {
    if (!newRootInput.trim()) return;
    const clean = newRootInput.trim().replace(/\/+$/, '');

    // Prevent dangerous roots
    const forbiddenExact = ['/', '/root', '/etc', '/home', '/var', '/usr', '/opt'];
    if (forbiddenExact.includes(clean)) {
      setSettingsMsg({ text: `'${clean}' cannot be added as an allowed deploy root due to system security policy.`, type: 'error' });
      return;
    }

    if (!allowedRoots.includes(clean)) {
      setAllowedRoots([...allowedRoots, clean]);
      setNewRootInput('');
      setSettingsMsg(null);
    }
  };

  const handleRemoveRoot = (index: number) => {
    if (allowedRoots.length <= 1) {
      setSettingsMsg({ text: 'At least one Allowed Deploy Root must remain configured.', type: 'error' });
      return;
    }
    const next = allowedRoots.filter((_, i) => i !== index);
    setAllowedRoots(next);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const updated = await api.updateSettings({
        allowed_deploy_roots: allowedRoots,
        execution_user: executionUser,
        git_executable: gitExecutable,
        ssh_key_path: sshKeyPath,
        known_hosts_path: knownHostsPath,
        deploy_root: deployRoot,
        proxy_network: proxyNetwork,
        infrastructure_dir: infrastructureDir
      });
      setSettings(updated);
      setSettingsMsg({ text: 'Settings saved successfully.', type: 'success' });
      handleScanEnvironment();
    } catch (err: any) {
      setSettingsMsg({ text: err.message || 'Failed to save settings.', type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setPasswordMsg({ text: 'Username cannot be empty.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New password and confirmation do not match.', type: 'error' });
      return;
    }

    setChangingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await api.updateAccount(
        currentPassword,
        newUsername.trim() || undefined,
        newPassword || undefined
      );
      localStorage.setItem('auth_token', res.token);
      onAccountUpdated(res.user, res.token);
      setPasswordMsg({ text: 'Account updated successfully.', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ text: err.message || 'Failed to update account.', type: 'error' });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">System Settings</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">Execution user, Allowed Deploy Roots, and server security boundaries</p>
        </div>
        <button
          onClick={handleScanEnvironment}
          disabled={testingEnv}
          className="px-3.5 py-2 rounded-2xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#82937E] ${testingEnv ? 'animate-spin' : ''}`} /> Run Diagnostics
        </button>
      </div>

      {settingsMsg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
            settingsMsg.type === 'success'
              ? 'bg-[#82937E]/15 border-[#82937E]/30 text-[#3D4F38]'
              : 'bg-[#C86D51]/15 border-[#C86D51]/30 text-[#9E391C]'
          }`}
        >
          <span>{settingsMsg.text}</span>
          <button onClick={() => setSettingsMsg(null)} className="text-[#8C857E] hover:text-[#2C2C2C]">
            ×
          </button>
        </div>
      )}

      {/* Settings Section Navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'server' as SettingsTab, label: 'Server & Paths', icon: Server },
          { id: 'account' as SettingsTab, label: 'Account', icon: UserCog },
          { id: 'templates' as SettingsTab, label: 'Action Templates', icon: Terminal },
          { id: 'data' as SettingsTab, label: 'Data & Logs', icon: Database }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === tab.id
                ? 'bg-[#4A5D45] text-white shadow-sm'
                : 'bg-white text-[#6E6760] hover:bg-[#F3EFEA] border border-[#E5E0D8]'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'server' && (
      <>
      {/* Execution User Configuration Box */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#4A5D45]" />
          <div>
            <h3 className="text-sm font-serif font-bold text-[#4A5D45]">System Execution User</h3>
            <p className="text-xs text-[#8C857E]">All Git operations and deployment hooks will execute under this Linux user environment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Execution Username</label>
            <input
              type="text"
              value={executionUser}
              onChange={(e) => setExecutionUser(e.target.value)}
              placeholder="nova"
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] font-mono font-bold focus:outline-none focus:border-[#4A5D45]"
            />
            <span className="text-[11px] text-[#8C857E] mt-1 block">Default user is 'nova' (standard aaPanel user).</span>
          </div>

          <div>
            <label className="block text-[#8C857E] font-semibold mb-1">Detected Home Directory</label>
            <div className="px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#3D4F38] font-mono font-bold">
              {systemEnv?.executionUserHome || settings?.execution_home_dir || `/home/${executionUser}`}
            </div>
            <span className="text-[11px] text-[#8C857E] mt-1 block">SSH key paths (~/.ssh) resolve relative to this directory.</span>
          </div>
        </div>
      </div>

      {/* Allowed Deploy Roots Box */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <FolderCheck className="w-5 h-5 text-[#82937E]" />
          <div>
            <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Allowed Deploy Roots</h3>
            <p className="text-xs text-[#8C857E]">Strict path boundaries where Git repositories are allowed to be cloned/pulled</p>
          </div>
        </div>

        <div className="space-y-2">
          {allowedRoots.map((root, idx) => {
            const rootPerm = systemEnv?.rootPermissions.find(r => r.path === root);
            return (
              <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] font-mono text-xs text-[#3D4F38]">
                <div className="flex items-center gap-2">
                  <span>{root}</span>
                  {rootPerm && (
                    <span className={`text-[10px] font-sans px-2 py-0.5 rounded-md font-bold ${rootPerm.writable ? 'bg-[#82937E]/20 text-[#3D4F38]' : 'bg-[#C86D51]/15 text-[#9E391C]'}`}>
                      {rootPerm.writable ? 'Writable by ' + executionUser : 'Permission Issue'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveRoot(idx)}
                  className="p-1.5 rounded-xl text-[#8C857E] hover:text-[#C86D51] hover:bg-[#C86D51]/10 transition"
                  title="Remove root"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="/www/wwwroot"
            value={newRootInput}
            onChange={(e) => setNewRootInput(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] font-mono text-xs text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
          />
          <button
            onClick={handleAddRoot}
            className="px-4 py-2 rounded-xl bg-white hover:bg-[#F3EFEA] text-xs font-semibold text-[#4A5D45] border border-[#E5E0D8] transition flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-[#82937E]" /> Add Root
          </button>
        </div>
      </div>

      {/* VPS Stack Box */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-[#82937E]" />
          <div>
            <h3 className="text-sm font-serif font-bold text-[#4A5D45]">VPS Stack</h3>
            <p className="text-xs text-[#8C857E]">Deploy root for Docker projects and the shared proxy network used by Caddy/nginx</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Deploy Root</label>
            <input
              type="text"
              value={deployRoot}
              onChange={(e) => setDeployRoot(e.target.value)}
              placeholder="/opt/hsdm/projects"
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] font-mono focus:outline-none focus:border-[#4A5D45]"
            />
            <span className="text-[11px] text-[#8C857E] mt-1 block">Where Docker projects are created (one folder per repo).</span>
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Proxy Network</label>
            <input
              type="text"
              value={proxyNetwork}
              onChange={(e) => setProxyNetwork(e.target.value)}
              placeholder="proxy"
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] font-mono focus:outline-none focus:border-[#4A5D45]"
            />
            <span className="text-[11px] text-[#8C857E] mt-1 block">Shared Docker network for web-facing services behind the proxy.</span>
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Infrastructure Dir</label>
            <input
              type="text"
              value={infrastructureDir}
              onChange={(e) => setInfrastructureDir(e.target.value)}
              placeholder="/opt/hsdm/infrastructure"
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] font-mono focus:outline-none focus:border-[#4A5D45]"
            />
            <span className="text-[11px] text-[#8C857E] mt-1 block">Where infra compose (Caddy, Portainer, Netdata) lives.</span>
          </div>
        </div>
      </div>

      {/* System Paths Box */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <h3 className="text-sm font-serif font-bold text-[#4A5D45]">System Binary & SSH Paths</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Git Executable</label>
            <input
              type="text"
              value={gitExecutable}
              onChange={(e) => setGitExecutable(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] font-mono focus:outline-none focus:border-[#4A5D45]"
            />
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">SSH Key Path</label>
            <input
              type="text"
              value={sshKeyPath}
              onChange={(e) => setSshKeyPath(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] font-mono focus:outline-none focus:border-[#4A5D45]"
            />
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Known Hosts Path</label>
            <input
              type="text"
              value={knownHostsPath}
              onChange={(e) => setKnownHostsPath(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] font-mono focus:outline-none focus:border-[#4A5D45]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#4A5D45] hover:bg-[#3D4F38] text-white transition shadow-sm flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
      </>
      )}

      {activeTab === 'account' && (
      <>
      {/* Account Settings */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-[#B87333]" />
          <div>
            <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Account Settings</h3>
            <p className="text-xs text-[#8C857E]">Change the administrator username and password</p>
          </div>
        </div>

        {passwordMsg && (
          <div
            className={`p-3 rounded-2xl border text-xs ${
              passwordMsg.type === 'success'
                ? 'bg-[#82937E]/15 border-[#82937E]/30 text-[#3D4F38]'
                : 'bg-[#C86D51]/15 border-[#C86D51]/30 text-[#9E391C]'
            }`}
          >
            {passwordMsg.text}
          </div>
        )}

        <form onSubmit={handleUpdateAccount} className="space-y-3 max-w-md text-xs">
          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Username</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_.-]+"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
            />
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 pr-10 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-[#8C857E] hover:text-[#4A5D45] focus:outline-none"
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave empty to keep the current password"
                className="w-full px-3.5 py-2 pr-10 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-[#8C857E] hover:text-[#4A5D45] focus:outline-none"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Leave empty to keep the current password"
                className="w-full px-3.5 py-2 pr-10 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-[#8C857E] hover:text-[#4A5D45] focus:outline-none"
                aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#D4A373] hover:bg-[#B87333] text-white transition shadow-sm"
          >
            {changingPassword ? 'Updating...' : 'Update Account'}
          </button>
        </form>
      </div>
      </>
      )}

      {activeTab === 'templates' && (
      <>
      {/* Action Templates */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[#B87333]" />
            <div>
              <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Action Templates</h3>
              <p className="text-xs text-[#8C857E]">
                Predefined command sets for running actions in Repository Manager (npm, composer, pip, etc.)
              </p>
            </div>
          </div>
          <button
            onClick={() => openTemplateForm()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#4A5D45] hover:bg-[#3D4F38] text-white transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Template
          </button>
        </div>

        {templateMsg && (
          <div
            className={`p-3 rounded-2xl border text-xs ${
              templateMsg.type === 'success'
                ? 'bg-[#82937E]/15 border-[#82937E]/30 text-[#3D4F38]'
                : 'bg-[#C86D51]/15 border-[#C86D51]/30 text-[#9E391C]'
            }`}
          >
            {templateMsg.text}
          </div>
        )}

        {templateFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-lg bg-white border border-[#E5E0D8] rounded-[28px] p-6 text-[#2C2C2C] space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-[#4A5D45]">
                  {editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'New Template'}
                </h4>
                <button
                  onClick={() => setTemplateFormOpen(false)}
                  className="p-1 rounded-lg text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[#4A5D45] font-semibold mb-1">Name</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g. Node.js — Build"
                    className="w-full px-3.5 py-2 bg-white border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                  />
                </div>
                <div>
                  <label className="block text-[#4A5D45] font-semibold mb-1">Tech Stack</label>
                  <input
                    type="text"
                    value={templateStack}
                    onChange={e => setTemplateStack(e.target.value)}
                    placeholder="e.g. Node.js / npm"
                    className="w-full px-3.5 py-2 bg-white border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                  />
                </div>
              </div>
              <div className="text-xs">
                <label className="block text-[#4A5D45] font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={templateDesc}
                  onChange={e => setTemplateDesc(e.target.value)}
                  placeholder="Short description (optional)"
                  className="w-full px-3.5 py-2 bg-white border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                />
              </div>
              <div className="text-xs">
                <label className="block text-[#4A5D45] font-semibold mb-1">Commands (one per line)</label>
                <textarea
                  value={templateCommands}
                  onChange={e => setTemplateCommands(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder={'npm install\nnpm run build'}
                  className="w-full px-3.5 py-2 bg-white border border-[#E5E0D8] rounded-xl text-[#2C2C2C] font-mono focus:outline-none focus:border-[#4A5D45] resize-y"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#4A5D45] hover:bg-[#3D4F38] text-white disabled:opacity-50 transition shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {templates.map(t => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#F3EFEA]/70 border border-[#E5E0D8]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#2C2C2C] truncate">{t.name}</span>
                  <span className="px-1.5 py-0.5 rounded-lg bg-[#82937E]/15 text-[#3D4F38] text-[10px] font-semibold shrink-0">
                    {t.tech_stack}
                  </span>
                  {t.is_builtin && (
                    <span className="px-1.5 py-0.5 rounded-lg bg-[#D4A373]/20 text-[#8C5828] text-[10px] font-semibold shrink-0">
                      BUILT-IN
                    </span>
                  )}
                </div>
                {t.description && <p className="text-[11px] text-[#8C857E] mt-0.5 truncate">{t.description}</p>}
                <p className="text-[11px] font-mono text-[#6E6760] mt-0.5 truncate">$ {t.commands.join(' && ')}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => openTemplateForm(t)}
                  className="p-2 rounded-xl bg-white hover:bg-[#EAE4DC] text-[#6E6760] hover:text-[#4A5D45] border border-[#E5E0D8] transition"
                  title="Edit Template"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteTemplate(t)}
                  className="p-2 rounded-xl bg-white hover:bg-[#C86D51]/15 text-[#6E6760] hover:text-[#C86D51] border border-[#E5E0D8] transition"
                  title="Delete Template"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-xs text-[#8C857E] text-center py-4">No templates yet. Click "Add Template" to create one.</p>
          )}
        </div>
      </div>
      </>
      )}

      {activeTab === 'data' && (
      <>
      {/* Data & Logs */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[#B87333]" />
          <div>
            <h3 className="text-sm font-serif font-bold text-[#4A5D45]">Data & Logs</h3>
            <p className="text-xs text-[#8C857E]">Clear application history records (deployments, webhook events, audit logs, action runs)</p>
          </div>
        </div>

        {dataMsg && (
          <div
            className={`p-3 rounded-2xl border text-xs ${
              dataMsg.type === 'success'
                ? 'bg-[#82937E]/15 border-[#82937E]/30 text-[#3D4F38]'
                : 'bg-[#C86D51]/15 border-[#C86D51]/30 text-[#9E391C]'
            }`}
          >
            {dataMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { key: 'deployments', label: 'Deployment History' },
            { key: 'webhooks', label: 'Webhook Events' },
            { key: 'audit', label: 'Audit Logs' },
            { key: 'actions', label: 'Action Run History' }
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => handleClearData(btn.key as any)}
              disabled={clearingData !== null}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6E6760] bg-[#F3EFEA] hover:bg-[#C86D51]/15 hover:text-[#9E391C] border border-[#E5E0D8] transition disabled:opacity-50"
            >
              <span>{btn.label}</span>
              {clearingData === btn.key ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C86D51]" /> : <Trash2 className="w-3.5 h-3.5 text-[#C86D51]" />}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#E5E0D8]">
          <p className="text-xs text-[#8C857E]">Hapus semua riwayat sekaligus — data repo & pengaturan tidak terpengaruh.</p>
          <button
            onClick={() => handleClearData('all')}
            disabled={clearingData !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#C86D51] hover:bg-[#9E391C] transition disabled:opacity-50 shadow-sm"
          >
            {clearingData === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear All Data
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

