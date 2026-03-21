<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { admin } from '../../api'

const router = useRouter()
const stats = ref({ posts: 0, drafts: 0, totalVisits: 0, todayVisits: 0 })
const recentPosts = ref([])

onMounted(async () => {
  try {
    const [allRes, draftRes, siteRes] = await Promise.all([
      admin.posts.list({ limit: 1 }),
      admin.posts.list({ limit: 1, status: 'draft' }),
      admin.site.get(),
    ])
    stats.value.posts = allRes.total
    stats.value.drafts = draftRes.total
    stats.value.totalVisits = Number(siteRes?.totalVisits ?? 0) || 0
    stats.value.todayVisits = Number(siteRes?.todayVisits ?? 0) || 0
    const listRes = await admin.posts.list({ limit: 5 })
    recentPosts.value = listRes.data
  } catch {
    // ignore
  }
})

function goToPost(id) {
  router.push(`/admin/posts/${id}/edit`)
}
</script>

<template>
  <div class="dashboard">
    <h1>仪表盘</h1>
    <el-row :gutter="16" style="margin-bottom: 24px">
      <el-col :span="6">
        <el-card>
          <div class="stat">
            <span class="stat-value">{{ stats.posts }}</span>
            <span class="stat-label">文章总数</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat">
            <span class="stat-value">{{ stats.drafts }}</span>
            <span class="stat-label">草稿</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat">
            <span class="stat-value">{{ stats.totalVisits }}</span>
            <span class="stat-label">累计访问</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat">
            <span class="stat-value">{{ stats.todayVisits }}</span>
            <span class="stat-label">今日访问</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-card>
      <template #header>
        <span>最近文章</span>
        <el-button type="primary" link style="float: right" @click="router.push('/admin/posts/new')">
          新建文章
        </el-button>
      </template>
      <el-table :data="recentPosts" @row-click="(r) => goToPost(r.id)">
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新" width="180">
          <template #default="{ row }">
            {{ row.updatedAt ? new Date(row.updatedAt).toLocaleString('zh-CN') : '-' }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard h1 {
  margin: 0 0 24px;
  font-size: 24px;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 32px;
  font-weight: 600;
}

.stat-label {
  font-size: 14px;
  color: var(--text);
}

.el-table {
  cursor: pointer;
}
</style>
