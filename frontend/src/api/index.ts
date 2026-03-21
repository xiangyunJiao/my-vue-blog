import axios, { type AxiosInstance } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE || '';

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

function genUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ensureBlogVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('blog_visitor_id');
  if (!id) {
    id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : genUuidV4();
    localStorage.setItem('blog_visitor_id', id);
  }
  return id;
}

api.interceptors.request.use((config) => {
  const vid = ensureBlogVisitorId();
  if (vid) {
    config.headers['X-Blog-Visitor-Id'] = vid;
  }
  return config;
});

export const posts = {
  list: (params?: Record<string, unknown>) => api.get('/api/posts', { params }),
  getBySlug: (slug: string) => api.get(`/api/posts/${encodeURIComponent(slug)}`),
  archive: () => api.get('/api/archive'),
};

export const interactions = {
  getComments: (slug: string, params?: Record<string, unknown>) =>
    api.get(`/api/posts/${encodeURIComponent(slug)}/comments`, { params }),
  postComment: (slug: string, data: Record<string, unknown>) =>
    api.post(`/api/posts/${encodeURIComponent(slug)}/comments`, data),
  like: (slug: string) => api.post(`/api/posts/${encodeURIComponent(slug)}/like`),
};

export const categories = {
  list: () => api.get('/api/categories'),
};

export const tags = {
  list: () => api.get('/api/tags'),
};

export const site = {
  get: () => api.get('/api/site'),
};

export const links = {
  list: () => api.get('/api/links'),
};

// Admin API
export const auth = {
  login: (data: { email: string; password: string }) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
};

export const admin = {
  posts: {
    list: (params?: Record<string, unknown>) => api.get('/api/admin/posts', { params }),
    get: (id: string | number) => api.get(`/api/admin/posts/${id}`),
    create: (data: Record<string, unknown>) => api.post('/api/admin/posts', data),
    update: (id: string | number, data: Record<string, unknown>) => api.put(`/api/admin/posts/${id}`, data),
    /** POST + body/query id，避免经 Vite 代理时 DELETE 异常 */
    remove: (id: string | number) => {
      const nid = Number(id);
      return api.post('/api/admin/posts/delete', { id: nid }, { params: { id: nid } });
    },
  },
  categories: {
    list: () => api.get('/api/categories'),
    create: (data: Record<string, unknown>) => api.post('/api/admin/categories', data),
    /** id 放在 URL 路径，最不容易被代理弄丢；body 仍带 id 作双保险 */
    save: (id: string | number, data: { name: string; slug?: string }) => {
      const nid = Number(id);
      const body: Record<string, unknown> = { id: nid, name: data.name };
      if (data.slug !== undefined && data.slug !== '') body.slug = data.slug;
      return api.post(`/api/admin/categories/${encodeURIComponent(nid)}/edit`, body);
    },
    remove: (id: string | number) => {
      const nid = Number(id);
      return api.post(`/api/admin/categories/${encodeURIComponent(nid)}/delete`, { id: nid });
    },
  },
  tags: {
    list: () => api.get('/api/tags'),
    create: (data: Record<string, unknown>) => api.post('/api/admin/tags', data),
    save: (id: string | number, data: { name: string; slug?: string }) => {
      const nid = Number(id);
      const body: Record<string, unknown> = { id: nid, name: data.name };
      if (data.slug !== undefined && data.slug !== '') body.slug = data.slug;
      return api.post('/api/admin/tags/edit', body, { params: { id: nid } });
    },
    remove: (id: string | number) => {
      const nid = Number(id);
      return api.post('/api/admin/tags/delete', { id: nid }, { params: { id: nid } });
    },
  },
  site: {
    get: () => api.get('/api/admin/site'),
    update: (data: Record<string, unknown>) => api.put('/api/admin/site', data),
  },
  upload: (formData: FormData) => api.post('/api/admin/upload', formData),
  comments: {
    list: (params?: Record<string, unknown>) => api.get('/api/admin/comments', { params }),
    update: (id: string | number, data: { status: string }) => {
      const nid = Number(id);
      const status = data.status;
      return api.post('/api/admin/comments/edit', { id: nid, status }, { params: { id: nid, status } });
    },
    remove: (id: string | number) => {
      const nid = Number(id);
      return api.post('/api/admin/comments/delete', { id: nid }, { params: { id: nid } });
    },
  },
};

export const search = {
  posts: (params?: Record<string, unknown>) => api.get('/api/search', { params }),
};
