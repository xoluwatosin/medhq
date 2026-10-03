import React, { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  Heading4,
  Quote,
  List,
  ListOrdered,
  Link2,
  Link2Off,
  Minus,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CtaNode, preprocessCtaTokensToHtml, replaceCtaTokensInDoc } from "@/components/admin/CtaNode";
import type { Editor } from "@tiptap/react";

interface RichTextEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  /** Enable CTA token support — preprocesses [[cta:...]] tokens to visual buttons. */
  enableCta?: boolean;
  /** Receive the underlying TipTap editor instance (for parent-driven commands like insertCta). */
  onEditorReady?: (editor: Editor) => void;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, title, children }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className={cn(
      "h-8 w-8 p-0 rounded-md",
      isActive && "bg-accent text-accent-foreground"
    )}
    title={title}
    onClick={onClick}
  >
    {children}
  </Button>
);

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Start writing your story...",
  className,
  minHeight = "400px",
  enableCta = false,
  onEditorReady,
}) => {
  // Prevent external sync from firing right after our own onUpdate
  const skipNextUpdateRef = useRef(false);
  const lastMarkdownRef = useRef(value || "");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      ...(enableCta ? [CtaNode] : []),
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg my-4 max-w-full" },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: enableCta, // allow CTA HTML through; off for non-CTA usage
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: enableCta ? preprocessCtaTokensToHtml(value || "") : value || "",
    editorProps: {
      attributes: {
        class: cn(
          "focus:outline-none px-4 py-3 max-w-none",
        ),
      },
    },
    onCreate: ({ editor }) => {
      if (enableCta) {
        window.requestAnimationFrame(() => {
          const changed = replaceCtaTokensInDoc(editor);
          if (changed) {
            const md = (editor.storage as any).markdown.getMarkdown();
            lastMarkdownRef.current = md;
            skipNextUpdateRef.current = true;
            onChange(md);
          }
        });
      }
    },
    onUpdate: ({ editor }) => {
      if (enableCta && replaceCtaTokensInDoc(editor)) {
        return;
      }
      const md = (editor.storage as any).markdown.getMarkdown();
      lastMarkdownRef.current = md;
      skipNextUpdateRef.current = true;
      onChange(md);
    },
  });

  // Expose editor to parent + convert any stray CTA tokens on first mount
  useEffect(() => {
    if (!editor) return;
    if (onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady, enableCta]);

  // Sync external value changes (e.g. loading existing post)
  useEffect(() => {
    if (!editor) return;
    if (skipNextUpdateRef.current) {
      skipNextUpdateRef.current = false;
      return;
    }
    if ((value || "") === lastMarkdownRef.current) return;
    const next = enableCta ? preprocessCtaTokensToHtml(value || "") : value || "";
    editor.commands.setContent(next, { emitUpdate: false });
    lastMarkdownRef.current = value || "";
    if (enableCta && replaceCtaTokensInDoc(editor)) {
      const md = (editor.storage as any).markdown.getMarkdown();
      lastMarkdownRef.current = md;
      skipNextUpdateRef.current = true;
      onChange(md);
    }
  }, [value, editor, enableCta]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const unsetLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("rich-text-editor border rounded-lg overflow-hidden bg-background", className)}>
      {/* Floating BubbleMenu on selection */}
      <BubbleMenu editor={editor} options={{ placement: "top", offset: 8 }}>
        <div className="flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} isActive={editor.isActive("heading", { level: 4 })} title="Heading 4">
            <Heading4 className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Quote">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered List">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton onClick={addLink} isActive={editor.isActive("link")} title="Link">
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={unsetLink} title="Remove link">
            <Link2Off className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </BubbleMenu>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          isActive={editor.isActive("heading", { level: 4 })}
          title="Heading 4"
        >
          <Heading4 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={addLink} isActive={editor.isActive("link")} title="Insert Link">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={unsetLink} title="Remove link">
          <Link2Off className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="Insert Image">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="cursor-text"
        style={{ minHeight, ['--editor-min-height' as any]: minHeight }}
      />
    </div>
  );
};

export default RichTextEditor;
