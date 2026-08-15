import {
  User,
  Repository,
  Deployment,
  WebhookEvent,
  AuditLog,
  AppSettings,
  DashboardStats,
  BranchInfo,
  CommitLogItem,
  GitStatusDetails,
  ActionTemplate,
  ActionRun,
  DockerContainer,
  DockerImage,
  ComposePsEntry,
  ComposeServiceInput,
  SystemMetrics,
  ContainerStat,
  ToolStatus,
  ToolVersion,
  SystemdService,
  NginxSite,
  WebServerStatus,
  ReverseProxyInput,
  ReverseProxyResult,
  StackStatus,
  InstallJob
} from '../types.js';

const API_BASE = '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401 && endpoint !== '/api/auth/login') {
    localStorage.removeItem('auth_token');
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err: any = new Error(data.error || data.message || `HTTP ${res.status} error`);
    err.code = data.code || undefined;
    throw err;
  }

  return data as T;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ message: string; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  logout: () => request<{ message: string }>('/api/auth/logout', { method: 'POST' }),
  getMe: () => request<{ user: User }>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    }),
  updateAccount: (currentPassword: string, newUsername?: string, newPassword?: string) =>
    request<{ message: string; token: string; user: User }>('/api/auth/update-account', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newUsername, newPassword })
    }),

  // Dashboard
  getDashboardStats: () => request<DashboardStats>('/api/system/dashboard/stats'),

  // Repositories
  getRepositories: () => request<Repository[]>('/api/repositories'),
  getRepository: (id: number) => request<Repository>(`/api/repositories/${id}`),
  createRepository: (data: Partial<Repository>) =>
    request<Repository>('/api/repositories', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateRepository: (id: number, data: Partial<Repository>) =>
    request<Repository>(`/api/repositories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteRepository: (id: number, deleteFilesystem = false) =>
    request<{ message: string }>(`/api/repositories/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ deleteFilesystem })
    }),

  // Repository Git Actions
  cloneRepo: (id: number) =>
    request<{ message: string; stdout: string }>(`/api/repositories/${id}/clone`, { method: 'POST' }),
  fetchRepo: (id: number) =>
    request<{ message: string; stdout: string }>(`/api/repositories/${id}/fetch`, { method: 'POST' }),
  pullRepo: (id: number, force = false) =>
    request<{ message: string; deployment: Deployment }>(`/api/repositories/${id}/pull`, {
      method: 'POST',
      body: JSON.stringify({ force })
    }),
  getRepoStatus: (id: number) => request<GitStatusDetails>(`/api/repositories/${id}/status`),
  initGitRepo: (id: number, payload: { gitUser?: string; gitEmail?: string; commitMessage?: string }) =>
    request<{ message: string; createdInitialCommit: boolean }>(`/api/repositories/${id}/init-git`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getRepoBranches: (id: number) => request<BranchInfo[]>(`/api/repositories/${id}/branches`),
  getRepoLogs: (id: number, limit = 20) => request<CommitLogItem[]>(`/api/repositories/${id}/log?limit=${limit}`),

  // Deployments
  getDeployments: (repositoryId?: number, limit = 100) =>
    request<Deployment[]>(`/api/deployments?limit=${limit}${repositoryId ? `&repositoryId=${repositoryId}` : ''}`),
  getDeployment: (id: number) => request<Deployment>(`/api/deployments/${id}`),
  clearDeployments: (repositoryId?: number) =>
    request<{ message: string; deleted: number }>(`/api/deployments${repositoryId ? `?repositoryId=${repositoryId}` : ''}`, {
      method: 'DELETE'
    }),

  // Webhooks
  getWebhookHistory: (limit = 100) => request<WebhookEvent[]>(`/webhooks/history?limit=${limit}`),
  clearWebhookEvents: () =>
    request<{ message: string; deleted: number }>('/webhooks/events', { method: 'DELETE' }),

  // System & SSH
  inspectDirectory: (path: string, git_url?: string) =>
    request<import('../types.js').DirectoryInspection>('/api/system/inspect-directory', {
      method: 'POST',
      body: JSON.stringify({ path, git_url })
    }),
  detectEnvironment: () => request<import('../types.js').SystemEnvironment>('/api/system/detect-environment'),
  testGithub: () =>
    request<{
      success: boolean;
      message: string;
      details: string;
      authenticatedUser?: string | null;
      stepResults: { git: boolean; sshKey: boolean; connection: boolean };
    }>('/api/system/test-github', { method: 'POST' }),
  getSshKeyStatus: () =>
    request<{
      gitInstalled: boolean;
      gitVersion: string;
      keyPath: string;
      pubKeyPath: string;
      privateKeyExists: boolean;
      publicKeyExists: boolean;
      publicKeyContent: string;
      knownHostsPath: string;
      knownHostsExists: boolean;
    }>('/api/system/ssh-key'),
  generateSshKey: (force?: boolean) =>
    request<{ message: string; status: any }>('/api/system/generate-ssh-key', {
      method: 'POST',
      body: JSON.stringify({ force })
    }),

  // Settings
  getSettings: () => request<AppSettings>('/api/system/settings'),
  updateSettings: (settings: Partial<AppSettings>) =>
    request<AppSettings>('/api/system/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  // Audit Logs
  getAuditLogs: (limit = 100) => request<AuditLog[]>(`/api/system/audit-logs?limit=${limit}`),
  clearAuditLogs: () =>
    request<{ message: string; deleted: number }>('/api/system/audit-logs', { method: 'DELETE' }),

  // Action Templates
  getActionTemplates: () => request<ActionTemplate[]>('/api/actions/templates'),
  createActionTemplate: (data: { name: string; tech_stack: string; description?: string; commands: string[] }) =>
    request<ActionTemplate>('/api/actions/templates', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateActionTemplate: (id: number, data: { name?: string; tech_stack?: string; description?: string; commands?: string[] }) =>
    request<ActionTemplate>(`/api/actions/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteActionTemplate: (id: number) =>
    request<{ message: string }>(`/api/actions/templates/${id}`, { method: 'DELETE' }),

  // Action Runs
  runAction: (repositoryId: number, payload: { templateId?: number; commands?: string[]; timeoutSeconds?: number }) =>
    request<ActionRun>('/api/actions/run', {
      method: 'POST',
      body: JSON.stringify({ repositoryId, ...payload })
    }),
  getActionRuns: (repositoryId?: number, limit = 50) =>
    request<ActionRun[]>(`/api/actions/runs?limit=${limit}${repositoryId ? `&repositoryId=${repositoryId}` : ''}`),
  getActionRun: (id: number) => request<ActionRun>(`/api/actions/runs/${id}`),
  clearActionRuns: (repositoryId?: number) =>
    request<{ message: string; deleted: number }>(`/api/actions/runs${repositoryId ? `?repositoryId=${repositoryId}` : ''}`, {
      method: 'DELETE'
    }),

  // Docker
  getDockerStatus: () =>
    request<{ docker: ToolVersion; compose: ToolVersion; installed: boolean }>('/api/docker/status'),
  getContainers: (all = true) => request<DockerContainer[]>(`/api/docker/containers?all=${all}`),
  getContainerLogs: (id: string, tail = 200) =>
    request<{ id: string; log: string }>(`/api/docker/containers/${encodeURIComponent(id)}/logs?tail=${tail}`),
  startContainer: (id: string) =>
    request<{ message: string; id: string }>(`/api/docker/containers/${encodeURIComponent(id)}/start`, { method: 'POST' }),
  stopContainer: (id: string) =>
    request<{ message: string; id: string }>(`/api/docker/containers/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
  restartContainer: (id: string) =>
    request<{ message: string; id: string }>(`/api/docker/containers/${encodeURIComponent(id)}/restart`, { method: 'POST' }),
  removeContainer: (id: string, force = false) =>
    request<{ message: string }>(`/api/docker/containers/${encodeURIComponent(id)}?force=${force}`, { method: 'DELETE' }),
  getDockerImages: () => request<DockerImage[]>('/api/docker/images'),
  pullDockerImage: (image: string) =>
    request<{ message: string; output: string }>('/api/docker/images/pull', {
      method: 'POST',
      body: JSON.stringify({ image })
    }),
  removeDockerImage: (id: string, force = false) =>
    request<{ message: string }>(`/api/docker/images/${encodeURIComponent(id)}?force=${force}`, { method: 'DELETE' }),

  // Docker Compose (per repository)
  composePs: (repositoryId: number, file = 'docker-compose.yml') =>
    request<ComposePsEntry[]>(`/api/docker/compose/${repositoryId}/ps?file=${encodeURIComponent(file)}`),
  composeUp: (repositoryId: number, file = 'docker-compose.yml', build = true, services: string[] = []) =>
    request<{ message: string; output: string }>(`/api/docker/compose/${repositoryId}/up?file=${encodeURIComponent(file)}&build=${build}`, {
      method: 'POST',
      body: JSON.stringify({ services })
    }),
  composeBuild: (repositoryId: number, file = 'docker-compose.yml', services: string[] = []) =>
    request<{ message: string; output: string }>(`/api/docker/compose/${repositoryId}/build?file=${encodeURIComponent(file)}`, {
      method: 'POST',
      body: JSON.stringify({ services })
    }),
  composeDown: (repositoryId: number, file = 'docker-compose.yml') =>
    request<{ message: string; output: string }>(`/api/docker/compose/${repositoryId}/down?file=${encodeURIComponent(file)}`, {
      method: 'POST'
    }),
  getComposeContent: (repositoryId: number, file = 'docker-compose.yml') =>
    request<{ file: string; content: string }>(`/api/docker/compose/${repositoryId}/file?file=${encodeURIComponent(file)}`),
  saveComposeContent: (repositoryId: number, file: string, content: string) =>
    request<{ message: string }>(`/api/docker/compose/${repositoryId}/file?file=${encodeURIComponent(file)}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    }),
  getComposeServices: (repositoryId: number, file = 'docker-compose.yml') =>
    request<string[]>(`/api/docker/compose/${repositoryId}/services?file=${encodeURIComponent(file)}`),
  addComposeService: (repositoryId: number, file: string, input: ComposeServiceInput) =>
    request<{ message: string; services: string[] }>(`/api/docker/compose/${repositoryId}/services?file=${encodeURIComponent(file)}`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  getComposeOverride: (repositoryId: number, file = 'docker-compose.yml') =>
    request<{ file: string; content: string; proxiedServices: string[] }>(`/api/docker/compose/${repositoryId}/override?file=${encodeURIComponent(file)}`),
  writeComposeOverride: (repositoryId: number, file: string, services: string[]) =>
    request<{ message: string }>(`/api/docker/compose/${repositoryId}/override?file=${encodeURIComponent(file)}`, {
      method: 'POST',
      body: JSON.stringify({ services })
    }),

  // Monitoring
  getSystemMetrics: () => request<SystemMetrics>('/api/monitoring/system'),
  getContainerStats: () => request<ContainerStat[]>('/api/monitoring/containers'),
  getToolStatus: () => request<ToolStatus>('/api/monitoring/tools'),

  // systemd
  getSystemdServices: (filter = '') => request<SystemdService[]>(`/api/systemd/services?filter=${encodeURIComponent(filter)}`),
  getSystemdServiceStatus: (unit: string) =>
    request<{ unit: string; output: string }>(`/api/systemd/services/${encodeURIComponent(unit)}/status`),
  getSystemdServiceLogs: (unit: string, tail = 200) =>
    request<{ unit: string; log: string }>(`/api/systemd/services/${encodeURIComponent(unit)}/logs?tail=${tail}`),
  systemdAction: (unit: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') =>
    request<{ message: string; unit: string }>(`/api/systemd/services/${encodeURIComponent(unit)}/${action}`, { method: 'POST' }),

  // Web server (nginx / caddy)
  getWebServerStatus: () => request<WebServerStatus>('/api/webserver/status'),
  getNginxSites: () => request<NginxSite[]>('/api/webserver/nginx/sites'),
  getNginxSite: (name: string) =>
    request<{ name: string; content: string }>(`/api/webserver/nginx/sites/${encodeURIComponent(name)}`),
  saveNginxSite: (name: string, content: string) =>
    request<{ message: string }>(`/api/webserver/nginx/sites/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    }),
  nginxSiteAction: (name: string, action: 'enable' | 'disable') =>
    request<{ message: string }>(`/api/webserver/nginx/sites/${encodeURIComponent(name)}/${action}`, { method: 'POST' }),
  testNginx: () => request<{ ok: boolean; output: string }>('/api/webserver/nginx/test', { method: 'POST' }),
  reloadNginx: () => request<{ message: string }>('/api/webserver/nginx/reload', { method: 'POST' }),
  getCaddyfile: () => request<{ path: string; content: string }>('/api/webserver/caddy/caddyfile'),
  saveCaddyfile: (content: string) =>
    request<{ message: string }>('/api/webserver/caddy/caddyfile', {
      method: 'PUT',
      body: JSON.stringify({ content })
    }),
  reloadCaddy: () => request<{ message: string }>('/api/webserver/caddy/reload', { method: 'POST' }),
  generateReverseProxy: (input: ReverseProxyInput) =>
    request<ReverseProxyResult>('/api/webserver/proxy', {
      method: 'POST',
      body: JSON.stringify(input)
    }),

  // Installer
  getStackStatus: () => request<StackStatus>('/api/installer/status'),
  getInstallJob: () => request<InstallJob>('/api/installer/job'),
  startInstall: (components: string[]) =>
    request<InstallJob>('/api/installer/install', {
      method: 'POST',
      body: JSON.stringify({ components })
    })
};
