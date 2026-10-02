'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { CharacterCount } from '@tiptap/extensions';
import { MemoReference } from '@/components/memos/MemoReference';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Subscript as SubscriptIcon,
    Superscript as SuperscriptIcon,
    List,
    ListOrdered,
    ListChecks,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Quote,
    Code2,
    Minus,
    Link as LinkIcon,
    Unlink,
    ExternalLink,
    Table as TableIcon,
    Baseline,
    Highlighter,
    RemoveFormatting,
    ChevronDown,
    Undo,
    Redo,
    Check,
    Trash2,
    Rows3,
    Columns3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    className?: string;
}

const TEXT_COLORS = ['#0f172a', '#475569', '#0b2a5b', '#1a5aa6', '#15803d', '#b45309', '#b91c1c', '#7e22ce'];
const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e2e8f0'];

const BLOCK_TYPES = [
    { label: 'Normal text', level: 0 },
    { label: 'Heading 1', level: 1 },
    { label: 'Heading 2', level: 2 },
    { label: 'Heading 3', level: 3 },
] as const;

const MenuButton = ({
    onClick,
    isActive = false,
    disabled = false,
    title,
    children
}: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        aria-pressed={isActive}
        className={cn(
            "h-8 min-w-8 px-1.5 inline-flex items-center justify-center rounded-md transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
        )}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-px h-6 bg-border mx-1" />;

// Small dropdown anchored under a toolbar button; closes on outside click or Escape
function Popover({
    trigger,
    title,
    isActive,
    children,
}: {
    trigger: React.ReactNode;
    title: string;
    isActive?: boolean;
    children: (close: () => void) => React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <MenuButton onClick={() => setOpen(o => !o)} isActive={isActive || open} title={title}>
                {trigger}
            </MenuButton>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-card border rounded-lg shadow-lg p-2 min-w-max">
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    );
}

function Swatches({
    colors,
    active,
    onPick,
    onClear,
    clearLabel,
}: {
    colors: string[];
    active?: string;
    onPick: (c: string) => void;
    onClear: () => void;
    clearLabel: string;
}) {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
                {colors.map(c => (
                    <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => onPick(c)}
                        className="w-7 h-7 rounded-md border border-black/10 flex items-center justify-center"
                        style={{ backgroundColor: c }}
                    >
                        {active?.toLowerCase() === c && <Check size={14} className="text-white mix-blend-difference" />}
                    </button>
                ))}
            </div>
            <button
                type="button"
                onClick={onClear}
                className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md py-1"
            >
                {clearLabel}
            </button>
        </div>
    );
}

function LinkForm({ editor, close }: { editor: Editor; close: () => void }) {
    const [url, setUrl] = useState<string>(editor.getAttributes('link').href ?? '');

    const apply = () => {
        const href = url.trim();
        const chain = editor.chain().focus().extendMarkRange('link');
        if (!href) {
            chain.unsetLink().run();
        } else {
            chain.setLink({ href: /^(https?:|mailto:|tel:|\/)/i.test(href) ? href : `https://${href}` }).run();
        }
        close();
    };

    return (
        <div className="flex items-center gap-1.5">
            <input
                autoFocus
                value={url}
                onChange={e => setUrl(e.target.value)}
                // Enter must not submit the surrounding memo form
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
                placeholder="Paste or type a link"
                className="w-64 text-sm bg-background border rounded-md px-2.5 py-1.5 outline-none focus:border-ring"
            />
            <button
                type="button"
                onClick={apply}
                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
            >
                Apply
            </button>
        </div>
    );
}

// Toolbar state derived from the editor's current selection
function readToolbarState(editor: Editor) {
    const headingLevel = [1, 2, 3].find(level => editor.isActive('heading', { level })) ?? 0;
    return {
        headingLevel,
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        subscript: editor.isActive('subscript'),
        superscript: editor.isActive('superscript'),
        color: editor.getAttributes('textStyle').color as string | undefined,
        highlight: editor.getAttributes('highlight').color as string | undefined,
        isHighlighted: editor.isActive('highlight'),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        taskList: editor.isActive('taskList'),
        blockquote: editor.isActive('blockquote'),
        codeBlock: editor.isActive('codeBlock'),
        link: editor.isActive('link'),
        table: editor.isActive('table'),
        alignLeft: editor.isActive({ textAlign: 'left' }),
        alignCenter: editor.isActive({ textAlign: 'center' }),
        alignRight: editor.isActive({ textAlign: 'right' }),
        alignJustify: editor.isActive({ textAlign: 'justify' }),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
        words: editor.storage.characterCount.words() as number,
        characters: editor.storage.characterCount.characters() as number,
    };
}

