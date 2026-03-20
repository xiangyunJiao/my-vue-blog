<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
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
            <el-input v-model="form.body_md" type="textarea" :rows="16" placeholder="支持 Markdown" />
            <el-button size="small" :loading="uploading" @click="bodyImageInputRef?.value?.click()" class="insert-img-btn">
              插入图片
            </el-button>
            <input ref="bodyImageInputRef" type="file" accept="image/*" style="display:none" @change="handleBodyImageUpload" />
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
}

.insert-img-btn {
  margin-top: 8px;
}
</style>
