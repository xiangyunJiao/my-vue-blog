import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE || ''

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export const posts = {
  list: (params) => api.get('/api/posts', { params }),
  getBySlug: (slug) => api.get(`/api/posts/${slug}`),
  archive: () => api.get('/api/archive'),
}

export const categories = {
  list: () => api.get('/api/categories'),
}

export const tags = {
  list: () => api.get('/api/tags'),
}

export const site = {
  get: () => api.get('/api/site'),
}

export const links = {
  list: () => api.get('/api/links'),
}

// Admin API
export const auth = {
  login: (data) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
}

export const admin = {
  posts: {
    list: (params) => api.get('/api/admin/posts', { params }),
    get: (id) => api.get(`/api/admin/posts/${id}`),
    create: (data) => api.post('/api/admin/posts', data),
    update: (id, data) => api.put(`/api/admin/posts/${id}`, data),
    delete: (id) => api.delete(`/api/admin/posts/${id}`),
  },
  categories: {
    list: () => api.get('/api/categories'),
    create: (data) => api.post('/api/admin/categories', data),
    update: (id, data) => api.put(`/api/admin/categories/${id}`, data),
    delete: (id) => api.delete(`/api/admin/categories/${id}`),
  },
  tags: {
    list: () => api.get('/api/tags'),
    create: (data) => api.post('/api/admin/tags', data),
    update: (id, data) => api.put(`/api/admin/tags/${id}`, data),
    delete: (id) => api.delete(`/api/admin/tags/${id}`),
  },
  site: {
    get: () => api.get('/api/admin/site'),
    update: (data) => api.put('/api/admin/site', data),
  },
  upload: (formData) => api.post('/api/admin/upload', formData),
}

export const search = {
  posts: (params) => api.get('/api/search', { params }),
}
