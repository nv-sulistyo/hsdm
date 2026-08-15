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

export type DeployMode = 'NONE' | 'DOCKER_COMPOSE' | 'SYSTEMD';

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
  deploy_mode?: DeployMode;
  compose_file?: string;
  compose_service?: string;
  systemd_unit?: string;
  domain?: string;
  proxy_target_port?: number;
  compose_proxy_services?: string;
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
  deploy_root?: string;
  proxy_network?: string;
  infrastructure_dir?: string;
  nginx_sites_dir?: string;
  nginx_sites_enabled_dir?: string;
  caddyfile_path?: string;
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

// ---------- VPS Stack: Docker ----------

export interface ToolVersion {
  installed: boolean;
  version?: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  command: string;
  created_at: string;
  state: string;
  status: string;
  ports: string;
  networks: string;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  created_at: string;
  size: string;
}

export interface ComposePsEntry {
  name: string;
  service: string;
  status: string;
  ports: string;
}

export interface ComposeServiceInput {
  name: string;
  image: string;
  container_name?: string;
  ports?: string[];
  expose?: string[];
  volumes?: string[];
  environment?: string[];
  restart?: string;
  depends_on?: string[];
  network?: string;
  networks?: string[];
  command?: string;
}

// ---------- VPS Stack: Monitoring ----------

export interface DiskInfo {
  filesystem: string;
  mount: string;
  size: number;
  used: number;
  available: number;
  percent: number;
}

export interface SystemMetrics {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  distro?: string;
  uptime: number;
  loadAvg: number[];
  cpuUsage: number;
  cpuCount: number;
  memory: {
    total: number;
    available: number;
    used: number;
    percent: number;
  };
  disks: DiskInfo[];
  timestamp: string;
}

export interface ContainerStat {
  container: string;
  name: string;
  cpu_percent: string;
  mem_usage: string;
  mem_percent: string;
  net_io: string;
  block_io: string;
  pids: string;
}

export interface ToolStatus {
  docker: ToolVersion;
  compose: ToolVersion;
  nginx: ToolVersion;
  caddy: ToolVersion;
  systemd: ToolVersion;
  isRoot: boolean;
  platform: string;
}

// ---------- VPS Stack: systemd ----------

export interface SystemdService {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

// ---------- VPS Stack: Web server (nginx / caddy) ----------

export interface NginxSite {
  name: string;
  enabled: boolean;
  path: string;
  enabledPath?: string;
}

export interface WebServerStatus {
  nginx: { installed: boolean; version?: string; sitesDir?: string; enabledDir?: string };
  caddy: { installed: boolean; version?: string; caddyfilePath?: string };
}

export interface ReverseProxyInput {
  engine: 'nginx' | 'caddy';
  name: string;
  domain: string;
  targetPort: number;
}

export interface ReverseProxyResult {
  engine: 'nginx' | 'caddy';
  name: string;
  path: string;
  message: string;
}

// ---------- VPS Stack: Installer ----------

export interface StackStatusItem {
  installed: boolean;
  version?: string;
  installedAt?: string;
}

export interface StackStatus {
  docker: StackStatusItem;
  compose: StackStatusItem;
  nginx: StackStatusItem;
  caddy: StackStatusItem;
  isRoot: boolean;
  installable: boolean;
}

export interface InstallJob {
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | null;
  components: string[];
  log: string[];
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}
