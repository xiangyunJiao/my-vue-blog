<script setup>
import CommentThread from './CommentThread.vue'

defineProps({
  node: { type: Object, required: true },
  formatDate: { type: Function, required: true },
})

const emit = defineEmits(['reply'])
</script>

<template>
  <li class="comment-branch">
    <article class="comment-card">
      <div class="comment-meta">
        <strong>{{ node.authorName }}</strong>
        <time>{{ formatDate(node.createdAt) }}</time>
        <span v-if="node.parentAuthorName" class="comment-reply-to">回复 {{ node.parentAuthorName }}</span>
      </div>
      <p class="comment-body">{{ node.body }}</p>
      <button type="button" class="comment-reply-btn" @click="emit('reply', node)">回复</button>
    </article>
    <ul v-if="node.children?.length" class="comment-replies">
      <CommentThread
        v-for="ch in node.children"
        :key="ch.id"
        :node="ch"
        :format-date="formatDate"
        @reply="emit('reply', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.comment-branch {
  list-style: none;
}

.comment-card {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  /* 与全局 18px 脱钩，避免正文巨大、昵称仍偏小 */
  font-size: 14px;
  line-height: 1.55;
  color: var(--text);
}

.comment-branch:last-child > .comment-card {
  border-bottom: none;
}

.comment-replies {
  list-style: none;
  padding: 0;
  margin: 0 0 0 12px;
  padding-left: 14px;
  border-left: 2px solid var(--border);
}

.comment-replies .comment-card {
  border-bottom: 1px solid var(--border);
}

.comment-replies .comment-branch:last-child .comment-card {
  border-bottom: none;
}

.comment-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  margin-bottom: 6px;
}

.comment-meta strong {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}

.comment-meta time {
  font-size: 13px;
  opacity: 0.82;
}

.comment-reply-to {
  font-size: 13px;
  opacity: 0.88;
}

.comment-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-reply-btn {
  display: block;
  margin-top: 8px;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.comment-reply-btn:hover {
  opacity: 0.88;
}
</style>
