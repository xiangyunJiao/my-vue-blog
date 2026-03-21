/// <reference types="vite/client" />

/** 必须先导入模块，再 declare module，否则会覆盖 vue-router 原有导出 */
import 'vue-router';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}
