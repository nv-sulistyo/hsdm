import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Repository, AppSettings, Deployment, BranchInfo, CommitLogItem, GitStatusDetails } from '../types.js';
import { RepoStatusBadge } from '../components/StatusBadge.js';
import { AddRepoWizard } from '../components/AddRepoWizard.js';
import { LocalChangesModal } from '../components/LocalChangesModal.js';
import { LogViewerModal } from '../components/LogViewerModal.js';
import { ActionRunnerModal } from '../components/ActionRunnerModal.js';
import {
  FolderGit2,
  Plus,
  RefreshCw,
  GitPullRequest,
  Download,
  History,
  Edit2,
  Trash2,
  GitBranch,
  Terminal,
  Search,
  ExternalLink,
  Zap,
  Folder,
  AlertTriangle,
  X,
  Check,
  ShieldAlert,
  Code,
  GitCommitHorizontal
} from 'lucide-react';

export const RepositoriesPage: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [actionModalRepo, setActionModalRepo] = useState<Repository | null>(null);
  const [localChangesModalRepo, setLocalChangesModalRepo] = useState<{
    repo: Repository;
    dirtyFiles: string[];
  } | null>(null);

  const [pullingRepoId, setPullingRepoId] = useState<number | null>(null);
  const [fetchingRepoId, setFetchingRepoId] = useState<number | null>(null);

  // Init Git Modal
  const [initGitModalRepo, setInitGitModalRepo] = useState<Repository | null>(null);
  const [initGitName, setInitGitName] = useState('');
  const [initGitEmail, setInitGitEmail] = useState('');
  const [initGitMessage, setInitGitMessage] = useState('');
  const [initGitting, setInitGitting] = useState(false);
  const [initGitError, setInitGitError] = useState<string | null>(null);

  // Edit Modal
  const [editingRepo, setEditingRepo] = useState<Repository | null>(null);
  const [editBranch, setEditBranch] = useState('');
  const [editLocalPath, setEditLocalPath] = useState('');
  const [editExecutionUser, setEditExecutionUser] = useState('nova');
  const [editGitStrategy, setEditGitStrategy] = useState<'stash' | 'force' | 'ff-only'>('stash');
  const [editBeforeCmd, setEditBeforeCmd] = useState('');
  const [editPostPullCmd, setEditPostPullCmd] = useState('');
  const [editAutoDeploy, setEditAutoDeploy] = useState(true);
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal
  const [deletingRepo, setDeletingRepo] = useState<Repository | null>(null);
  const [deleteFilesystem, setDeleteFilesystem] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // View Log / Branches / History Modals
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [repoHistoryModal, setRepoHistoryModal] = useState<Repository | null>(null);
  const [repoHistoryList, setRepoHistoryList] = useState<Deployment[]>([]);

  const [branchesModalRepo, setBranchesModalRepo] = useState<Repository | null>(null);
  const [branchesList, setBranchesList] = useState<BranchInfo[]>([]);

  const [commitLogsModalRepo, setCommitLogsModalRepo] = useState<Repository | null>(null);
  const [commitLogsList, setCommitLogsList] = useState<CommitLogItem[]>([]);

  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchRepositories = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [repos, sett] = await Promise.all([
        api.getRepositories(),
        api.getSettings()
      ]);
      setRepositories(repos);
      setSettings(sett);
    } catch (err: any) {
      if (silent) {
        console.error('Auto-refresh failed:', err);
      } else {
        setActionMessage({ text: err.message || 'Failed to fetch repositories', type: 'error' });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
    const interval = setInterval(() => fetchRepositories(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusCheck = async (repo: Repository) => {
    try {
      await api.getRepoStatus(repo.id);
      fetchRepositories();
    } catch (err: any) {
      setActionMessage({ text: `Status check error: ${err.message}`, type: 'error' });
    }
  };

  const handlePullNow = async (repo: Repository, force = false) => {
    setPullingRepoId(repo.id);
    setActionMessage(null);
    try {
      // Pre-check status first
      const statusDetails: GitStatusDetails = await api.getRepoStatus(repo.id);

      if (statusDetails.isDirty && !force) {
        setLocalChangesModalRepo({
          repo,
          dirtyFiles: statusDetails.dirtyFiles || []
        });
        setPullingRepoId(null);
        return;
      }

      const res = await api.pullRepo(repo.id, force);
      setActionMessage({ text: `Pull triggered for '${repo.name}'.`, type: 'success' });
      fetchRepositories();
      if (res.deployment) {
        setSelectedDeployment(res.deployment);
      }
    } catch (err: any) {
      if (err.message?.includes('LOCAL_CHANGES_DETECTED')) {
        setLocalChangesModalRepo({
          repo,
          dirtyFiles: []
        });
      } else {
        setActionMessage({ text: err.message || 'Pull failed', type: 'error' });
      }
    } finally {
      setPullingRepoId(null);
    }
  };

  const handleFetchNow = async (repo: Repository) => {
    setFetchingRepoId(repo.id);
    setActionMessage(null);
    try {
      await api.fetchRepo(repo.id);
      setActionMessage({ text: `Fetched remote updates for '${repo.name}'`, type: 'success' });
      fetchRepositories();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Fetch failed', type: 'error' });
    } finally {
      setFetchingRepoId(null);
    }
  };

  const handleCloneNow = async (repo: Repository) => {
    try {
      const res = await api.cloneRepo(repo.id);
      setActionMessage({ text: res.stdout || 'Repository cloned successfully.', type: 'success' });
      fetchRepositories();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Clone failed', type: 'error' });
    }
  };

  const handleInitGit = async () => {
    if (!initGitModalRepo) return;
    setInitGitting(true);
    setInitGitError(null);
    try {
      const res = await api.initGitRepo(initGitModalRepo.id, {
        gitUser: initGitName.trim() || undefined,
        gitEmail: initGitEmail.trim() || undefined,
        commitMessage: initGitMessage.trim() || undefined
      });
      setActionMessage({ text: res.message, type: 'success' });
      setInitGitModalRepo(null);
      fetchRepositories();
    } catch (err: any) {
      const msg = err.message || 'Git initialization failed';
      setInitGitError(err.code === 'REMOTE_EMPTY' ? msg.replace(/^REMOTE_EMPTY:\s*/, '') : msg);
    } finally {
      setInitGitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRepo) return;
    setSavingEdit(true);
    try {
      await api.updateRepository(editingRepo.id, {
        branch: editBranch,
        local_path: editLocalPath,
        execution_user: editExecutionUser,
        git_strategy: editGitStrategy,
        before_command: editBeforeCmd,
        post_pull_command: editPostPullCmd,
        auto_deploy: editAutoDeploy,
        description: editDescription
      });
      setActionMessage({ text: `Updated repository '${editingRepo.name}'`, type: 'success' });
      setEditingRepo(null);
      fetchRepositories();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to update repository', type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRepo) return;
    setDeleting(true);
    try {
      await api.deleteRepository(deletingRepo.id, deleteFilesystem);
      setActionMessage({ text: `Deleted repository '${deletingRepo.name}'`, type: 'success' });
      setDeletingRepo(null);
      fetchRepositories();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to delete repository', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const openHistoryModal = async (repo: Repository) => {
    setRepoHistoryModal(repo);
    try {
      const deps = await api.getDeployments(repo.id, 50);
      setRepoHistoryList(deps);
    } catch {
      setRepoHistoryList([]);
    }
  };

  const openBranchesModal = async (repo: Repository) => {
    setBranchesModalRepo(repo);
    try {
      const bList = await api.getRepoBranches(repo.id);
      setBranchesList(bList);
    } catch {
      setBranchesList([]);
    }
  };

  const openCommitLogsModal = async (repo: Repository) => {
    setCommitLogsModalRepo(repo);
    try {
      const logs = await api.getRepoLogs(repo.id, 25);
      setCommitLogsList(logs);
    } catch {
      setCommitLogsList([]);
    }
  };

  const filteredRepos = repositories.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.git_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.local_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Search bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#4A5D45] tracking-tight">Repository Manager</h2>
          <p className="text-xs text-[#8C857E] mt-0.5">Automate Git clones, fetches, pulls & post-pull deployments</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#82937E] absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-[#2C2C2C] placeholder-[#8C857E] focus:outline-none focus:border-[#4A5D45]"
            />
          </div>

          <button
            onClick={() => setShowAddWizard(true)}
            className="px-4 py-2 rounded-2xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3D4F38] transition shadow-md shadow-[#4A5D45]/20 flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Repository
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-[#82937E]/15 border-[#82937E]/30 text-[#3D4F38]'
              : 'bg-[#C86D51]/15 border-[#C86D51]/30 text-[#9E391C]'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-[#8C857E] hover:text-[#2C2C2C]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Repositories List */}
      <div className="space-y-4">
        {filteredRepos.length > 0 ? (
          filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className="p-5 rounded-[24px] bg-white border border-[#E5E0D8] shadow-sm hover:border-[#82937E]/50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              {/* Info Column */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-lg font-serif text-[#4A5D45] truncate">{repo.name}</h3>
                  <RepoStatusBadge status={repo.status} />
                  {repo.auto_deploy && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-semibold bg-[#D4A373]/20 text-[#8C5828] border border-[#D4A373]/30">
                      <Zap className="w-3 h-3 text-[#B87333]" /> Auto Deploy
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#6E6760] font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <Code className="w-3.5 h-3.5 text-[#82937E] shrink-0" />
                    <span className="text-[#8C857E]">GitHub:</span>
                    <span className="text-[#2C2C2C] truncate">{repo.git_url}</span>
                  </div>

                  <div className="flex items-center gap-1.5 truncate">
                    <Folder className="w-3.5 h-3.5 text-[#82937E] shrink-0" />
                    <span className="text-[#8C857E]">Path:</span>
                    <span className="text-[#4A5D45] font-semibold truncate">{repo.local_path}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-[#8C857E] flex-wrap">
                  <span>
                    Branch: <strong className="text-[#4A5D45] font-mono">{repo.branch}</strong>
                  </span>
                  {repo.last_pull_at && (
                    <span>Last Pull: {new Date(repo.last_pull_at).toLocaleString()}</span>
                  )}
                  {repo.last_commit_message && (
                    <span className="truncate max-w-xs text-[#6E6760]">
                      Commit: "{repo.last_commit_message}"
                    </span>
                  )}
                </div>
              </div>

              {/* Actions Column */}
              <div className="flex items-center gap-2 flex-wrap shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E5E0D8]">
                {repo.status === 'NOT_A_REPOSITORY' ? (
                  <>
                    <button
                      onClick={() => {
                        setInitGitModalRepo(repo);
                        setInitGitName('');
                        setInitGitEmail('');
                        setInitGitMessage('');
                        setInitGitError(null);
                      }}
                      title="Initialize Git in the existing folder (connect remote, then sync or initial commit & push)"
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#B87333] hover:bg-[#8C5828] text-white transition flex items-center gap-1.5 shadow-sm"
                    >
                      <GitCommitHorizontal className="w-3.5 h-3.5" /> Init Git
                    </button>
                    <button
                      onClick={() => handleCloneNow(repo)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#4A5D45] hover:bg-[#3D4F38] text-white transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> Clone Now
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handlePullNow(repo)}
                      disabled={pullingRepoId === repo.id || repo.deployment_trigger === 'WEBHOOK'}
                      title={repo.deployment_trigger === 'WEBHOOK' ? 'Manual deployment disabled (Deployment Trigger: WEBHOOK only)' : 'Pull and deploy now'}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#4A5D45] hover:bg-[#3D4F38] text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm shadow-[#4A5D45]/20"
                    >
                      <GitPullRequest className={`w-3.5 h-3.5 ${pullingRepoId === repo.id ? 'animate-spin' : ''}`} />
                      {pullingRepoId === repo.id ? 'Pulling...' : 'Pull Now'}
                    </button>

                    <button
                      onClick={() => handleFetchNow(repo)}
                      disabled={fetchingRepoId === repo.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F3EFEA] hover:bg-[#EAE4DC] text-[#4A5D45] border border-[#E5E0D8] transition flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#82937E] ${fetchingRepoId === repo.id ? 'animate-spin' : ''}`} /> Fetch
                    </button>
                  </>
                )}

                <button
                  onClick={() => openHistoryModal(repo)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F3EFEA] hover:bg-[#EAE4DC] text-[#4A5D45] border border-[#E5E0D8] transition flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5 text-[#82937E]" /> History
                </button>

                <button
                  onClick={() => setActionModalRepo(repo)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F3EFEA] hover:bg-[#EAE4DC] text-[#4A5D45] border border-[#E5E0D8] transition flex items-center gap-1"
                  title="Run custom commands (npm install, build, etc.)"
                >
                  <Terminal className="w-3.5 h-3.5 text-[#82937E]" /> Actions
                </button>

                <button
                  onClick={() => openBranchesModal(repo)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#F3EFEA] hover:bg-[#EAE4DC] text-[#4A5D45] border border-[#E5E0D8] transition flex items-center gap-1"
                  title="View Branches"
                >
                  <GitBranch className="w-3.5 h-3.5 text-[#82937E]" />
                </button>

                <button
                  onClick={() => {
                    setEditingRepo(repo);
                    setEditBranch(repo.branch);
                    setEditLocalPath(repo.local_path);
                    setEditExecutionUser(repo.execution_user || 'nova');
                    setEditGitStrategy(repo.git_strategy || 'stash');
                    setEditBeforeCmd(repo.before_command || '');
                    setEditPostPullCmd(repo.post_pull_command || '');
                    setEditAutoDeploy(repo.auto_deploy);
                    setEditDescription(repo.description || '');
                  }}
                  className="p-2 rounded-xl bg-[#F3EFEA] hover:bg-[#EAE4DC] text-[#6E6760] hover:text-[#4A5D45] border border-[#E5E0D8] transition"
                  title="Edit Settings"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    setDeletingRepo(repo);
                    setDeleteFilesystem(false);
                  }}
                  className="p-2 rounded-xl bg-[#F3EFEA] hover:bg-[#C86D51]/15 text-[#6E6760] hover:text-[#C86D51] border border-[#E5E0D8] transition"
                  title="Delete Repository"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center bg-white border border-[#E5E0D8] rounded-[24px] space-y-3 shadow-sm">
            <FolderGit2 className="w-10 h-10 text-[#82937E] mx-auto" />
            <h3 className="text-base font-serif text-[#4A5D45]">No repositories registered</h3>
            <p className="text-xs text-[#8C857E] max-w-sm mx-auto">
              Click 'Add Repository' to connect your first GitHub repository and automate deployments.
            </p>
            <button
              onClick={() => setShowAddWizard(true)}
              className="px-4 py-2 rounded-2xl text-xs font-semibold text-white bg-[#4A5D45] hover:bg-[#3D4F38] transition shadow inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Repository
            </button>
          </div>
        )}
      </div>

      {/* Add Repository Wizard Modal */}
      {showAddWizard && (
        <AddRepoWizard
          settings={settings}
          onClose={() => setShowAddWizard(false)}
          onSuccess={(newRepo) => {
            setShowAddWizard(false);
            setActionMessage({ text: `Added repository '${newRepo.name}' successfully.`, type: 'success' });
            fetchRepositories();
          }}
        />
      )}

      {/* Local Changes Modal */}
      {localChangesModalRepo && (
        <LocalChangesModal
          repoName={localChangesModalRepo.repo.name}
          dirtyFiles={localChangesModalRepo.dirtyFiles}
          onCancel={() => setLocalChangesModalRepo(null)}
          onConfirmForcePull={() => {
            const repo = localChangesModalRepo.repo;
            setLocalChangesModalRepo(null);
            handlePullNow(repo, true);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-[#E5E0D8] rounded-[28px] p-6 text-[#2C2C2C] space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <h3 className="text-base font-serif font-bold text-[#4A5D45]">Edit Repository: {editingRepo.name}</h3>
              <button onClick={() => setEditingRepo(null)} className="text-[#8C857E] hover:text-[#2C2C2C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A5D45] font-semibold mb-1">Branch</label>
                  <input
                    type="text"
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[#4A5D45] font-semibold mb-1">Execution User</label>
                  <input
                    type="text"
                    value={editExecutionUser}
                    onChange={(e) => setEditExecutionUser(e.target.value)}
                    placeholder="nova"
                    className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#4A5D45] font-semibold mb-1">Local Path</label>
                <input
                  type="text"
                  value={editLocalPath}
                  onChange={(e) => setEditLocalPath(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A5D45] font-semibold mb-1">Git Pull Strategy</label>
                  <select
                    value={editGitStrategy}
                    onChange={(e) => setEditGitStrategy(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                  >
                    <option value="stash">Stash & Pull (Safest)</option>
                    <option value="force">Force Hard Reset (Overwrites local)</option>
                    <option value="ff-only">Fast-Forward Only</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-2.5 mt-5 rounded-xl bg-[#F3EFEA] border border-[#E5E0D8]">
                  <span className="font-semibold text-[#2C2C2C]">Auto Deploy</span>
                  <input
                    type="checkbox"
                    checked={editAutoDeploy}
                    onChange={(e) => setEditAutoDeploy(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E5E0D8] bg-white text-[#4A5D45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#4A5D45] font-semibold mb-1">Before-Pull Command (Pre-hook)</label>
                <input
                  type="text"
                  placeholder="e.g. echo 'Starting pull...'"
                  value={editBeforeCmd}
                  onChange={(e) => setEditBeforeCmd(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#4A5D45] font-semibold mb-1">Post-Pull Command (Build/Deploy hook)</label>
                <input
                  type="text"
                  placeholder="e.g. npm ci && npm run build"
                  value={editPostPullCmd}
                  onChange={(e) => setEditPostPullCmd(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#4A5D45] font-semibold mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E0D8]">
              <button
                onClick={() => setEditingRepo(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F3EFEA] hover:bg-[#EAE4DC] border border-[#E5E0D8] text-[#6E6760]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#4A5D45] hover:bg-[#3D4F38] text-white shadow-sm"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Init Git Modal */}
      {initGitModalRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-[#E5E0D8] rounded-[28px] p-6 text-[#2C2C2C] space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <h3 className="text-base font-serif font-bold text-[#4A5D45]">
                Initialize Git Repository: {initGitModalRepo.name}
              </h3>
              <button onClick={() => setInitGitModalRepo(null)} className="text-[#8C857E] hover:text-[#2C2C2C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#D4A373]/20 border border-[#D4A373]/40 text-xs text-[#8C5828] space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Yang akan dilakukan:
              </p>
              <ul className="list-disc pl-4 leading-relaxed space-y-1 text-[#6E6760]">
                <li>
                  <code className="font-mono">git init</code> + remote <code className="font-mono">origin</code> ={' '}
                  {initGitModalRepo.git_url}
                </li>
                <li>
                  Jika repo GitHub sudah punya commit: isi folder disinkronkan dengan{' '}
                  <code className="font-mono">origin/{initGitModalRepo.branch || 'main'}</code> — file yang sudah
                  ter-track dan berbeda dari remote akan ditimpa. File untracked tetap dipertahankan.
                </li>
                <li>Jika repo GitHub masih kosong: dibuat commit pertama dan di-push otomatis.</li>
              </ul>
              <p className="text-[11px] text-[#8C857E]">
                Tip: file yang masuk .gitignore (mis. node_modules) tidak ikut di-commit.
              </p>
            </div>

            {initGitError && (
              <div className="p-3 rounded-2xl bg-[#C86D51]/15 border border-[#C86D51]/30 text-xs text-[#9E391C]">
                {initGitError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A5D45] font-semibold mb-1">Git Name (user.name)</label>
                  <input
                    type="text"
                    value={initGitName}
                    onChange={(e) => setInitGitName(e.target.value)}
                    placeholder="e.g. Nova Admin"
                    className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                  />
                </div>
                <div>
                  <label className="block text-[#4A5D45] font-semibold mb-1">Git Email (user.email)</label>
                  <input
                    type="email"
                    value={initGitEmail}
                    onChange={(e) => setInitGitEmail(e.target.value)}
                    placeholder="e.g. admin@domain.com"
                    className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#4A5D45] font-semibold mb-1">Commit Message</label>
                <input
                  type="text"
                  value={initGitMessage}
                  onChange={(e) => setInitGitMessage(e.target.value)}
                  placeholder="e.g. Initial commit from HSDM"
                  className="w-full px-3.5 py-2 bg-[#F3EFEA] border border-[#E5E0D8] rounded-xl text-[#2C2C2C] focus:outline-none focus:border-[#4A5D45]"
                />
                <p className="text-[11px] text-[#8C857E] mt-1">
                  Wajib diisi hanya jika repo GitHub belum punya commit (commit pertama + push otomatis).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E0D8]">
              <button
                onClick={() => setInitGitModalRepo(null)}
                disabled={initGitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F3EFEA] hover:bg-[#EAE4DC] border border-[#E5E0D8] text-[#6E6760]"
              >
                Cancel
              </button>
              <button
                onClick={handleInitGit}
                disabled={initGitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#B87333] hover:bg-[#8C5828] text-white shadow-sm flex items-center gap-1.5"
              >
                <GitCommitHorizontal className={`w-4 h-4 ${initGitting ? 'animate-spin' : ''}`} />
                {initGitting ? 'Initializing...' : 'Init & Sync Git'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white border border-[#C86D51]/30 rounded-[28px] p-6 text-[#2C2C2C] space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-[#C86D51]">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-base font-serif font-bold text-[#2C2C2C]">Delete Repository '{deletingRepo.name}'</h3>
            </div>

            <p className="text-xs text-[#6E6760] leading-relaxed">
              Are you sure you want to remove this repository configuration from the Git Automation Manager?
            </p>

            <div className="p-3.5 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] text-xs space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-[#C86D51] font-semibold">
                <input
                  type="checkbox"
                  checked={deleteFilesystem}
                  onChange={(e) => setDeleteFilesystem(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5E0D8] bg-white text-[#C86D51]"
                />
                Also delete local filesystem directory ({deletingRepo.local_path})
              </label>
              <p className="text-[11px] text-[#8C857E]">
                Default: Config only deleted. Check box above if you want to completely erase files from server storage.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E0D8]">
              <button
                onClick={() => setDeletingRepo(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F3EFEA] hover:bg-[#EAE4DC] border border-[#E5E0D8] text-[#6E6760]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#C86D51] hover:bg-[#A24227] text-white shadow-sm"
              >
                {deleting ? 'Deleting...' : 'Delete Repository'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {repoHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-3xl bg-white border border-[#E5E0D8] rounded-[28px] p-6 text-[#2C2C2C] max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3 mb-4">
              <h3 className="text-base font-serif font-bold text-[#4A5D45]">
                Deployment History: {repoHistoryModal.name}
              </h3>
              <button onClick={() => setRepoHistoryModal(null)} className="text-[#8C857E] hover:text-[#2C2C2C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {repoHistoryList.length > 0 ? (
                <div className="space-y-2">
                  {repoHistoryList.map((dep) => (
                    <div
                      key={dep.id}
                      onClick={() => setSelectedDeployment(dep)}
                      className="p-3.5 rounded-2xl bg-[#F3EFEA] border border-[#E5E0D8] hover:border-[#82937E]/50 transition flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-[#2C2C2C]">Deployment #{dep.id} — Trigger: {dep.trigger_type}</div>
                        <div className="text-[11px] text-[#8C857E] mt-0.5">
                          Started: {new Date(dep.created_at).toLocaleString()}
                        </div>
                      </div>
                      <button className="px-3 py-1.5 rounded-xl bg-white text-[#4A5D45] hover:bg-[#EAE4DC] font-semibold border border-[#E5E0D8]">
                        View Log
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[#8C857E]">No history found for this repository.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Branches Modal */}
      {branchesModalRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white border border-[#E5E0D8] rounded-[28px] p-6 text-[#2C2C2C] space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <h3 className="text-base font-serif font-bold text-[#4A5D45]">Branches: {branchesModalRepo.name}</h3>
              <button onClick={() => setBranchesModalRepo(null)} className="text-[#8C857E] hover:text-[#2C2C2C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 text-xs font-mono">
              {branchesList.map((b, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl flex items-center justify-between ${
                    b.isCurrent ? 'bg-[#82937E]/20 text-[#3D4F38] font-bold border border-[#82937E]/40' : 'bg-[#F3EFEA] text-[#6E6760]'
                  }`}
                >
                  <span>{b.name}</span>
                  {b.isCurrent && <span className="text-[10px] bg-[#4A5D45] text-white px-2 py-0.5 rounded-lg">CURRENT</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Log Viewer Modal */}
      {selectedDeployment && (
        <LogViewerModal deployment={selectedDeployment} onClose={() => setSelectedDeployment(null)} />
      )}

      {/* Action Runner Modal */}
      <ActionRunnerModal repo={actionModalRepo} onClose={() => setActionModalRepo(null)} />
    </div>
  );
};
