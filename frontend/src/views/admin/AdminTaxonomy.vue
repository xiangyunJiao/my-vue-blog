<script setup>
import { ref, onMounted } from 'vue'
import { admin } from '../../api'
import { formatApiError } from '../../utils/apiError'
import { ElMessage, ElMessageBox } from 'element-plus'

const categories = ref([])
const tags = ref([])
const loading = ref(false)

const dialogVisible = ref(false)
const dialogType = ref('category') // 'category' | 'tag'
const dialogMode = ref('create') // 'create' | 'edit'
const editingId = ref(null)
const form = ref({ name: '', slug: '' })

/** 列表接口可能返回 number / string / bigint 等形式的 id */
function toPositiveIntId(raw) {
  if (raw == null || raw === '') return NaN
  if (typeof raw === 'bigint') return Number(raw)
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : NaN
}

async function load() {
  loading.value = true
  try {
    const [cRes, tRes] = await Promise.all([admin.categories.list(), admin.tags.list()])
    categories.value = cRes.data || []
    tags.value = tRes.data || []
  } catch (e) {
    ElMessage.error(formatApiError(e, '加载失败'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate(type) {
  dialogType.value = type
  dialogMode.value = 'create'
  editingId.value = null
  form.value = { name: '', slug: '' }
  dialogVisible.value = true
}

function openEdit(type, row) {
  const id = toPositiveIntId(row.id)
  if (Number.isNaN(id)) {
    ElMessage.error('数据异常，请刷新页面后重试')
    return
  }
  dialogType.value = type
  dialogMode.value = 'edit'
  editingId.value = id
  form.value = { name: row.name, slug: row.slug }
  dialogVisible.value = true
}

async function submitForm() {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.warning('请填写名称')
    return
  }
  if (dialogMode.value === 'edit') {
    const eid = editingId.value
    if (eid == null || Number.isNaN(toPositiveIntId(eid))) {
      ElMessage.error('数据异常，请刷新页面后重试')
      return
    }
  }
  const slug = form.value.slug.trim() || undefined
  const payload = slug ? { name, slug } : { name }
  try {
    if (dialogType.value === 'category') {
      if (dialogMode.value === 'create') {
        await admin.categories.create(payload)
        ElMessage.success('已创建分类')
      } else {
        await admin.categories.save(toPositiveIntId(editingId.value), payload)
        ElMessage.success('已更新分类')
      }
    } else {
      if (dialogMode.value === 'create') {
        await admin.tags.create(payload)
        ElMessage.success('已创建标签')
      } else {
        await admin.tags.save(toPositiveIntId(editingId.value), payload)
        ElMessage.success('已更新标签')
      }
    }
    dialogVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(formatApiError(e, '保存失败'))
  }
}

async function removeCategory(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除分类「${row.name}」？若文章正在使用，请先修改文章后再删。`,
      '确认删除',
      { type: 'warning' }
    )
    const id = toPositiveIntId(row.id)
    if (Number.isNaN(id)) {
      ElMessage.error('数据异常，请刷新页面后重试')
      return
    }
    await admin.categories.remove(id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(formatApiError(e, '删除失败'))
  }
}

async function removeTag(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除标签「${row.name}」？若文章正在使用，请先修改文章后再删。`,
      '确认删除',
      { type: 'warning' }
    )
    const id = toPositiveIntId(row.id)
    if (Number.isNaN(id)) {
      ElMessage.error('数据异常，请刷新页面后重试')
      return
    }
    await admin.tags.remove(id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(formatApiError(e, '删除失败'))
  }
}
</script>

<template>
  <div class="admin-taxonomy">
    <h1>分类与标签</h1>
    <p class="hint">
      在此新建后，可在「文章编辑」里为文章选择分类与标签。slug 用于 URL（如
      <code>/category/xxx</code>），留空则根据名称自动生成。
    </p>

    <section class="block">
      <div class="block-head">
        <h2>分类</h2>
        <el-button type="primary" size="small" @click="openCreate('category')">新建分类</el-button>
      </div>
      <el-table v-loading="loading" :data="categories" stripe size="small" style="width: 100%">
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="slug" label="slug" min-width="160" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit('category', row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="removeCategory(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="block">
      <div class="block-head">
        <h2>标签</h2>
        <el-button type="primary" size="small" @click="openCreate('tag')">新建标签</el-button>
      </div>
      <el-table v-loading="loading" :data="tags" stripe size="small" style="width: 100%">
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="slug" label="slug" min-width="160" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit('tag', row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="removeTag(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? (dialogType === 'category' ? '新建分类' : '新建标签') : (dialogType === 'category' ? '编辑分类' : '编辑标签')"
      width="420px"
      destroy-on-close
      @closed="form = { name: '', slug: '' }"
    >
      <el-form label-position="top">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="显示名称" maxlength="128" show-word-limit />
        </el-form-item>
        <el-form-item label="slug（可选）">
          <el-input v-model="form.slug" placeholder="英文或拼音，用于 URL；可留空" maxlength="128" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-taxonomy h1 {
  margin: 0 0 8px;
  font-size: 22px;
}
.hint {
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.5;
}
.hint code {
  font-size: 13px;
  padding: 2px 6px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
.block {
  margin-bottom: 40px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.block-head h2 {
  margin: 0;
  font-size: 17px;
}
</style>
