/**
 * 生成 URL slug：小写、空格转连字符、移除非单词字符
 */
function slugify(input) {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = { slugify };
