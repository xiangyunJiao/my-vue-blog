import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'pre', 'code']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    a: ['href', 'name', 'target', 'rel'],
    code: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export function markdownToSafeHtml(md: unknown): string {
  if (!md || typeof md !== 'string') return '';
  const raw = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(raw, sanitizeOptions);
}
