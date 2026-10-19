'use client';

import { useEffect, useState } from 'react';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    List,
    ListOrdered,
    Quote,
    Link as LinkIcon,
    Unlink,
    Undo,
    Redo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isCommentEmpty } from '@/lib/rich-text';

interface CommentEditorProps {
    value: string;
    // Receives the editor HTML, or '' when the comment has no text
    onChange: (html: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    // 'dark' for use on the navy decision panel
    variant?: 'light' | 'dark';
    className?: string;
}

function readToolbarState(editor: Editor) {
    return {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        blockquote: editor.isActive('blockquote'),
        link: editor.isActive('link'),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
    };
}

const Btn = ({ dark, onClick, active, disabled, title, children }: {
dark: boolean;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) => (
    <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        aria-pressed={active}
        className={cn(
            'p-1.5 rounded-lg transition-colors disabled:opacity-30',
            dark
                ? active ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                : active ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-800'
        )}
    >
        {children}
    </button>
);

const Sep = ({ dark }: { dark: boolean }) => <span className={cn('w-px h-5 mx-1', dark ? 'bg-white/10' : 'bg-slate-200')} />;

export default function CommentEditor({
    value,
    onChange,
    placeholder = 'Type here...',
    autoFocus = false,
    variant = 'light',
    className,
}: CommentEditorProps) {
    const dark = variant === 'dark';

    const editor = useEditor({
        immediatelyRender: false,
        autofocus: autoFocus ? 'end' : false,
        extensions: [
            StarterKit.configure({
                link: false,
                heading: false,
                codeBlock: false,
                code: false,
                horizontalRule: false,
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: 'https',
            }),
            Placeholder.configure({ placeholder }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: cn('memo-content comment-editor focus:outline-none', dark && 'comment-editor-dark'),
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange(isCommentEmpty(html) ? '' : html);
        },
    });

    // Keep the editor in sync when the parent clears the value (e.g. after submit)
    useEffect(() => {
        if (editor && value === '' && !editor.isEmpty) {
            editor.commands.clearContent();
        }
    }, [editor, value]);

    const selected = useEditorState({
        editor,
        selector: ({ editor }) => (editor ? readToolbarState(editor) : null),
    });
    const state = selected ?? (editor ? readToolbarState(editor) : null);

    const [linkOpen, setLinkOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    if (!editor || !state) {
        return null;
    }

    const applyLink = () => {
        const url = linkUrl.trim();
        if (url) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        } else {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        }
        setLinkOpen(false);
        setLinkUrl('');
    };

    return (
        <div
            className={cn(
                'rounded-2xl border overflow-hidden transition-all focus-within:ring-4',
                dark
                    ? 'bg-white/5 border-white/10 text-white focus-within:ring-red-500/20 focus-within:border-red-500/50'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus-within:ring-blue-500/10 focus-within:border-blue-500',
                className
            )}
        >
            <div className={cn('flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b', dark ? 'border-white/10' : 'border-slate-200 bg-white/60')}>
                <Btn dark={dark} onClick={() => editor.chain().focus().toggleBold().run()} active={state.bold} title="Bold (Ctrl+B)"><Bold size={15} /></Btn>
                <Btn dark={dark} onClick={() => editor.chain().focus().toggleItalic().run()} active={state.italic} title="Italic (Ctrl+I)"><Italic size={15} /></Btn>
                <Btn dark={dark} onClick={() => editor.chain().focus().toggleUnderline().run()} active={state.underline} title="Underline (Ctrl+U)"><UnderlineIcon size={15} /></Btn>
                <Btn dark={dark} onClick={() => editor.chain().focus().toggleStrike().run()} active={state.strike} title="Strikethrough"><Strikethrough size={15} /></Btn>
                <Sep dark={dark} />
                <Btn dark={dark} onClick={() => editor.chain().focus().toggleBulletList().run()} active={state.bulletList} title="Bulleted list"><List size={15} /></Btn>
                <Btn dark={dark} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={state.orderedList} title="Numbered list"><ListOrdered size={15} /></Btn>
                <Btn dark={dark} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={state.blockquote} title="Quote"><Quote size={15} /></Btn>
                <Sep dark={dark} />
                <Btn
                    dark={dark}
                    onClick={() => {
                        setLinkUrl(editor.getAttributes('link').href ?? '');
                        setLinkOpen(o => !o);
                    }}
                    active={state.link || linkOpen}
                    title="Link"
                >
                    <LinkIcon size={15} />
                </Btn>
                {state.link && (
                    <Btn dark={dark} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()} title="Remove link"><Unlink size={15} /></Btn>
                )}
                <Sep dark={dark} />
                <Btn dark={dark} onClick={() => editor.chain().focus().undo().run()} disabled={!state.canUndo} title="Undo (Ctrl+Z)"><Undo size={15} /></Btn>
                <Btn dark={dark} onClick={() => editor.chain().focus().redo().run()} disabled={!state.canRedo} title="Redo (Ctrl+Shift+Z)"><Redo size={15} /></Btn>
            </div>

            {linkOpen && (
                <div className={cn('flex items-center gap-2 px-3 py-2 border-b', dark ? 'border-white/10' : 'border-slate-200 bg-white')}>
                    <input
                        type="url"
                        autoFocus
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                            if (e.key === 'Escape') { e.preventDefault(); setLinkOpen(false); }
                        }}
                        placeholder="https://..."
                        className={cn(
                            'flex-1 text-sm px-3 py-1.5 rounded-lg outline-none border',
                            dark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30' : 'bg-slate-50 border-slate-200'
                        )}
                    />
                    <button
                        type="button"
                        onClick={applyLink}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#1a5aa6] text-white hover:bg-[#0b2a5b]"
                    >
                        Apply
                    </button>
                </div>
            )}

            <EditorContent
                editor={editor}
                className={cn('px-5 py-4 text-sm font-medium', dark && '[&_.ProseMirror_a]:text-blue-300')}
            />

            <style jsx global>{`
        .comment-editor {
          min-height: 110px;
          max-height: 280px;
          overflow-y: auto;
        }
        .comment-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #cbd5e1;
          pointer-events: none;
          height: 0;
        }
        .comment-editor-dark p.is-editor-empty:first-child::before {
          color: rgb(255 255 255 / 0.2);
        }
      `}</style>
        </div>
    );
}
