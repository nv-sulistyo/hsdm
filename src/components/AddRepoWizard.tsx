import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { AppSettings, Repository, DirectoryInspection, SystemEnvironment } from '../types.js';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Folder,
  GitBranch,
  Terminal,
  Key,
  Globe,
  Settings2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  FolderGit2,
  Info,
  Play
} from 'lucide-react';

interface AddRepoWizardProps {
  onClose: () => void;
  onSuccess: (repo: Repository) => void;
  settings: AppSettings | null;
}

export const AddRepoWizard: React.FC<AddRepoWizardProps> = ({ onClose, onSuccess, settings }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form state
  const [name, setName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [localPath, setLocalPath] = useState('/www/wwwroot/');
  const [executionUser, setExecutionUser] = useState(settings?.execution_user || 'nova');
  const [mode, setMode] = useState<'CLONE' | 'CONNECT'>('CLONE');
  const [gitStrategy, setGitStrategy] = useState<'PULL' | 'FETCH_ONLY' | 'RESET_HARD'>('PULL');
  const [deploymentTrigger, setDeploymentTrigger] = useState<'MANUAL' | 'WEBHOOK' | 'BOTH'>('BOTH');
  const [beforeCommand, setBeforeCommand] = useState('');
  const [postPullCommand, setPostPullCommand] = useState('');
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [description, setDescription] = useState('');

  // Options
  const [cloneNow, setCloneNow] = useState(true);

  // UI / Directory Inspection states
  const [inspectingPath, setInspectingPath] = useState(false);
  const [inspection, setInspection] = useState<DirectoryInspection | null>(null);

  // Connection & System states
  const [loadingEnv, setLoadingEnv] = useState(false);
  const [systemEnv, setSystemEnv] = useState<SystemEnvironment | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    details: string;
  } | null>(null);

  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    // Generate initial random webhook secret
    const randomHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setWebhookSecret(randomHex);
  }, []);

  // Auto infer repo name from git URL if user pastes it
  const handleGitUrlChange = (url: string) => {
    setGitUrl(url);
    if (!url) return;

    // e.g. git@github.com:owner/rekap_transaksi.git or https://github.com/owner/rekap_transaksi.git
    const match = url.match(/\/([^\/]+)\.git$/) || url.match(/:([^\/]+)\/([^\/]+)\.git$/);
    const inferredName = match ? (match[2] || match[1]) : '';
    
    if (inferredName && (!name || name === inferredName.replace(/[^a-zA-Z0-9_-]/g, '_'))) {
      const cleanName = inferredName.replace(/[^a-zA-Z0-9_-]/g, '_');
      setName(cleanName);
      const root = settings?.allowed_deploy_roots?.[0] || '/www/wwwroot';
      setLocalPath(`${root}/${cleanName}`);
    }
  };

  // Inspect directory on Step 2 path change
  useEffect(() => {
    if (step === 2 && localPath.trim().length > 3) {
      const timer = setTimeout(async () => {
        setInspectingPath(true);
        try {
          const res = await api.inspectDirectory(localPath.trim(), gitUrl);
          setInspection(res);
          if (res.isGitRepo) {
            setMode('CONNECT');
          } else {
            setMode('CLONE');
          }
        } catch {
          setInspection(null);
        } finally {
          setInspectingPath(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [step, localPath, gitUrl]);

  // Load environment on Step 3
  useEffect(() => {
    if (step === 3 && !systemEnv) {
      loadSystemEnv();
    }
  }, [step]);

  const loadSystemEnv = async () => {
    setLoadingEnv(true);
    try {
      const env = await api.detectEnvironment();
      setSystemEnv(env);
    } catch (err) {
      console.error('Failed to detect environment:', err);
    } finally {
      setLoadingEnv(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await api.testGithub();
      setConnectionResult(res);
    } catch (err: any) {
      setConnectionResult({
        success: false,
        message: 'Connection test failed',
        details: err.message || 'Unknown error'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setErrorMessage('');
    try {
      // 1. Create Repository in DB
      const newRepo = await api.createRepository({
        name,
        git_url: gitUrl,
        branch,
        local_path: localPath,
        execution_user: executionUser,
        mode,
        git_strategy: gitStrategy,
        deployment_trigger: deploymentTrigger,
        before_command: beforeCommand,
        post_pull_command: postPullCommand,
        auto_deploy: autoDeploy,
        webhook_enabled: webhookEnabled,
        webhook_secret: webhookSecret,
        description
      });

      // 2. Clone if mode is CLONE and cloneNow is checked
      if (mode === 'CLONE' && cloneNow) {
        try {
          await api.cloneRepo(newRepo.id);
        } catch (cloneErr: any) {
          console.warn('Clone warn:', cloneErr);
        }
      }

      onSuccess(newRepo);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create repository');
    } finally {
      setCreating(false);
    }
  };

  const autoSuggestPath = (repoName: string) => {
    const slug = repoName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const root = settings?.allowed_deploy_roots?.[0] || '/www/wwwroot';
    setLocalPath(`${root}/${slug}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-[#E5E0D8] rounded-[28px] shadow-2xl flex flex-col overflow-hidden text-[#2C2C2C]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E0D8] bg-[#F3EFEA]">
          <div>
            <h3 className="text-base font-serif font-bold text-[#4A5D45]">Add New Git Repository</h3>
            <p className="text-xs text-[#8C857E]">Step {step} of 5: {getStepTitle(step)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8C857E] hover:text-[#2C2C2C] hover:bg-[#E5E0D8]/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center px-6 py-3 border-b border-[#E5E0D8] bg-white gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  step === s
                    ? 'bg-[#4A5D45] text-white'
                    : step > s
                    ? 'bg-[#82937E]/20 text-[#3D4F38] border border-[#82937E]/30'
                    : 'bg-[#F3EFEA] text-[#8C857E]'
                }`}
              >
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              <span className={`text-xs hidden sm:inline truncate ${step === s ? 'text-[#4A5D45] font-semibold' : 'text-[#8C857E]'}`}>
                {getStepTitle(s as any)}
              </span>
            </div>
          ))}
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-[#C86D51]/15 border border-[#C86D51]/30 text-xs text-[#9E391C] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Error</span>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">
                  Git Repository URL <span className="text-[#C86D51]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="git@github.com:username/rekap_transaksi.git"
                  value={gitUrl}
                  onChange={(e) => handleGitUrlChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-sm font-mono text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
                />
                <span className="text-[11px] text-[#8C857E] mt-1 block">
                  SSH URL format recommended (e.g. git@github.com:owner/repo.git). Auto-populates repo name.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">
                  Repository Identifier Name <span className="text-[#C86D51]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. rekap_transaksi"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!localPath || localPath === '/www/wwwroot/' || localPath.endsWith('/')) {
                      autoSuggestPath(e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-sm text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
                />
                <span className="text-[11px] text-[#8C857E] mt-1 block">A clean identifier for this repository in the manager interface.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">
                  Target Branch <span className="text-[#C86D51]">*</span>
                </label>
                <div className="relative">
                  <GitBranch className="w-4 h-4 text-[#82937E] absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-sm text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">Description (Optional)</label>
                <textarea
                  placeholder="e.g. Transaction recap web service on aaPanel"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-sm text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45] resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">
                  Server Local Path <span className="text-[#C86D51]">*</span>
                </label>
                <div className="relative">
                  <Folder className="w-4 h-4 text-[#82937E] absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="/www/wwwroot/rekap_transaksi"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-sm font-mono text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
                  />
                  {inspectingPath && (
                    <RefreshCw className="w-4 h-4 text-[#82937E] animate-spin absolute right-3.5 top-2.5" />
                  )}
                </div>
              </div>

              {/* Execution User Info */}
              <div className="p-3 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#4A5D45]" />
                  <span>Execution System User:</span>
                  <span className="font-mono font-bold text-[#4A5D45]">{executionUser}</span>
                </div>
                <span className="text-[11px] text-[#8C857E]">Configured in Settings</span>
              </div>

              {/* Path Inspection Result */}
              {inspection && (
                <div className="space-y-3">
                  {/* Validation Box */}
                  <div
                    className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                      inspection.allowed && inspection.writable
                        ? 'bg-[#82937E]/15 border-[#82937E]/30 text-[#3D4F38]'
                        : 'bg-[#C86D51]/15 border-[#C86D51]/30 text-[#9E391C]'
                    }`}
                  >
                    {inspection.allowed && inspection.writable ? (
                      <CheckCircle2 className="w-4 h-4 text-[#4A5D45] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold block">
                        {!inspection.allowed
                          ? 'Security Restriction'
                          : inspection.writable
                          ? 'Path Access & Permission OK'
                          : 'Permission Warning'}
                      </span>
                      <p className="mt-0.5">
                        {inspection.pathError || inspection.accessError || `Directory is allowed inside deploy root.`}
                      </p>
                    </div>
                  </div>

                  {/* Registered Warning */}
                  {inspection.alreadyRegistered && (
                    <div className="p-3 rounded-xl bg-[#D4A373]/20 border border-[#D4A373]/40 text-xs text-[#8C5828] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        This directory is already registered under repository name <strong>'{inspection.registeredRepoName}'</strong>.
                      </span>
                    </div>
                  )}

                  {/* Mode Selector (CLONE vs CONNECT) */}
                  <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-3 text-xs">
                    <span className="font-serif font-bold text-[#4A5D45] block">Repository Registration Mode</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMode('CLONE')}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          mode === 'CLONE'
                            ? 'bg-white border-[#4A5D45] shadow-xs'
                            : 'bg-transparent border-[#E5E0D8] hover:bg-white/50 text-[#8C857E]'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                          <FolderGit2 className="w-4 h-4 text-[#4A5D45]" />
                          <span>CLONE Fresh</span>
                        </div>
                        <p className="text-[11px] text-[#6E6760] mt-1">
                          Clone new repository into an empty or newly created directory.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode('CONNECT')}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          mode === 'CONNECT'
                            ? 'bg-white border-[#4A5D45] shadow-xs'
                            : 'bg-transparent border-[#E5E0D8] hover:bg-white/50 text-[#8C857E]'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-[#4A5D45]">
                          <Folder className="w-4 h-4 text-[#82937E]" />
                          <span>CONNECT Existing</span>
                        </div>
                        <p className="text-[11px] text-[#6E6760] mt-1">
                          Connect an existing aaPanel website directory already cloned or present on disk.
                        </p>
                      </button>
                    </div>

                    {inspection.isGitRepo && (
                      <div className="p-3 rounded-xl bg-white border border-[#E5E0D8] text-[11px] text-[#2C2C2C] space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-[#4A5D45]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#4A5D45]" />
                          <span>Existing Git Repository Detected on Disk</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-1 pt-1 border-t border-[#E5E0D8] text-[#6E6760]">
                          <div>Branch: <strong className="text-[#2C2C2C] font-mono">{inspection.currentBranch}</strong></div>
                          <div>Remote Match: <strong className={inspection.remoteMatches ? 'text-[#3D4F38]' : 'text-[#8C5828]'}>{inspection.remoteMatches ? 'MATCHES' : 'DIFFERENT'}</strong></div>
                          <div className="col-span-2 truncate">Origin: <code className="font-mono text-[10px]">{inspection.remoteOrigin || 'None'}</code></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-serif font-bold text-[#4A5D45]">System & SSH Diagnostics</h4>
                    <p className="text-[#8C857E] text-[11px]">Comprehensive check for user '{executionUser}' and GitHub keys.</p>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-xs text-white bg-[#4A5D45] hover:bg-[#3D4F38] disabled:opacity-50 transition shadow-sm"
                  >
                    {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {testingConnection ? 'Testing SSH...' : 'Test Connection'}
                  </button>
                </div>

                {/* Diagnostics List */}
                {systemEnv ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E5E0D8]">
                      <span className="text-[#6E6760]">Git CLI Version:</span>
                      <span className="font-mono font-semibold text-[#4A5D45]">{systemEnv.gitVersion}</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E5E0D8]">
                      <span className="text-[#6E6760]">Execution User & Home:</span>
                      <span className="font-mono font-semibold text-[#2C2C2C]">{systemEnv.executionUser} ({systemEnv.executionUserHome})</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E5E0D8]">
                      <span className="text-[#6E6760]">SSH Private Key Path:</span>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        {systemEnv.privateKeyExists ? (
                          <span className="text-[#3D4F38] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Found ({systemEnv.keyPath})
                          </span>
                        ) : (
                          <span className="text-[#C86D51] font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Missing ({systemEnv.keyPath})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-[#8C857E]">Loading system environment...</div>
                )}

                {connectionResult && (
                  <div
                    className={`p-3.5 rounded-xl border ${
                      connectionResult.success
                        ? 'bg-[#82937E]/20 border-[#82937E]/30 text-[#3D4F38]'
                        : 'bg-[#D4A373]/20 border-[#D4A373]/40 text-[#8C5828]'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {connectionResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4A5D45]" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-[#B87333]" />
                      )}
                      <span>{connectionResult.message}</span>
                    </div>
                    <pre className="mt-2 p-2.5 rounded-lg bg-white border border-[#E5E0D8] font-mono text-[11px] text-[#2C2C2C] whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {connectionResult.details}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Deployment Trigger */}
              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">Deployment Trigger</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'BOTH', label: 'Webhook + Manual' },
                    { id: 'WEBHOOK', label: 'Webhook Only' },
                    { id: 'MANUAL', label: 'Manual Only' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDeploymentTrigger(t.id as any)}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                        deploymentTrigger === t.id
                          ? 'bg-[#4A5D45] text-white border-[#4A5D45]'
                          : 'bg-[#F3EFEA] text-[#6E6760] border-[#E5E0D8] hover:bg-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Git Sync Strategy */}
              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">Git Sync Strategy</label>
                <select
                  value={gitStrategy}
                  onChange={(e) => setGitStrategy(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs font-semibold text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                >
                  <option value="PULL">Standard Git Pull (Merge remote changes)</option>
                  <option value="RESET_HARD">Fetch & Hard Reset (--hard origin/branch - Discard local edits)</option>
                  <option value="FETCH_ONLY">Fetch Only (Do not merge working tree)</option>
                </select>
              </div>

              {/* Webhook Secret */}
              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">Webhook Secret</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs font-mono text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookSecret);
                      setCopiedSecret(true);
                      setTimeout(() => setCopiedSecret(false), 2000);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3EFEA] border border-[#E5E0D8] text-xs font-semibold text-[#4A5D45] transition flex items-center gap-1 shadow-2xs"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-[#4A5D45]" /> : <Copy className="w-3.5 h-3.5 text-[#82937E]" />}
                    {copiedSecret ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Before Pull Command */}
              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">
                  Optional Before-Pull Command <span className="text-[#8C857E] font-normal">(Executes before git pull)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. php artisan down || true"
                  value={beforeCommand}
                  onChange={(e) => setBeforeCommand(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs font-mono text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
                />
              </div>

              {/* Post Pull Command */}
              <div>
                <label className="block text-xs font-semibold text-[#4A5D45] mb-1">
                  Optional Post-Pull Command <span className="text-[#8C857E] font-normal">(Executes after git pull)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. npm ci && npm run build"
                  value={postPullCommand}
                  onChange={(e) => setPostPullCommand(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs font-mono text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
                />
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] space-y-3 text-xs">
                <h4 className="font-serif font-bold text-[#4A5D45] text-sm border-b border-[#E5E0D8] pb-2">Review Configuration</h4>

                <div className="grid grid-cols-2 gap-3 text-[#2C2C2C]">
                  <div>
                    <span className="text-[#8C857E] block">Name:</span>
                    <span className="font-semibold text-[#4A5D45]">{name}</span>
                  </div>
                  <div>
                    <span className="text-[#8C857E] block">Mode:</span>
                    <span className="font-mono font-bold text-[#8C5828]">{mode}</span>
                  </div>
                  <div>
                    <span className="text-[#8C857E] block">Branch:</span>
                    <span className="font-mono font-semibold text-[#8C5828]">{branch}</span>
                  </div>
                  <div>
                    <span className="text-[#8C857E] block">Execution User:</span>
                    <span className="font-mono text-[#4A5D45] font-bold">{executionUser}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#8C857E] block">Git URL:</span>
                    <code className="font-mono text-[#2C2C2C] break-all">{gitUrl}</code>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#8C857E] block">Local Path:</span>
                    <code className="font-mono text-[#3D4F38] font-semibold break-all">{localPath}</code>
                  </div>
                  <div>
                    <span className="text-[#8C857E] block">Strategy:</span>
                    <span className="font-semibold text-[#2C2C2C]">{gitStrategy}</span>
                  </div>
                  <div>
                    <span className="text-[#8C857E] block">Trigger:</span>
                    <span className="font-semibold text-[#2C2C2C]">{deploymentTrigger}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#8C857E] block">Before Command:</span>
                    <span className="font-mono text-[#2C2C2C]">{beforeCommand || 'None'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#8C857E] block">Post Pull Command:</span>
                    <span className="font-mono text-[#2C2C2C]">{postPullCommand || 'None'}</span>
                  </div>
                </div>
              </div>

              {mode === 'CLONE' && (
                <div className="p-3.5 rounded-2xl bg-[#82937E]/15 border border-[#82937E]/30 text-xs text-[#3D4F38] flex items-center justify-between">
                  <div>
                    <span className="font-semibold block text-[#4A5D45]">Clone Repository Now?</span>
                    <span className="text-[11px] text-[#6E6760]">Run git clone immediately upon creation.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={cloneNow}
                    onChange={(e) => setCloneNow(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E5E0D8] bg-white text-[#4A5D45] focus:ring-[#4A5D45]"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E0D8] bg-[#F3EFEA]">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as any)}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#4A5D45] bg-white hover:bg-[#EAE4DC] transition border border-[#E5E0D8] shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              onClick={() => {
                if (step === 1 && (!name || !gitUrl || !branch)) {
                  setErrorMessage('Name, Git URL, and Branch are required.');
                  return;
                }
                if (step === 2 && inspection && !inspection.allowed) {
                  setErrorMessage('Please enter a path inside an allowed deploy root.');
                  return;
                }
                setErrorMessage('');
                setStep((s) => (s + 1) as any);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3D4F38] transition shadow-md shadow-[#4A5D45]/20"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3D4F38] disabled:opacity-50 transition shadow-md shadow-[#4A5D45]/20"
            >
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {creating ? 'Registering Repository...' : 'Create Repository'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function getStepTitle(s: 1 | 2 | 3 | 4 | 5): string {
  switch (s) {
    case 1:
      return 'Repository Information';
    case 2:
      return 'Server Location';
    case 3:
      return 'Diagnostics';
    case 4:
      return 'Deployment Settings';
    case 5:
      return 'Review & Register';
  }
}

