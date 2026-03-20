---
name: personal-blog-zero-to-deploy
description: >-
  Builds a personal blog from scratch to automated deployment: Node/Express API,
  SQLite or MySQL, Vue or static frontend, admin auth, posts/tags/categories,
  RSS/sitemap, optional comments and CI/CD. Use when the user wants to create or
  extend a personal blog, full-stack blog tutorial, zero-to-production blog, or
  phased deployment with GitHub Actions; or mentions blog CRUD, markdown backend,
  or VPS deploy for my-vue-blog.
---

# 个人博客：从零到自动化部署（分阶段 Skill）

## 使用方式

- **按阶段顺序推进**：完成当前阶段的「验收」后再进入下一阶段。用户可随时说「跳过某功能」或「加某功能」，应更新后续步骤的待办并继续。
- **代码由 Agent 生成**：每个阶段产出可运行、可提交的代码；遵循项目已有风格与目录。
- **详细功能清单与扩展表**见 [reference.md](reference.md)。

## 技术默认

| 层级 | 默认选型 | 可调 |
|------|----------|------|
| 运行时 | Node LTS + Express | Fastify 等需用户明确要求 |
| 数据库 | **SQLite**（`better-sqlite3`）或 **MySQL**（`mysql2`） | 用户指定则遵守 |
| 前端 | 与仓库现有 Vue 前端对接 REST API | 可仅后端 |
| 密码 | `bcrypt` | — |
| 会话 | 管理端 `express-session` + cookie，或 JWT | 用户指定 |

## 阶段总览（_checkpoint 驱动）

```
[ ] 阶段 0 — 仓库与约定
[ ] 阶段 1 — Express 骨架与健康检查
[ ] 阶段 2 — 数据库、迁移、种子管理员
[ ] 阶段 3 — 文章 / 分类 / 标签（核心 CRUD + 公开读）
[ ] 阶段 4 — 管理端认证与受保护路由
[ ] 阶段 5 — Markdown、摘要、slug 唯一性
[ ] 阶段 6 — 前端对接（列表、详情、管理可选页）
[ ] 阶段 7 — RSS、站点地图、可选搜索
[ ] 阶段 8 — 图片上传与静态资源（可选）
[ ] 阶段 9 — 测试与生产配置（env、CORS、信任代理）
[ ] 阶段 10 — 自动化部署（GitHub Actions + VPS 或 Docker）
```

---

## 阶段 0：仓库与约定

**目标**：前后端目录清晰、环境变量约定一致。

**步骤**

1. 确认结构（与现有仓库对齐，可微调）：
   - `backend/`：`package.json`、入口 `src/index.js` 或 `src/server.js`、`src/routes/`、`src/db/`、`src/middleware/`
   - `frontend/`：现有 Vue 应用
   - 根目录：`README.md` 说明如何本地启动前后端
2. 添加根级或 `backend/.env.example`：`PORT`、`DATABASE_URL` 或 `MYSQL_*`、`SESSION_SECRET`、`NODE_ENV`
3. `.gitignore`：`node_modules/`、`backend/.env`、`backend/*.sqlite`、`uploads/`（若使用）

**验收**：文档中能两步启动（装依赖 + 一条命令跑后端）；无密钥进 Git。

---

## 阶段 1：Express 骨架与健康检查

**目标**：可启动的 HTTP 服务，便于联调与部署探活。

**步骤**

1. `backend`：`express`、`cors`、`morgan`（或 `pino-http`）；`json` 中间件；统一错误处理中间件（返回 JSON，生产不泄露堆栈细节）。
2. `GET /api/health` → `{ "ok": true, "time": ISO8601 }`。
3. `package.json`：`"start": "node src/index.js"`，`"dev": "node --watch src/index.js"`（Node 18+）或 `nodemon`。

**验收**：`curl` 访问 health 返回 200 JSON。

---

## 阶段 2：数据库与迁移

**目标**：可重复初始化库表；可选种子管理员。

**步骤**

1. 选 SQLite：`better-sqlite3` + 单文件路径；或 MySQL：`mysql2` 连接池 + 建库说明。
2. 迁移方式任选其一（保持简单）：按序执行 `db/migrations/001_init.sql`…，或启动时检查版本表 `schema_migrations`。
3. 最小表（可按 reference 扩展）：
   - `users`：id, email 唯一, password_hash, created_at
   - `categories`：id, name, slug 唯一
   - `tags`：id, name, slug 唯一
   - `posts`：id, title, slug 唯一, excerpt, body_md, status(draft|published), category_id 可空, published_at 可空, created_at, updated_at
   - `post_tags`：post_id, tag_id 联合主键
4. 种子：一个管理员用户（密码来自环境变量或首次启动提示，禁止写死弱密码进仓库）。

**验收**：清空库后重启应用能自动建表；能查询到种子用户（若启用）。

---

## 阶段 3：文章与分类、标签 API

**目标**：公开读接口完整；写接口可先占位或由阶段 4 保护。

