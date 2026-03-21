import { postMultipart } from './httpClient';
import { request } from './request';
import { paths } from './paths';

export { api, postJson, postMultipart } from './httpClient';
export { request } from './request';
export { paths } from './paths';

/** 列表/详情等：直接得到拦截器解包后的业务对象（与原先 `await api.get()` 的 `response.data` 一致） */
export const posts = {
  list: (params?: Record<string, unknown>) =>
    request({ url: paths.posts, method: 'GET', params: params as Record<string, unknown> | undefined }),
  getBySlug: (slug: string) => request({ url: paths.post(slug), method: 'GET' }),
  archive: () => request({ url: paths.archive, method: 'GET' }),
};

export const interactions = {
  getComments: (slug: string, params?: Record<string, unknown>) =>
    request({
      url: paths.postComments(slug),
      method: 'GET',
      params: params as Record<string, unknown> | undefined,
    }),
  postComment: (slug: string, data: Record<string, unknown>) =>
    request({ url: paths.postComments(slug), method: 'POST', data }),
  like: (slug: string) => request({ url: paths.postLike(slug), method: 'POST', data: {} }),
};

export const categories = {
  list: () => request({ url: paths.categories, method: 'GET' }),
};

export const tags = {
  list: () => request({ url: paths.tags, method: 'GET' }),
};

export const site = {
  get: () => request({ url: paths.site, method: 'GET' }),
  trackVisit: () => request({ url: paths.visit, method: 'POST', data: {} }),
};

export const links = {
  list: () => request({ url: paths.links, method: 'GET' }),
};

export const auth = {
  login: (data: { email: string; password: string }) =>
    request({ url: paths.auth.login, method: 'POST', data: { email: data.email, password: data.password } }),
  logout: () => request({ url: paths.auth.logout, method: 'POST', data: {} }),
  me: () => request({ url: paths.auth.me, method: 'GET' }),
};

export const admin = {
  posts: {
    list: (params?: Record<string, unknown>) =>
      request({ url: paths.admin.posts.list, method: 'POST', data: params ?? {} }),
    get: (id: string | number) =>
      request({ url: paths.admin.posts.detail, method: 'POST', data: { id: Number(id) } }),
    create: (data: Record<string, unknown>) =>
      request({ url: paths.admin.posts.create, method: 'POST', data }),
    update: (id: string | number, data: Record<string, unknown>) =>
      request({ url: paths.admin.posts.update, method: 'POST', data: { ...data, id: Number(id) } }),
    remove: (id: string | number) =>
      request({ url: paths.admin.posts.delete, method: 'POST', data: { id: Number(id) } }),
  },
  categories: {
    list: () => request({ url: paths.admin.categories.list, method: 'POST', data: {} }),
    create: (data: Record<string, unknown>) =>
      request({ url: paths.admin.categories.create, method: 'POST', data }),
    save: (id: string | number, data: { name: string; slug?: string }) => {
      const nid = Number(id);
      const body: Record<string, unknown> = { id: nid, name: data.name };
      if (data.slug !== undefined && data.slug !== '') body.slug = data.slug;
      return request({ url: paths.admin.categories.edit, method: 'POST', data: body });
    },
    remove: (id: string | number) =>
      request({ url: paths.admin.categories.delete, method: 'POST', data: { id: Number(id) } }),
  },
  tags: {
    list: () => request({ url: paths.admin.tags.list, method: 'POST', data: {} }),
    create: (data: Record<string, unknown>) =>
      request({ url: paths.admin.tags.create, method: 'POST', data }),
    save: (id: string | number, data: { name: string; slug?: string }) => {
      const nid = Number(id);
      const body: Record<string, unknown> = { id: nid, name: data.name };
      if (data.slug !== undefined && data.slug !== '') body.slug = data.slug;
      return request({ url: paths.admin.tags.edit, method: 'POST', data: body });
    },
    remove: (id: string | number) =>
      request({ url: paths.admin.tags.delete, method: 'POST', data: { id: Number(id) } }),
  },
  site: {
    get: () => request({ url: paths.admin.site.get, method: 'POST', data: {} }),
    update: (data: Record<string, unknown>) =>
      request({ url: paths.admin.site.update, method: 'POST', data }),
  },
  upload: (formData: FormData) => postMultipart(paths.admin.upload, formData),
  comments: {
    list: (params?: { status?: string }) =>
      request({
        url: paths.admin.comments.list,
        method: 'POST',
        data: params?.status ? { status: params.status } : {},
      }),
    update: (id: string | number, data: { status: string }) => {
      const nid = Number(id);
      return request({ url: paths.admin.comments.edit, method: 'POST', data: { id: nid, status: data.status } });
    },
    remove: (id: string | number) =>
      request({ url: paths.admin.comments.delete, method: 'POST', data: { id: Number(id) } }),
  },
};

export const search = {
  posts: (params?: Record<string, unknown>) =>
    request({ url: paths.search, method: 'GET', params: params as Record<string, unknown> | undefined }),
};
