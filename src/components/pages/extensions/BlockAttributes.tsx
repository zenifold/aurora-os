import { Extension } from "@tiptap/core";

/**
 * Adds two global attributes to block-level nodes:
 *  - blockId: stable id used by attribution + portal masking
 *  - internalOnly: hide this block from the published client portal view
 */
function rid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "taskList",
  "horizontalRule",
  "embed",
];

export const BlockAttributes = Extension.create({
  name: "blockAttributes",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-block-id"),
            renderHTML: (attrs) => (attrs.blockId ? { "data-block-id": attrs.blockId } : {}),
          },
          internalOnly: {
            default: false,
            parseHTML: (el) => el.getAttribute("data-internal") === "true",
            renderHTML: (attrs) =>
              attrs.internalOnly ? { "data-internal": "true", class: "page-block-internal" } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      toggleInternalBlock:
        () =>
        ({ state, tr, dispatch }: { state: { selection: { from: number; to: number }; doc: { nodesBetween: (from: number, to: number, fn: (n: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => boolean | void) => void } }; tr: { setNodeMarkup: (pos: number, t: unknown, attrs: Record<string, unknown>) => unknown }; dispatch?: (tr: unknown) => void }) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (BLOCK_TYPES.includes(node.type.name)) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                internalOnly: !node.attrs.internalOnly,
              });
              changed = true;
              return false;
            }
            return true;
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    } as never;
  },

  onCreate() {
    ensureBlockIds(this.editor as unknown as EditorLike);
  },
  onUpdate() {
    ensureBlockIds(this.editor as unknown as EditorLike);
  },
});

interface EditorLike {
  state: {
    tr: { setNodeMarkup: (pos: number, type: unknown, attrs: Record<string, unknown>) => unknown; steps: unknown[] };
    doc: {
      descendants: (
        fn: (node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => boolean | void,
      ) => void;
    };
  };
  view: { dispatch: (tr: unknown) => void };
}

function ensureBlockIds(editor: EditorLike | null) {
  if (!editor) return;
  const tr = editor.state.tr;
  let dirty = false;
  editor.state.doc.descendants((node, pos) => {
    if (BLOCK_TYPES.includes(node.type.name) && !node.attrs.blockId) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: rid() });
      dirty = true;
    }
  });
  if (dirty && tr.steps.length > 0) {
    queueMicrotask(() => {
      try {
        editor.view.dispatch(tr);
      } catch {
        /* ignore */
      }
    });
  }
}

