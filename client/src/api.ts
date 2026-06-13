const API_BASE = '/api';

export interface User {
  id: number;
  username: string;
  role: 'inspector' | 'responsible' | 'admin';
  display_name: string;
}

export interface Task {
  id: number;
  title: string;
  area: string;
  assigned_to: number;
  assigned_to_name: string;
  scheduled_date: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  completed_at: string | null;
  summary?: {
    total: number;
    normal_count: number;
    abnormal_count: number;
    checked_count: number;
  };
  items?: InspectionItem[];
}

export interface InspectionRecord extends Task {
  total_items: number;
  abnormal_items: number;
  checked_items: number;
}

export interface InspectionItem {
  id: number;
  task_id: number;
  item_name: string;
  category: string;
  status: 'unchecked' | 'normal' | 'abnormal';
  description: string | null;
  photo_url: string | null;
  checked_at: string | null;
}

export interface RectificationOrder {
  id: number;
  task_id: number;
  inspection_item_id: number;
  description: string;
  photo_url: string | null;
  responsible_person: number;
  responsible_person_name: string;
  deadline: string;
  status: 'pending' | 'processing' | 'review' | 'completed' | 'rejected';
  result_description: string | null;
  result_photo_url: string | null;
  processed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  reviewer_name: string | null;
  created_at: string;
  item_name?: string;
  category?: string;
  task_title?: string;
  area?: string;
  item_description?: string;
  item_photo_url?: string;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request(url: string, options: RequestInit = {}): Promise<unknown> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('未登录');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

export async function login(username: string, password: string) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }) as Promise<{ token: string; user: User }>;
}

export async function getUsers() {
  return request('/auth/users') as Promise<User[]>;
}

export async function getTasks() {
  return request('/tasks') as Promise<Task[]>;
}

export async function getTask(id: number) {
  return request(`/tasks/${id}`) as Promise<Task>;
}

export async function startTask(id: number) {
  return request(`/tasks/${id}/start`, { method: 'PUT' });
}

export async function saveInspectionItem(itemId: number, data: {
  status: 'normal' | 'abnormal';
  description?: string;
  photo_url?: string;
}) {
  return request(`/tasks/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function completeTask(id: number) {
  return request(`/tasks/${id}/complete`, { method: 'PUT' });
}

export async function getRectifications() {
  return request('/rectifications') as Promise<RectificationOrder[]>;
}

export async function getRectification(id: number) {
  return request(`/rectifications/${id}`) as Promise<RectificationOrder>;
}

export async function createRectification(data: {
  task_id: number;
  inspection_item_id: number;
  description: string;
  responsible_person: number;
  deadline: string;
}) {
  return request('/rectifications', {
    method: 'POST',
    body: JSON.stringify(data),
  }) as Promise<{ id: number; success: boolean }>;
}

export async function acknowledgeRectification(id: number) {
  return request(`/rectifications/${id}/acknowledge`, { method: 'PUT' });
}

export async function processRectification(id: number, data: {
  result_description: string;
  result_photo_url?: string;
}) {
  return request(`/rectifications/${id}/process`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function reviewRectification(id: number, data: {
  approved: boolean;
  comment?: string;
}) {
  return request(`/rectifications/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getAdminStats() {
  return request('/admin/stats') as Promise<{
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalHazards: number;
    pendingHazards: number;
    completedHazards: number;
  }>;
}

export async function getAreaStats() {
  return request('/admin/area-stats') as Promise<{
    area: string;
    total_tasks: number;
    completed_tasks: number;
    completion_rate: number;
  }[]>;
}

export async function getHazardRanking() {
  return request('/admin/hazard-ranking') as Promise<{
    area: string;
    hazard_count: number;
    resolved_count: number;
    pending_count: number;
  }[]>;
}

export async function getMonthlyTrends() {
  return request('/admin/monthly-trends') as Promise<{
    taskTrends: { month: string; total_tasks: number; completed_tasks: number }[];
    hazardTrends: { month: string; total_hazards: number; resolved_hazards: number }[];
  }>;
}

export async function getAllRecords(page = 1, pageSize = 20) {
  return request(`/admin/all-records?page=${page}&pageSize=${pageSize}`) as Promise<{
    records: Task[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>;
}

export async function getInspectorStats() {
  return request('/admin/inspector-stats') as Promise<{
    id: number;
    display_name: string;
    total_tasks: number;
    completed_tasks: number;
    hazards_found: number;
  }[]>;
}

export async function uploadImage(base64: string, filename: string): Promise<string> {
  const data = await request('/upload', {
    method: 'POST',
    body: JSON.stringify({ image: base64, filename }),
  }) as { url: string };
  return data.url;
}
