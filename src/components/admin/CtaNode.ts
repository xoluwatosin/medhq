import { Node, mergeAttributes, nodeInputRule, nodePasteRule } from "@tiptap/core";

/* ── CTA token regex (matches [[cta:Label|url]] and Markdown-escaped \[\[cta:Label|url\]\]) ── */
export const CTA_TOKEN_RE = /\\?\[\\?\[cta:([^|\]\\]+)\|([^|\]\\]+)(?:\|(left|center|right))?\\?\]\\?\]/g;
const CTA_TOKEN_INPUT_RE = /\[\[cta:([^|\]]+)\|([^|\]]+)(?:\|(left|center|right))?\]\]$/;
const CTA_TOKEN_PASTE_RE = /\[\[cta:([^|\]]+)\|([^|\]]+)(?:\|(left|center|right))?\]\]/g;

/* Convert raw markdown text → HTML the CtaNode parser understands. */
export function preprocessCtaTokensToHtml(input: string): string {
  if (!input) return input;
  return input.replace(CTA_TOKEN_RE, (_m, label, url, align) => {
    const safeLabel = String(label).trim().replace(/"/g, "&quot;");
    const safeUrl = String(url).trim().replace(/"/g, "&quot;");
    const alignAttr = align ? ` data-align="${align}"` : "";
    return `<a data-cta="1" data-label="${safeLabel}" href="${safeUrl}"${alignAttr}>${safeLabel}</a>`;
  });
}

/* Walk the editor doc and replace any plain-text occurrences of the CTA token
   with real CTA nodes. Use after setContent (markdown parsers may leave tokens as text). */
export function replaceCtaTokensInDoc(editor: any): boolean {
  if (!editor) return false;
  const { state } = editor;
  const ctaType = state.schema.nodes.cta;
  if (!ctaType) return false;
  const tr = state.tr;
  let modified = false;

  // Collect all matches first so positions remain stable while we rewrite from end → start.
  const hits: { from: number; to: number; attrs: any }[] = [];
  state.doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;
    const text: string = node.text;
    let m: RegExpExecArray | null;
    const re = new RegExp(CTA_TOKEN_RE.source, "g");
    while ((m = re.exec(text)) !== null) {
      hits.push({
        from: pos + m.index,
        to: pos + m.index + m[0].length,
        attrs: { label: m[1].trim(), url: m[2].trim(), align: (m[3] as any) || null },
      });
    }
  });

  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    tr.replaceWith(h.from, h.to, ctaType.create(h.attrs));
    modified = true;
  }
  if (modified) editor.view.dispatch(tr);
  return modified;
}

export const CtaNode = Node.create({
  name: "cta",
  priority: 1000,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      label: { default: "Learn more" },
      url: { default: "#" },
      align: { default: null as null | "left" | "center" | "right" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[data-cta]",
        getAttrs: (el) => {
          const e = el as HTMLElement;
          return {
            label: e.getAttribute("data-label") || e.textContent || "Learn more",
            url: e.getAttribute("href") || "#",
            align: (e.getAttribute("data-align") as any) || null,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { label, url, align } = node.attrs as any;
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: "campaign-editor-cta-node",
        "data-cta": "1",
        "data-label": label,
        "data-align": align || "",
        href: url || "#",
        contenteditable: "false",
        style:
          "display:inline-flex;align-items:center;gap:6px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));padding:6px 12px;border-radius:6px;text-decoration:none;font-family:'Figtree',sans-serif;font-size:13px;font-weight:500;line-height:1.2;margin:0 2px;cursor:pointer;",
      }),
      `↳ ${label}`,
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: CTA_TOKEN_INPUT_RE,
        type: this.type,
        getAttributes: (match) => ({
          label: String(match[1] || "Learn more").trim(),
          url: String(match[2] || "#").trim(),
          align: (match[3] as any) || null,
        }),
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: CTA_TOKEN_PASTE_RE,
        type: this.type,
        getAttributes: (match) => ({
          label: String(match[1] || "Learn more").trim(),
          url: String(match[2] || "#").trim(),
          align: (match[3] as any) || null,
        }),
      }),
    ];
  },

  /* ── tiptap-markdown serializer: emits the token back into markdown ── */
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const { label, url, align } = node.attrs;
          const tail = align && align !== "left" ? `|${align}` : "";
          state.write(`[[cta:${label}|${url}${tail}]]`);
        },
        parse: {},
      },
    };
  },
});
