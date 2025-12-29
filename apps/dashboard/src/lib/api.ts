import type {
  User,
  Repository,
  Scan,
  DebtItem,
  DebtTrend,
  Hotspot,
  ApiKey,
  PaginatedResponse,
  Severity,
  DebtType,
  DebtStatus,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new ApiError(response.status, error.message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  getMe: () => fetchApi<User>('/auth/me'),

  logout: () => fetchApi<void>('/auth/logout', { method: 'POST' }),

  getGitHubAuthUrl: () => `${API_URL}/auth/github`,
};

// Repositories API
export const reposApi = {
  list: () => fetchApi<Repository[]>('/repos'),

  get: (id: string) => fetchApi<Repository>(`/repos/${id}`),

  create: (data: { provider: 'github' | 'gitlab'; fullName: string }) =>
    fetchApi<Repository>('/repos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, settings: Partial<Repository['settings']>) =>
    fetchApi<Repository>(`/repos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/repos/${id}`, { method: 'DELETE' }),

  sync: (id: string) =>
    fetchApi<void>(`/repos/${id}/sync`, { method: 'POST' }),
};

// Scans API
export const scansApi = {
  listByRepo: (repoId: string) =>
    fetchApi<Scan[]>(`/repos/${repoId}/scans`),

  get: (id: string) => fetchApi<Scan>(`/scans/${id}`),

  trigger: (repoId: string, data?: { branch?: string; commitSha?: string }) =>
    fetchApi<Scan>(`/repos/${repoId}/scans`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  cancel: (id: string) =>
    fetchApi<void>(`/scans/${id}`, { method: 'DELETE' }),

  // SSE progress stream - returns EventSource URL
  getProgressUrl: (id: string) => `${API_URL}/scans/${id}/progress`,
};

// Debt API
export interface DebtFilters {
  type?: DebtType[];
  severity?: Severity[];
  status?: DebtStatus[];
  filePath?: string;
  page?: number;
  pageSize?: number;
}

export const debtApi = {
  listByRepo: (repoId: string, filters?: DebtFilters) => {
    const params = new URLSearchParams();
    if (filters?.type) filters.type.forEach((t) => params.append('type[]', t));
    if (filters?.severity) filters.severity.forEach((s) => params.append('severity[]', s));
    if (filters?.status) filters.status.forEach((s) => params.append('status[]', s));
    if (filters?.filePath) params.set('filePath', filters.filePath);
    if (filters?.page) params.set('page', filters.page.toString());
    if (filters?.pageSize) params.set('pageSize', filters.pageSize.toString());

    const query = params.toString();
    return fetchApi<PaginatedResponse<DebtItem>>(`/repos/${repoId}/debt${query ? `?${query}` : ''}`);
  },

  listByScan: (scanId: string) =>
    fetchApi<DebtItem[]>(`/scans/${scanId}/debt`),

  get: (id: string) => fetchApi<DebtItem>(`/debt/${id}`),

  updateStatus: (id: string, status: DebtStatus) =>
    fetchApi<DebtItem>(`/debt/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  submitFeedback: (id: string, data: { valid: boolean; reason?: string }) =>
    fetchApi<void>(`/debt/${id}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getHotspots: (repoId: string, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return fetchApi<Hotspot[]>(`/repos/${repoId}/debt/hotspots${params}`);
  },

  getTrends: (repoId: string, days?: number) => {
    const params = days ? `?days=${days}` : '';
    return fetchApi<DebtTrend[]>(`/repos/${repoId}/debt/trends${params}`);
  },
};

// API Keys API
export const apiKeysApi = {
  list: () => fetchApi<ApiKey[]>('/api-keys'),

  create: (data: { name: string; scopes?: string[]; expiresAt?: string }) =>
    fetchApi<ApiKey & { key: string }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revoke: (id: string) =>
    fetchApi<void>(`/api-keys/${id}`, { method: 'DELETE' }),
};

// Health API
export const healthApi = {
  check: () => fetchApi<{ status: string; timestamp: string; version: string }>('/health'),
};
