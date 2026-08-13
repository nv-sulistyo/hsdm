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
  ActionRun
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
    throw new Error(data.error || data.message || `HTTP ${res.status} error`);
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
    })
};