export default function RichTextEditor({
    content,
    onChange,
    placeholder = "Start writing your memo… Type @ to reference another memo.",
    className
}: RichTextEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            // StarterKit v3 bundles Link, Underline, lists, blockquote, code block, hr
            // and undo/redo; Link is configured separately below.
            StarterKit.configure({
                link: false,
                heading: { levels: [1, 2, 3] },
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: 'https',
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            Subscript,
            Superscript,
            TaskList,
            TaskItem.configure({ nested: true }),
            TableKit.configure({
                table: { resizable: true },
            }),
            CharacterCount,
            Placeholder.configure({
                placeholder,
            }),
            // "@" + memo title inserts a reference to another memo
            MemoReference,
        ],
        content,
        editorProps: {
            attributes: {
                class: 'memo-content focus:outline-none',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Tiptap v3 doesn't re-render on every transaction, so read toolbar state explicitly.
    // useEditorState doesn't re-render when the editor goes from null to ready, so fall
    // back to reading it directly until the first transaction updates the subscription.
    const selected = useEditorState({
        editor,
        selector: ({ editor }) => (editor ? readToolbarState(editor) : null),
    });
    const state = selected ?? (editor ? readToolbarState(editor) : null);

    if (!editor || !state) {
        return null;
    }

    const blockLabel = BLOCK_TYPES.find(b => b.level === state.headingLevel)?.label ?? 'Normal text';

    return (
        <div className={cn("border rounded-lg flex flex-col bg-card", className)}>
            {/* Toolbar */}
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 p-1 border-b bg-card/95 backdrop-blur rounded-t-lg">
                <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!state.canUndo} title="Undo (Ctrl+Z)">
                    <Undo size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!state.canRedo} title="Redo (Ctrl+Shift+Z)">
                    <Redo size={16} />
                </MenuButton>

                <Divider />

                <Popover
                    title="Text style"
                    trigger={<span className="flex items-center gap-1 text-xs font-medium w-24 justify-between">{blockLabel}<ChevronDown size={14} /></span>}
                >
                    {close => (
                        <div className="flex flex-col w-44">
                            {BLOCK_TYPES.map(b => (
                                <button
                                    key={b.level}
                                    type="button"
                                    onClick={() => {
                                        if (b.level === 0) editor.chain().focus().setParagraph().run();
                                        else editor.chain().focus().setHeading({ level: b.level }).run();
                                        close();
                                    }}
                                    className={cn(
                                        "text-left px-2.5 py-1.5 rounded-md hover:bg-muted",
                                        state.headingLevel === b.level && "bg-accent text-accent-foreground",
                                        b.level === 1 && "text-xl font-bold",
                                        b.level === 2 && "text-lg font-bold",
                                        b.level === 3 && "text-base font-semibold",
                                        b.level === 0 && "text-sm"
                                    )}
                                >
                                    {b.label}
                                </button>
                            ))}
                        </div>
                    )}
                </Popover>

                <Divider />

                <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={state.bold} title="Bold (Ctrl+B)">
                    <Bold size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={state.italic} title="Italic (Ctrl+I)">
                    <Italic size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={state.underline} title="Underline (Ctrl+U)">
                    <UnderlineIcon size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={state.strike} title="Strikethrough">
                    <Strikethrough size={16} />
                </MenuButton>

                <Popover
                    title="Text colour"
                    isActive={!!state.color}
                    trigger={
                        <span className="flex flex-col items-center">
                            <Baseline size={16} />
                            <span className="h-0.5 w-4 rounded-full -mt-0.5" style={{ backgroundColor: state.color ?? 'currentColor' }} />
                        </span>
                    }
                >
                    {close => (
                        <Swatches
                            colors={TEXT_COLORS}
                            active={state.color}
                            onPick={c => { editor.chain().focus().setColor(c).run(); close(); }}
                            onClear={() => { editor.chain().focus().unsetColor().run(); close(); }}
                            clearLabel="Default colour"
                        />
                    )}
                </Popover>
                <Popover title="Highlight" isActive={state.isHighlighted} trigger={<Highlighter size={16} />}>
                    {close => (
                        <Swatches
                            colors={HIGHLIGHT_COLORS}
                            active={state.highlight}
                            onPick={c => { editor.chain().focus().setHighlight({ color: c }).run(); close(); }}
                            onClear={() => { editor.chain().focus().unsetHighlight().run(); close(); }}
                            clearLabel="No highlight"
                        />
                    )}
                </Popover>

                <MenuButton onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={state.subscript} title="Subscript">
                    <SubscriptIcon size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={state.superscript} title="Superscript">
                    <SuperscriptIcon size={16} />
                </MenuButton>

                <Divider />

                <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={state.bulletList} title="Bulleted list">
                    <List size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={state.orderedList} title="Numbered list">
                    <ListOrdered size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={state.taskList} title="Checklist">
                    <ListChecks size={16} />
                </MenuButton>

                <Divider />

                <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={state.alignLeft} title="Align left">
                    <AlignLeft size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={state.alignCenter} title="Align centre">
                    <AlignCenter size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={state.alignRight} title="Align right">
                    <AlignRight size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={state.alignJustify} title="Justify">
                    <AlignJustify size={16} />
                </MenuButton>

                <Divider />

                <Popover title="Link" isActive={state.link} trigger={<LinkIcon size={16} />}>
                    {close => <LinkForm editor={editor} close={close} />}
                </Popover>
                <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={state.blockquote} title="Quote">
                    <Quote size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={state.codeBlock} title="Code block">
                    <Code2 size={16} />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider line">
                    <Minus size={16} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                    isActive={state.table}
                    title="Insert table"
                >
                    <TableIcon size={16} />
                </MenuButton>

                <Divider />

                <MenuButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting">
                    <RemoveFormatting size={16} />
                </MenuButton>
            </div>

            {/* Link bubble: open / edit / remove the link under the cursor */}
            <BubbleMenu
                editor={editor}
                pluginKey="linkBubble"
                shouldShow={({ editor }) => editor.isActive('link') && !editor.isActive('table')}
                options={{ placement: 'bottom-start' }}
            >
                <div className="flex items-center gap-1 bg-card border rounded-lg shadow-lg px-2 py-1 text-xs">
                    <a
                        href={editor.getAttributes('link').href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-60 truncate text-blue-700 hover:underline flex items-center gap-1"
                    >
                        <ExternalLink size={12} className="shrink-0" />
                        {editor.getAttributes('link').href}
                    </a>
                    <Divider />
                    <MenuButton onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()} title="Remove link">
                        <Unlink size={14} />
                    </MenuButton>
                </div>
            </BubbleMenu>

            {/* Table bubble: row / column controls while the cursor is in a table */}
            <BubbleMenu
                editor={editor}
                pluginKey="tableBubble"
                shouldShow={({ editor }) => editor.isActive('table')}
                options={{ placement: 'top' }}
            >
                <div className="flex items-center gap-0.5 bg-card border rounded-lg shadow-lg p-1 text-xs">
                    <MenuButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">
                        <span className="flex items-center gap-1"><Rows3 size={14} />+</span>
                    </MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
                        <span className="flex items-center gap-1"><Rows3 size={14} />−</span>
                    </MenuButton>
                    <Divider />
                    <MenuButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column right">
                        <span className="flex items-center gap-1"><Columns3 size={14} />+</span>
                    </MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
                        <span className="flex items-center gap-1"><Columns3 size={14} />−</span>
                    </MenuButton>
                    <Divider />
                    <MenuButton onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Toggle header row">
                        <span className="font-semibold px-0.5">H</span>
                    </MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
                        <Trash2 size={14} className="text-red-600" />
                    </MenuButton>
                </div>
            </BubbleMenu>

            {/* Editor Content */}
            <EditorContent editor={editor} className="px-5 py-4 min-h-[300px]" />

            <div className="flex justify-end gap-3 px-4 py-1.5 border-t text-[11px] text-muted-foreground">
                <span>{state.words} {state.words === 1 ? 'word' : 'words'}</span>
                <span>{state.characters} characters</span>
            </div>

            <style jsx global>{`
        .ProseMirror {
          min-height: 300px;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted-foreground);
          pointer-events: none;
          height: 0;
        }
        .ProseMirror .selectedCell::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgb(26 90 166 / 0.12);
          pointer-events: none;
        }
        .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background: #1a5aa6;
          pointer-events: none;
        }
        .ProseMirror.resize-cursor {
          cursor: col-resize;
        }
      `}</style>
        </div>
    );
}
