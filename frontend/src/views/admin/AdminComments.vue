<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { admin } from '../../api'
import { formatApiError } from '../../utils/apiError'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()

const statusFilter = ref('pending')
const rows = ref([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const params = {}
    if (statusFilter.value !== 'all') params.status = statusFilter.value
    const { data } = await admin.comments.list({ params })
    rows.value = data.data || []
  } catch (e) {
    ElMessage.error(formatApiError(e, '加载失败'))
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(statusFilter, load)
onMounted(load)

async function setStatus(row, status) {
  try {
    await admin.comments.update(row.id, { status })
    ElMessage.success('已更新')
    await load()
  } catch (e) {
    ElMessage.error(formatApiError(e, '操作失败'))
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确定删除这条留言？', '确认', { type: 'warning' })
    await admin.comments.remove(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(formatApiError(e, '删除失败'))
  }
}

function openPost(slug) {
  const href = router.resolve({ name: 'post', params: { slug } }).href
  window.open(href, '_blank')
}
</script>

<template>
  <div class="admin-comments">
    <h1>留言管理</h1>
    <p class="hint">读者提交的留言默认为「待审核」，通过后才会在文章页展示。</p>

    <el-radio-group v-model="statusFilter" class="filter">
      <el-radio-button value="pending">待审核</el-radio-button>
      <el-radio-button value="approved">已通过</el-radio-button>
      <el-radio-button value="rejected">已拒绝</el-radio-button>
      <el-radio-button value="all">全部</el-radio-button>
    </el-radio-group>

    <el-table v-loading="loading" :data="rows" stripe style="width: 100%; margin-top: 16px">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="文章" min-width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openPost(row.postSlug)">{{ row.postTitle }}</el-button>
        </template>
      </el-table-column>
      <el-table-column prop="authorName" label="昵称" width="120" />
      <el-table-column prop="authorEmail" label="邮箱" width="180" show-overflow-tooltip />
      <el-table-column prop="body" label="内容" min-width="220" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="90" />
      <el-table-column prop="createdAt" label="时间" width="170" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status !== 'approved'"
            link
            type="success"
            size="small"
            @click="setStatus(row, 'approved')"
          >通过</el-button>
          <el-button
            v-if="row.status !== 'rejected'"
            link
            type="warning"
            size="small"
            @click="setStatus(row, 'rejected')"
          >拒绝</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.admin-comments h1 {
  margin: 0 0 8px;
  font-size: 22px;
}
.hint {
  color: var(--el-text-color-secondary);
  margin: 0 0 16px;
  font-size: 14px;
}
.filter {
  margin-bottom: 8px;
}
</style>
