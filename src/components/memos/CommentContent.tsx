import { sanitizeCommentHtml } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

// Renders an approval / rejection comment. Handles both rich-text (HTML) and legacy plain-text comments.
export default function CommentContent({ value, className }: { value: string | null | undefined; className?: string }) {
    return (
        <div
            className={cn('memo-content comment-content', className)}
            dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(value) }}
        />
    );
}
