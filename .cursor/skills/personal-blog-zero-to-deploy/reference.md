# 个人博客：功能清单与扩展参考

供分阶段实现时勾选与裁剪。Agent 应按用户当前阶段只实现相关子集，避免一次铺开过多。

## 核心内容

| 模块 | 能力 | 说明 |
|------|------|------|
| 文章 | 列表、详情、创建、编辑、删除 | 支持草稿 / 已发布；唯一 `slug`；`published_at` |
| 分类 | CRUD、文章关联 | 可选层级（初期单层即可） |
| 标签 | CRUD、多对多 | slug 化便于 URL |
| Markdown | 存储原文、渲染 HTML | 服务端 `marked` + `sanitize`（防 XSS）或仅 API 返回 md 由前端渲染 |
| 摘要 | excerpt 字段或自动生成 | 列表页展示 |

## 站点与发现

| 模块 | 能力 |
|------|------|
| RSS/Atom | `/feed.xml` 或 `/rss` |
| 站点地图 | `/sitemap.xml`（文章 URL + 更新频率） |
| 搜索 | 标题/摘要/正文关键词（SQLite FTS5 或 MySQL FULLTEXT，初期可用 `LIKE`） |

## 管理端

| 模块 | 能力 |
|------|------|
| 登录 | 邮箱+密码或仅用户名；Session（cookie）或 JWT；HTTPS 生产环境必配 |
| 仪表盘 | 文章数、最近草稿、快捷入口 |
| 媒体 | 上传图片、限制类型与大小、存本地 `uploads/` 或对象存储 URL |

## 互动（可选）

| 模块 | 能力 |
|------|------|
| 评论 | 匿名或昵称+邮箱；反垃圾（简单：审核开关、频率限制） |

## 非功能

- **安全**：参数化查询、密码 `bcrypt`、Cookie `httpOnly`/`secure`、CORS 白名单、上传校验
- **配置**：`.env` 不放仓库；示例用 `.env.example`
- **迁移**：`db/migrations` 顺序执行或单文件版本表
- **日志**：`morgan` 或 `pino`，生产不打印敏感信息

## 数据库选型速查

- **SQLite**：单机、零运维、适合 VPS 小流量；文件路径配置在 `DATABASE_URL` 或 `SQLITE_PATH`


## 自动化部署常见形态

1. **GitHub Actions**：push 主分支 → SSH 到 VPS → `git pull` → `npm ci` → `pm2 reload`
2. **Docker**：`Dockerfile` + Compose（app + MySQL）；CI 构建镜像推 Registry 再部署
3. **前后端分离**：前端静态托管（如 GitHub Pages / CDN），仅 API 在 VPS

用户可在任意阶段改选方案；Skill 主流程以「VPS + systemd/pm2 + 可选 Docker」为默认叙述。
