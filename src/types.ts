export type RepoStatus = 
  | 'SYNCED' 
  | 'BEHIND' 
  | 'AHEAD' 
  | 'DIVERGED' 
  | 'DIRTY' 
  | 'NOT_A_REPOSITORY' 
  | 'UNREACHABLE' 
  | 'ERROR'
  | 'UNCHECKED';

export type DeploymentStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type TriggerType = 'MANUAL' | 'WEBHOOK' | 'SYSTEM';

export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: number;
  name: string;
  git_url: string;
  branch: string;
  local_path: string;
  execution_user: string;
  mode: 'CLONE' | 'CONNECT';
  git_strategy?: 'PULL' | 'FETCH_ONLY' | 'RESET_HARD';
  deployment_trigger?: 'MANUAL' | 'WEBHOOK' | 'BOTH';
  before_command?: string;
  post_pull_command?: string;
  auto_deploy: boolean;
  webhook_enabled: boolean;
  webhook_secret: string;
  description?: string;
  status: RepoStatus;
  last_pull_at?: string;
  last_commit_hash?: string;
  last_commit_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: number;
  repository_id: number;
  repository_name?: string;
  trigger_type: TriggerType;
  status: DeploymentStatus;
  commit_before?: string;
  commit_after?: string;
  started_at?: string;
  finished_at?: string;
  output?: string;
  error?: string;
  created_at: string;
}

export interface WebhookEvent {
  id: number;
  repository_id: number;
  repository_name?: string;
  event_id?: string;
  event_type: string;
  signature_valid: boolean;
  payload_hash?: string;
  received_at: string;
  processed_at?: string;
  status: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  username?: string;
  action: string;
  repository_id?: number;
  repository_name?: string;
  ip_address?: string;
  details?: string;
  created_at: string;
}

export interface AppSettings {
  allowed_deploy_roots: string[];
  git_executable: string;
  ssh_key_path: string;
  known_hosts_path: string;
  auto_refresh_interval: number;
  execution_user: string;
  execution_home_dir?: string;
}

export interface DirectoryInspection {
  path: string;
  allowed: boolean;
  pathError?: string;
  exists: boolean;
  parentExists: boolean;
  writable: boolean;
  accessError?: string;
  isGitRepo: boolean;
  currentBranch?: string;
  remoteOrigin?: string;
  remoteMatches?: boolean;
  isDirty?: boolean;
  alreadyRegistered?: boolean;
  registeredRepoName?: string;
}

export interface SystemEnvironment {
  gitInstalled: boolean;
  gitVersion: string;
  executionUser: string;
  executionUserHome: string;
  userExistsOnSystem: boolean;
  keyPath: string;
  pubKeyPath: string;
  privateKeyExists: boolean;
  publicKeyExists: boolean;
  publicKeyContent: string;
  knownHostsPath: string;
  knownHostsExists: boolean;
  allowedRoots: string[];
  rootPermissions: Array<{ path: string; exists: boolean; writable: boolean; owner?: string }>;
  githubConnected: boolean;
  githubMessage: string;
}

export interface DashboardStats {
  totalRepositories: number;
  autoDeployCount: number;
  successfulDeployments: number;
  failedDeployments: number;
  lastDeployment?: Deployment;
  recentDeployments: Deployment[];
  recentAuditLogs: AuditLog[];
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface CommitLogItem {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface GitStatusDetails {
  status: RepoStatus;
  isGitRepo: boolean;
  currentBranch: string;
  ahead: number;
  behind: number;
  isDirty: boolean;
  dirtyFilesCount: number;
  dirtyFiles: string[];
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitAuthor: string;
  lastCommitDate: string;
}

export interface ActionTemplate {
  id: number;
  name: string;
  tech_stack: string;
  description?: string;
  commands: string[];
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export type ActionRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface ActionRun {
  id: number;
  repository_id: number;
  repository_name?: string;
  template_id?: number;
  template_name?: string;
  command: string;
  status: ActionRunStatus;
  exit_code?: number;
  started_at?: string;
  finished_at?: string;
  output?: string;
  error?: string;
  created_at: string;
}
