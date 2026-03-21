/** 扩展 RouteMeta；须单独文件并 import，避免覆盖 vue-router 导出 */
import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}
