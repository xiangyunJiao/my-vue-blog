# my-vue-blog

个人博客，基于 Vue3、Node、Express、SQLite。

## 环境要求

- **Node.js ≥ 18**（推荐用 nvm：`nvm use` 或 `nvm install 18`）
- npm

## 快速开始

**前置**：在项目根目录执行 `nvm use`（或 `nvm use 18`），确保 Node ≥ 18。前后端均需此版本。

### 1. 后端

```bash
cd backend
cp .env.example .env
# 编辑 .env，至少设置 ADMIN_PASSWORD（至少 8 位，首次空库会创建管理员）
npm install
npm run dev
```

源码为 **TypeScript**（`src/*.ts`）。生产环境需先编译再启动：

```bash
npm run build   # tsc → dist/
npm start       # node dist/index.js
```

`npm run typecheck` 可单独做类型检查（不产出文件）。

API 默认运行在 `http://localhost:3000`。

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

入口与路由、API 封装等为 **TypeScript**（`main.ts`、`router/index.ts` 等）。`npm run build` 会先执行 `vue-tsc` 再 `vite build`；`npm run typecheck` 仅类型检查。

前端默认运行在 `http://localhost:5173`。开发时 Vite 会将 `/api`、`/uploads` 代理到后端，无需额外配置。

**注意**：需同时启动后端，否则文章列表会加载失败。

## 管理后台

前端提供可视化管理界面：

- 访问 `http://localhost:5173/admin` 进入管理后台
- 未登录会跳转到 `/admin/login`
- 默认账号：`admin@localhost` / `admin123456`（与 `.env` 中 `ADMIN_EMAIL`、`ADMIN_PASSWORD` 一致）
- 支持：仪表盘、文章列表、新建/编辑文章、**分类与标签管理**、站点设置、友链、图片上传、**留言审核**、退出登录

## API 概览

### 公开（读者端）

| 接口 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/posts` | 文章列表（`?page=&limit=`，支持 `?category=&tag=`） |
| `GET /api/posts/:slug` | 文章详情（响应含 `likeCount`、`liked`、`commentCount`；可选请求头 `X-Blog-Visitor-Id` 用于识别是否已赞） |
| `GET /api/posts/:slug/comments` | 已通过审核的留言列表 |
| `POST /api/posts/:slug/comments` | 提交留言（默认待审核，有频率限制） |
| `POST /api/posts/:slug/like` | 点赞/取消赞（需请求头 `X-Blog-Visitor-Id`：UUID v4，与前端 localStorage 一致） |
| `GET /api/archive` | 归档（按年月分组） |
| `GET /api/search` | 搜索（`?q=`，分页同 posts） |
| `GET /api/categories` | 分类列表 |
| `GET /api/tags` | 标签列表 |
| `GET /api/site` | 站点配置（标题、关于等） |
| `GET /api/links` | 友情链接 |
| `GET /api/rss`（另有 `/api/rss.xml`、`/api/feed`、`/api/feed.xml`） | RSS（最近 20 篇） |
| `GET /api/sitemap`（另有 `/api/sitemap.xml`） | 站点地图 |

### 认证

| 接口 | 说明 |
|------|------|
| `POST /api/auth/login` | 登录（有频率限制，防暴力破解） |
| `POST /api/auth/logout` | 退出 |
| `GET /api/auth/me` | 当前用户 |

### 管理端（需登录 Session）

前缀：`/api/admin`（Cookie 需携带凭证，与前端同域或已配置 CORS）

| 接口 | 说明 |
|------|------|
| `GET/POST/PUT/DELETE .../posts` | 文章 CRUD |
| `POST/PUT/DELETE .../categories`、`.../tags` | 分类、标签 |
| `GET/PUT .../site` | 站点设置 |
| `GET/POST/PUT/DELETE .../links` | 友链 |
| `POST .../upload` | 图片上传 |
| `GET .../comments`、`PUT .../comments/:id`、`DELETE .../comments/:id` | 留言列表与审核、删除 |

## 默认管理员

首次启动且 `users` 表为空时，会根据 `.env` 中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 创建管理员。示例 `.env` 中为 `admin@localhost` / `admin123456`，**生产环境务必修改**。

## 数据库

使用 SQLite（`sql.js`），数据文件默认在 `backend/data/blog.sqlite`。备份时直接复制该文件即可。

## 生产部署检查清单

部署前建议逐项确认：

- [ ] **环境变量**：`NODE_ENV=production`、`SESSION_SECRET`（至少 16 字符）、`ADMIN_*` 已改为强密码；`PUBLIC_SITE_URL` 为线上站点根 URL（RSS / 站点地图链接正确）；`FRONTEND_ORIGIN` 为实际前端来源（CORS）。
- [ ] **HTTPS**：生产环境开启 HTTPS，以便 `cookie.secure` 与 Session 正常工作。
- [ ] **反向代理**：若经 Nginx/Caddy 反代，后端已 `trust proxy`（代码中已设置），并正确传递 `X-Forwarded-*`。
- [ ] **静态与上传**：`/uploads` 由后端或 CDN 提供；前端构建产物由 Nginx 等托管，`/api` 反代到 Node。
- [ ] **数据库**：定期备份 `blog.sqlite`；大流量时可评估迁移 MySQL 等。
- [ ] **回滚**：保留上一版本构建产物或镜像；出问题时可回退 Git 并重新部署。

自动化部署（如 GitHub Actions + SSH）可在上述稳定后再接 CI/CD。
