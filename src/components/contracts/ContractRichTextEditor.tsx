// The shared rich text surface for contract and annex wording.
//
// One editor, three places: the contract editor (full toolbar, sticky, tall,
// insert-token ref, selection bubble menu), the template library, and the
// annex library (compact). Everything is opt-in through props so the quiet
// uses stay quiet.
import { forwardRef, useCallback, useEffect, useImperativeHandle } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Eraser,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ContractEditorTool = "undo" | "link" | "clear";

export interface ContractRichTextEditorRef {
  /** Insert text (usually a {{token}}) at the cursor, or at the end. */
  insertText: (text: string) => void;
  /** Focus the editor. */
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number | string;
  preview?: boolean;
  className?: string;
  /** Read-only: renders the wording without the toolbar or editing. */
  disabled?: boolean;
  /** Toolbar affordances beyond bold/italic/underline/lists. Default: all. */
  tools?: ContractEditorTool[];
  /** Pin the toolbar to the top of a scrolling canvas. */
  stickyToolbar?: boolean;
  /** The blog-style writing surface: larger type, taller canvas. */
  large?: boolean;
  /** Show the floating format menu when text is selected. */
  bubbleMenu?: boolean;
}

const setLink = (editor: Editor) => {
  const prev = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", prev ?? "https://");
  if (url === null) return;
  if (!url.trim()) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
};

const ToolButton = ({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className={cn(
      "flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors",
      "hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent",
      active && "bg-muted text-foreground",
    )}
  >
    {children}
  </button>
);

export const ContractRichTextEditor = forwardRef<ContractRichTextEditorRef, Props>(
  (
    {
      value,
      onChange,
      placeholder,
      minHeight = 140,
      preview,
      className,
      disabled,
      tools = ["undo", "link", "clear"],
      stickyToolbar,
      large,
      bubbleMenu,
    },
    ref,
  ) => {
    const editor = useEditor({
      editable: !disabled,
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
          link: false,
        }),
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder: placeholder ?? "Write the wording…" }),
      ],
      content: value || "",
      onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    });

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        if (!editor) return;
        editor.chain().focus().insertContent(text).run();
      },
      focus: () => editor?.commands.focus(),
    }));

    // Reflect external value replacement (loading a record, applying a template).
    useEffect(() => {
      if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "");
    }, [editor, value]);

    useEffect(() => {
      editor?.setEditable(!disabled);
    }, [editor, disabled]);

    const minH = typeof minHeight === "number" ? `${minHeight}px` : minHeight;

    const state = useEditorState({
      editor,
      selector: (ctx) =>
        ctx.editor
          ? {
              bold: ctx.editor.isActive("bold"),
              italic: ctx.editor.isActive("italic"),
              underline: ctx.editor.isActive("underline"),
              link: ctx.editor.isActive("link"),
              bulletList: ctx.editor.isActive("bulletList"),
              orderedList: ctx.editor.isActive("orderedList"),
              canUndo: ctx.editor.can().undo(),
              canRedo: ctx.editor.can().redo(),
            }
          : null,
    });

    const onLink = useCallback(() => editor && setLink(editor), [editor]);

    if (preview) {
      return (
        <div
          className={cn("mc-richtext text-sm leading-relaxed", className)}
          dangerouslySetInnerHTML={{ __html: value || "" }}
        />
      );
    }

    if (!editor || !state) return null;

    const toolbar = (
      <div
        className={cn(
          "flex flex-wrap items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-1",
          stickyToolbar && "sticky top-2 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        )}
      >
        <ToolButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          label="Underline"
          active={state.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolButton
          label="Bullet list"
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          label="Numbered list"
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolButton>
        {tools.includes("link") && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolButton label="Add link" active={state.link} onClick={onLink}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolButton>
            {state.link && (
              <ToolButton label="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>
                <Link2Off className="h-3.5 w-3.5" />
              </ToolButton>
            )}
          </>
        )}
        {tools.includes("clear") && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolButton
              label="Clear formatting"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            >
              <Eraser className="h-3.5 w-3.5" />
            </ToolButton>
          </>
        )}
        {tools.includes("undo") && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
              <Undo2 className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
              <Redo2 className="h-3.5 w-3.5" />
            </ToolButton>
          </>
        )}
      </div>
    );

    return (
      <div className={cn("space-y-2", className)}>
        {toolbar}
        {bubbleMenu && (
          <BubbleMenu
            editor={editor}
            className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-1 shadow-lg"
          >
            <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label="Underline"
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label="Add link" active={editor.isActive("link")} onClick={onLink}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label="Clear formatting"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            >
              <Eraser className="h-3.5 w-3.5" />
            </ToolButton>
          </BubbleMenu>
        )}
        <EditorContent
          editor={editor}
          className={cn(
            "mc-richtext rounded-lg border border-border/60 bg-background px-4 py-3",
            large ? "text-[16px] leading-relaxed" : "text-sm leading-relaxed",
            disabled && "opacity-70",
          )}
          style={{ minHeight: minH }}
        />
      </div>
    );
  },
);
ContractRichTextEditor.displayName = "ContractRichTextEditor";
export default ContractRichTextEditor;
