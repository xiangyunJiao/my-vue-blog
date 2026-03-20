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

API 默认运行在 `http://localhost:3000`。

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`。开发时 Vite 会将 `/api` 代理到后端，无需额外配置。

**注意**：需同时启动后端，否则文章列表会加载失败。

## 管理后台

前端提供可视化管理界面：

- 访问 `http://localhost:5173/admin` 进入管理后台
- 未登录会跳转到 `/admin/login`
- 默认账号：`admin@localhost` / `admin123456`（与 `.env` 中 `ADMIN_EMAIL`、`ADMIN_PASSWORD` 一致）
- 支持：仪表盘、文章列表、新建/编辑文章、退出登录

## API 概览

| 接口 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/posts` | 文章列表（已发布，分页） |
| `GET /api/posts/:slug` | 文章详情（已发布） |
| `GET /api/categories` | 分类列表 |
| `GET /api/tags` | 标签列表 |
| `POST /api/auth/login` | 登录 |
| `POST /api/auth/logout` | 退出 |
| `GET /api/auth/me` | 当前用户 |
| `GET/POST/PUT/DELETE /api/admin/posts` | 文章管理（需登录） |
| `POST/PUT/DELETE /api/admin/categories` | 分类管理 |
| `POST/PUT/DELETE /api/admin/tags` | 标签管理 |

## 默认管理员

首次启动且 `users` 表为空时，会根据 `.env` 中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 创建管理员。示例 `.env` 中为 `admin@localhost` / `admin123456`，**生产环境务必修改**。

## 数据库

使用 SQLite（`sql.js`），数据文件默认在 `backend/data/blog.sqlite`。备份时直接复制该文件即可。
