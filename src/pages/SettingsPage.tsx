import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { AppSettings, SystemEnvironment, User } from '../types.js';
import { Settings, Shield, Plus, Trash2, Check, AlertCircle, Save, FolderCheck, UserCheck, RefreshCw, CheckCircle2, UserCog } from 'lucide-react';

interface SettingsPageProps {
  onAccountUpdated: (user: User, token: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onAccountUpdated }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [systemEnv, setSystemEnv] = useState<SystemEnvironment | null>(null);
  const [loading, setLoading] = useState(true);

  // Execution user state
  const [executionUser, setExecutionUser] = useState('nova');

  // Allowed roots state
  const [allowedRoots, setAllowedRoots] = useState<string[]>([]);
  const [newRootInput, setNewRootInput] = useState('');

  // System paths state
  const [gitExecutable, setGitExecutable] = useState('git');
  const [sshKeyPath, setSshKeyPath] = useState('~/.ssh/id_ed25519');
  const [knownHostsPath, setKnownHostsPath] = useState('~/.ssh/known_hosts');

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [savingSettings, setSavingSettings] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [testingEnv, setTestingEnv] = useState(false);

  const [settingsMsg, setSettingsMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
    } catch (err: any) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

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
        known_hosts_path: knownHostsPath
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
          <h2 className="text-2xl font-serif italic text-[#4A5D45] tracking-tight">System Settings</h2>
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

      {/* Execution User Configuration Box */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#4A5D45]" />
          <div>
            <h3 className="text-sm font-serif italic font-bold text-[#4A5D45]">System Execution User</h3>
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
            <h3 className="text-sm font-serif italic font-bold text-[#4A5D45]">Allowed Deploy Roots</h3>
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

      {/* System Paths Box */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <h3 className="text-sm font-serif italic font-bold text-[#4A5D45]">System Binary & SSH Paths</h3>

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

      {/* Account Settings */}
      <div className="p-5 rounded-[28px] bg-white border border-[#E5E0D8] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-[#B87333]" />
          <div>
            <h3 className="text-sm font-serif italic font-bold text-[#4A5D45]">Account Settings</h3>
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
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
            />
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">New Password</label>
            <input
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave empty to keep the current password"
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
            />
          </div>

          <div>
            <label className="block text-[#4A5D45] font-semibold mb-1">Confirm New Password</label>
            <input
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Leave empty to keep the current password"
              className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
            />
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
    </div>
  );
};

