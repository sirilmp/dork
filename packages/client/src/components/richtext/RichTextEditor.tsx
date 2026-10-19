import type { ReactNode } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  content,
  onChange,
  autoFocus,
  placeholder = 'Add a description...',
  className,
}: {
  content: unknown;
  onChange: (json: JSONContent) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    content: (content as JSONContent) ?? undefined,
    autofocus: autoFocus ? 'end' : false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  if (!editor) return null;

  function setLink() {
    // editor is guaranteed non-null here (the early return above), but TS
    // doesn't carry that narrowing into a nested function closure.
    const e = editor!;
    const previous = e.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      e.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    e.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className={cn('rounded-md border border-border', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          label="Code block"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('link')} onClick={setLink} label="Link">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm max-w-none px-3 py-2 text-foreground prose-headings:text-foreground',
          'prose-strong:text-foreground prose-a:text-primary prose-blockquote:border-border',
          'prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground',
          'min-h-[120px] focus:outline-none [&_.ProseMirror]:min-h-[110px] [&_.ProseMirror]:outline-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]'
        )}
      />
    </div>
  );
}

// Re-exported so callers don't need a direct @tiptap/react import just to
// type an onChange handler's payload.
export type { JSONContent };
