<script setup lang="ts">
import { onMounted } from 'vue';
import { site } from './api';

onMounted(() => {
  site.trackVisit().catch(() => {
    /* 静默失败，不影响阅读 */
  });
});
</script>

<template>
  <RouterView />
</template>
