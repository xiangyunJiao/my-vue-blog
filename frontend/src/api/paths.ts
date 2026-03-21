/**
 * API 路径单一来源（与后端 `registerRoutes` + 各 Router 保持一致）。
 * 业务代码禁止手写零散 `/api/...`，避免拼写错误与前后端漂移。
 */
const enc = (s: string) => encodeURIComponent(s);

export const paths = {
  posts: '/api/posts',
  post: (slug: string) => `/api/posts/${enc(slug)}`,
  postComments: (slug: string) => `/api/posts/${enc(slug)}/comments`,
  postLike: (slug: string) => `/api/posts/${enc(slug)}/like`,
  archive: '/api/archive',
  search: '/api/search',
  categories: '/api/categories',
  tags: '/api/tags',
  site: '/api/site',
  visit: '/api/visit',
  links: '/api/links',
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
  },
  admin: {
    upload: '/api/admin/upload',
    posts: {
      list: '/api/admin/posts/list',
      detail: '/api/admin/posts/detail',
      create: '/api/admin/posts/create',
      update: '/api/admin/posts/update',
      delete: '/api/admin/posts/delete',
    },
    categories: {
      list: '/api/admin/categories/list',
      create: '/api/admin/categories/create',
      edit: '/api/admin/categories/edit',
      delete: '/api/admin/categories/delete',
    },
    tags: {
      list: '/api/admin/tags/list',
      create: '/api/admin/tags/create',
      edit: '/api/admin/tags/edit',
      delete: '/api/admin/tags/delete',
    },
    site: {
      get: '/api/admin/site/get',
      update: '/api/admin/site/update',
    },
    comments: {
      list: '/api/admin/comments/list',
      edit: '/api/admin/comments/edit',
      delete: '/api/admin/comments/delete',
    },
  },
} as const;
