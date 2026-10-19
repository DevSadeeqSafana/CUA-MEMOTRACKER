// Helpers for short rich-text fields (approval / rejection comments) produced by CommentEditor.
// Older comments were stored as plain text, so every helper accepts both forms.

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'a', 'blockquote']);

const HTML_TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;

export function isHtml(value: string | null | undefined): boolean {
    return !!value && HTML_TAG.test(value);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Allowlist sanitizer: keeps the formatting tags the comment editor can produce, drops every
// attribute except a safe href on links, and removes everything else (scripts, images, styles...).
export function sanitizeCommentHtml(value: string | null | undefined): string {
    if (!value) return '';
    if (!isHtml(value)) return escapeHtml(value).replace(/\n/g, '<br>');

    return value
        .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (_, slash: string, rawTag: string, attrs: string) => {
            const tag = rawTag.toLowerCase();
            if (!ALLOWED_TAGS.has(tag)) return '';
            if (slash) return `</${tag}>`;
            if (tag === 'a') {
                const href = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
                const url = (href?.[2] ?? href?.[3] ?? '').trim();
                if (!/^(https?:|mailto:)/i.test(url)) return '<a>';
                return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">`;
            }
            return `<${tag}>`;
        });
}

// Plain-text version for emails, audit strings and one-line previews.
export function commentToPlainText(value: string | null | undefined): string {
    if (!value) return '';
    if (!isHtml(value)) return value.trim();

    return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '\n• ')
        .replace(/<\/(p|li|blockquote|ul|ol)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

// True when the comment has no visible text (e.g. the editor's empty "<p></p>").
export function isCommentEmpty(value: string | null | undefined): boolean {
    return commentToPlainText(value).length === 0;
}
