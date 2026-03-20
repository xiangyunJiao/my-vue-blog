<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { marked } from 'marked'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-bash'
import { admin } from '../../api'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const id = computed(() => route.params.id)
const isNew = computed(() => route.name === 'adminPostNew' || route.path.endsWith('/new'))

const form = ref({
  title: '',
  slug: '',
  excerpt: '',
  body_md: '',
  status: 'draft',
  category_id: null,
  tag_ids: [],
  cover_image: '',
  is_pinned: false,
})
const categories = ref([])
const tags = ref([])
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const coverInputRef = ref(null)
const bodyImageInputRef = ref(null)
const bodyPreviewRef = ref(null)
const bodyPreviewLayout = ref('split')

const bodyHtml = computed(() => {
  const md = form.value.body_md || ''
  if (!md.trim()) return '<p class="preview-empty">暂无内容，左侧输入 Markdown 即可预览。</p>'
  return marked.parse(md)
})

async function refreshBodyPreviewHighlight() {
  await nextTick()
  if (bodyPreviewRef.value) {
    Prism.highlightAllUnder(bodyPreviewRef.value)
  }
}

watch(() => form.value.body_md, refreshBodyPreviewHighlight)
watch(bodyPreviewLayout, refreshBodyPreviewHighlight)

async function loadOptions() {
  try {
    const [cRes, tRes] = await Promise.all([
      admin.categories.list(),
      admin.tags.list(),
    ])
    categories.value = cRes.data.data || []
    tags.value = tRes.data.data || []
  } catch {
    // ignore
  }
}

async function loadPost() {
  if (isNew.value) return
  loading.value = true
  try {
    const { data } = await admin.posts.get(id.value)
    form.value = {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt || '',
      body_md: data.bodyMd || '',
      status: data.status,
      category_id: data.categoryId || null,
      tag_ids: (data.tags || []).map((t) => t.id),
      cover_image: data.coverImage || '',
      is_pinned: data.isPinned || false,
    }
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '加载失败')
    router.push('/admin/posts')
  } finally {
    loading.value = false
  }
}

async function handleCoverUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
    ElMessage.warning('仅支持 jpg、png、gif、webp')
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片不超过 2MB')
    return
  }
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await admin.upload(formData)
    form.value.cover_image = data.url
    ElMessage.success('上传成功')
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '上传失败')
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

async function handleBodyImageUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
    ElMessage.warning('仅支持 jpg、png、gif、webp')
    return
  }
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await admin.upload(formData)
    const markdown = `\n![图片](${data.url})\n`
    form.value.body_md = (form.value.body_md || '') + markdown
    ElMessage.success('已插入图片')
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '上传失败')
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

