import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /**
   * 必须从「本配置文件所在目录」加载 .env，而不是 process.cwd()。
   * 若在仓库根目录执行 `vite --config frontend/vite.config.ts`，cwd 为根目录时会误读根目录 .env，
   * 导致 VITE_DEV_API_PROXY 未生效、代理指向错误端口，从而出现 POST /api/... 404。
   */
  const env = loadEnv(mode, __dirname, '');
  /** 与 backend/.env 的 PORT 一致；未设置 VITE_DEV_API_PROXY 时默认 3000 */
  const apiTarget = (env.VITE_DEV_API_PROXY || 'http://127.0.0.1:3000').replace(/\/$/, '');

  /** 未配置 VITE_API_BASE 时走代理；配置了则 axios 直连后端，此处仍代理 /uploads 等相对路径资源 */
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
  } as const;

  return {
    root: __dirname,
    plugins: [vue()],
    server: { proxy },
    preview: { proxy },
  };
});
