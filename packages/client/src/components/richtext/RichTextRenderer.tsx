import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { cn } from '@/lib/utils';

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

/**
 * Read-only render of a Tiptap document (same schema as the editor, in
 * non-editable mode) rather than a hand-rolled renderer — this guarantees
 * the view always matches whatever the editor can produce.
 */
export function RichTextRenderer({ content, className }: { content: unknown; className?: string }) {
  const editor = useEditor({
    editable: false,
    content: (content as JSONContent) ?? EMPTY_DOC,
    extensions: [StarterKit, Link.configure({ openOnClick: true, autolink: true })],
  });

  if (!content) return null;

  return (
    <EditorContent
      editor={editor}
      className={cn(
        'prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground',
        'prose-a:text-primary prose-blockquote:border-border prose-code:text-foreground',
        'prose-pre:bg-muted prose-pre:text-foreground',
        className
      )}
    />
  );
}