**步骤**

1. 公开 `GET /api/posts`：分页 `?page=&limit=`，仅 `published`，按 `published_at` 降序。
2. 公开 `GET /api/posts/:slug`：单篇已发布；404 规范 JSON。
3. `GET /api/categories`、`GET /api/tags`：列表即可。
4. 管理用 CRUD（若阶段 4 未到）：可先 `POST/PUT/DELETE` 返回 401，或临时开放仅开发环境（必须在阶段 4 关闭）。

**验收**：无登录可拉列表与详情；分页正确；SQL 全部参数化。

---

## 阶段 4：管理端认证

**目标**：仅管理员可改文章与元数据。

**步骤**

1. `POST /api/auth/login`：校验邮箱/密码，建立 session（或签发 JWT）。
2. `POST /api/auth/logout`、`GET /api/auth/me`。
3. 中间件 `requireAuth` 保护 `POST/PUT/DELETE` 文章、分类、标签。
4. 生产：`cookie.secure`、`sameSite`，`SESSION_SECRET` 必填校验。

**验收**：未登录写操作 401；登录后 CRUD 成功；密码不以明文存储或返回。

---

## 阶段 5：Markdown 与业务规则

**目标**：内容安全与 URL 稳定。

**步骤**

1. 正文存 Markdown；列表返回 excerpt 或截断；详情可返回 `body_md` 与可选 `body_html`（若服务端渲染 HTML，必须用可信 sanitize）。
2. `slug`：创建/更新时唯一校验；冲突返回 409。
3. 发布：`status=published` 时写 `published_at`（若为空则设为当前时间）。

**验收**：XSS 试样不执行（若返回 HTML）；slug 冲突可测。

---

## 阶段 6：前端对接

**目标**：读者端能浏览；管理端可后续再做。

**步骤**

1. 前端配置 `VITE_API_BASE`（或等价）指向后端。
2. 文章列表页、详情页调用公开 API；错误与加载状态处理。
3. （可选）简单管理登录 + 文章编辑页，或说明用 Postman/Thunder Client 直到管理 UI 完成。

**验收**：本地前后端联调可读完文章。

---

## 阶段 7：RSS、站点地图、搜索（可选）

**步骤**

1. `GET /rss.xml` 或 `/feed`：最近 N 篇已发布。
2. `GET /sitemap.xml`：站点基础 URL 来自环境变量 `PUBLIC_SITE_URL`。
3. 搜索：`GET /api/search?q=` 实现最小可用（`LIKE` 或全文），注意分页与注入防护。

**验收**：RSS 与 sitemap 可被浏览器与验证器打开。

---

## 阶段 8：图片上传（可选）

**步骤**

1. `POST /api/upload`（受保护）：`multer`，限制扩展名与大小；返回公开 URL 路径。
2. 静态挂载 `uploads/`；生产建议 CDN 或对象存储（文档中说明迁移路径）。

**验收**：上传后文章可引用图片 URL。

---

## 阶段 9：生产就绪

**步骤**

1. `NODE_ENV=production` 下禁用详细错误；信任反向代理 `app.set('trust proxy', 1)`（若 Nginx）。
2. CORS：仅允许前端源。
3. 速率限制：登录接口 `express-rate-limit`（可选但推荐）。
4. README：环境变量清单、数据库备份提示（SQLite 文件拷贝、MySQL `mysqldump`）。

**验收**：检查清单在 README 中可勾选。

---

## 阶段 10：自动化部署

**默认叙述**：GitHub 仓库 + VPS；主分支 push 触发部署。

**步骤**

1. 仓库 Secrets：`SSH_PRIVATE_KEY`、`HOST`、`USER`、`DEPLOY_PATH`（按需）。
2. Workflow：checkout → SSH `cd $DEPLOY_PATH && git pull && cd backend && npm ci --omit=dev && pm2 reload ecosystem.config.cjs`（或 `systemctl restart blog-api`）。
3. 服务器：Node、pm2 或 systemd；Nginx 反代 `/api` 到 `127.0.0.1:PORT`；前端 `npm run build` 产物由 Nginx 托管或同机静态目录。
4. （可选）`Dockerfile` + `docker compose` 将应用与 MySQL 一并编排。

**验收**：推送代码后服务更新且 health 通过；回滚步骤写在 README（如 `git revert` + 再部署）。

---

## Agent 执行原则

1. **安全优先**：SQL 参数化、输出转义或 sanitize、密钥仅 env、管理接口必须认证。
2. **可维护**：目录与命名一致；迁移可重复执行；不写无意义吞异常。
3. **与用户同步**：每阶段结束前用简短列表汇报「已完成 / 待用户配置（如 MySQL 密码）」。
4. **用户改需求时**：在对话中更新阶段范围，不必重写完整个 Skill 文件，优先改待办与下一批代码。

## 附加资源

- [reference.md](reference.md)：功能矩阵、库表扩展、部署形态补充。