async function handleSave() {
  if (!form.value.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      category_id: form.value.category_id || null,
    }
    if (isNew.value) {
      await admin.posts.create(payload)
      ElMessage.success('创建成功')
    } else {
      await admin.posts.update(id.value, payload)
      ElMessage.success('保存成功')
    }
    router.push('/admin/posts')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

watch(id, loadPost)
onMounted(() => {
  loadOptions()
  loadPost()
})
</script>

<template>
  <div class="post-edit">
    <div class="header">
      <h1>{{ isNew ? '新建文章' : '编辑文章' }}</h1>
      <el-button @click="router.push('/admin/posts')">返回</el-button>
    </div>
    <el-card v-loading="loading">
      <el-form :model="form" label-width="100px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="文章标题" />
        </el-form-item>
        <el-form-item label="Slug">
          <el-input v-model="form.slug" placeholder="留空则自动生成" />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="form.excerpt" type="textarea" :rows="2" placeholder="列表页展示" />
        </el-form-item>
        <el-form-item label="正文" required>
          <div class="body-editor">
            <div class="body-toolbar">
              <el-radio-group v-model="bodyPreviewLayout" size="small">
                <el-radio-button value="split">分栏</el-radio-button>
                <el-radio-button value="edit">仅编辑</el-radio-button>
                <el-radio-button value="preview">仅预览</el-radio-button>
              </el-radio-group>
              <el-button size="small" :loading="uploading" @click="bodyImageInputRef?.value?.click()">
                插入图片
              </el-button>
            </div>
            <input ref="bodyImageInputRef" type="file" accept="image/*" style="display:none" @change="handleBodyImageUpload" />
            <div
              class="body-panes"
              :class="{
                'layout-split': bodyPreviewLayout === 'split',
                'layout-edit': bodyPreviewLayout === 'edit',
                'layout-preview': bodyPreviewLayout === 'preview',
              }"
            >
              <div v-show="bodyPreviewLayout !== 'preview'" class="body-pane body-pane-source">
                <el-input
                  v-model="form.body_md"
                  type="textarea"
                  :autosize="false"
                  placeholder="支持 Markdown"
                  class="body-textarea"
                />
              </div>
              <div v-show="bodyPreviewLayout !== 'edit'" class="body-pane body-pane-preview">
                <div class="preview-label">预览</div>
                <div
                  ref="bodyPreviewRef"
                  class="body-preview-content markdown-body"
                  v-html="bodyHtml"
                />
              </div>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="封面图">
          <div class="cover-editor">
            <el-input v-model="form.cover_image" placeholder="图片 URL 或点击上传" style="flex:1" />
            <el-button :loading="uploading" @click="coverInputRef?.value?.click()">上传</el-button>
            <input ref="coverInputRef" type="file" accept="image/*" style="display:none" @change="handleCoverUpload" />
          </div>
          <img v-if="form.cover_image" :src="form.cover_image" class="cover-preview" alt="" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category_id" placeholder="选择分类" clearable style="width: 200px">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="form.tag_ids" multiple placeholder="选择标签" style="width: 100%">
            <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="draft">草稿</el-radio>
            <el-radio value="published">发布</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="置顶">
          <el-switch v-model="form.is_pinned" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">
            {{ isNew ? '创建' : '保存' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.post-edit .header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.post-edit h1 {
  margin: 0;
  font-size: 24px;
}

.cover-editor {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cover-preview {
  max-width: 200px;
  max-height: 120px;
  object-fit: cover;
  border-radius: 6px;
  margin-top: 8px;
}

.body-editor {
  position: relative;
  width: 100%;
}

.body-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.body-panes {
  width: 100%;
}

.body-panes.layout-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: stretch;
}

@media (max-width: 960px) {
  .body-panes.layout-split {
    grid-template-columns: 1fr;
  }
}

.body-pane-source {
  min-width: 0;
}

.body-textarea :deep(.el-textarea__inner) {
  min-height: 420px;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 14px;
  line-height: 1.55;
  resize: vertical;
}

.body-pane-preview {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.preview-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  text-align: left;
}

.body-preview-content {
  flex: 1;
  min-height: 420px;
  max-height: min(70vh, 720px);
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  text-align: left;
  line-height: 1.7;
  box-sizing: border-box;
}

.body-preview-content :deep(.preview-empty) {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.body-preview-content :deep(h2) {
  font-size: 20px;
  margin: 20px 0 10px;
  color: var(--text-h, var(--el-text-color-primary));
}

.body-preview-content :deep(h3) {
  font-size: 17px;
  margin: 16px 0 8px;
  color: var(--text-h, var(--el-text-color-primary));
}

.body-preview-content :deep(p) {
  margin: 0 0 12px;
}

.body-preview-content :deep(pre) {
  background: var(--code-bg, var(--el-fill-color-light));
  padding: 12px 14px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
}

.body-preview-content :deep(code) {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 13px;
}

.body-preview-content :deep(pre code) {
  padding: 0;
  background: none;
}

.body-preview-content :deep(ul),
.body-preview-content :deep(ol) {
  margin: 0 0 12px;
  padding-left: 22px;
}

.body-preview-content :deep(blockquote) {
  margin: 12px 0;
  padding-left: 14px;
  border-left: 4px solid var(--accent, var(--el-color-primary));
  color: var(--el-text-color-regular);
}

.body-preview-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
</style>
