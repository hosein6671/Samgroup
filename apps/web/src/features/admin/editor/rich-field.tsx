"use client";

import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { EDITORIAL_HREF_HINT, validEditorialHref } from "@sam-group/types/structural-lists";

import {
  $createImageNode,
  cleanMarkdown,
  NODES,
  PRESERVE_NEWLINES,
  TRANSFORMERS,
  type EditorMode,
} from "./markdown-nodes";
import { visualEditorSafe } from "./round-trip";

/**
 * The /admin text editor that looks and works like a word processor — a toolbar, bold and italic
 * as you see them, links you click — while still saving the same Markdown string the field always
 * held. Nothing stored changes shape; the site renders exactly what it rendered before.
 *
 * - `mode="inline"` is a page's body-copy field: bold, italic, links.
 * - `mode="document"` is a blog article: inline, plus headings, quotes, lists and images.
 *
 * ── It never loses text ───────────────────────────────────────────────────────
 *
 * Before the visual editor opens, the text is checked (`visualEditorSafe`): if any part would
 * change meaning on the way through — a table, raw HTML, a code block — the field opens in its
 * Markdown source instead, with a note saying why. Both views are always one click apart.
 *
 * ── It still is a form field ──────────────────────────────────────────────────
 *
 * A `<textarea name>` holding the Markdown is always in the form, so the plain server-action form
 * (`new-blog-form.tsx`) submits it exactly as before, and without JavaScript it is simply the
 * field. In the controlled form (`content-form.tsx`) `value`/`onChange` carry the same string.
 *
 * ── It only saves addresses the site will show ────────────────────────────────
 *
 * The link button checks the address with `validEditorialHref`; a link pasted from Word that the
 * rule refuses (`http://…`, `javascript:…`) is turned back into plain text as it arrives.
 */
export function RichField({
  id,
  name,
  mode,
  defaultValue,
  value,
  onChange,
  required,
  disabled,
  maxLength,
  rows = mode === "document" ? 18 : 4,
}: {
  readonly id: string;
  readonly name?: string;
  readonly mode: EditorMode;
  readonly defaultValue?: string;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly maxLength?: number;
  readonly rows?: number;
}): ReactNode {
  const controlled = value !== undefined;
  const [own, setOwn] = useState(defaultValue ?? "");
  const markdown = controlled ? value : own;
  const set = (next: string): void => {
    if (!controlled) setOwn(next);
    onChange?.(next);
  };

  // Decided once per opening: re-checking on every keystroke would flip the view mid-edit.
  const [mounted, setMounted] = useState(false);
  const safe = useMemo(() => visualEditorSafe(markdown, mode), [mode]);
  const [view, setView] = useState<"visual" | "source">(safe ? "visual" : "source");
  const [generation, setGeneration] = useState(0);
  useEffect(() => setMounted(true), []);

  const noteId = useId();
  const visual = mounted && view === "visual";

  return (
    <div className="ad-rich" data-mode={mode} data-view={visual ? "visual" : "source"}>
      {mounted && (
        <div className="ad-rich-tabs" role="tablist" aria-label="Editor view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "visual"}
            disabled={disabled}
            onClick={() => {
              if (view === "visual") return;
              if (!visualEditorSafe(markdown, mode)) {
                setView("source");
                window.alert(
                  "This text contains formatting the visual editor cannot keep (for example a table or HTML). Keep editing it as Markdown.",
                );
                return;
              }
              setGeneration((g) => g + 1);
              setView("visual");
            }}
          >
            Visual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "source"}
            disabled={disabled}
            onClick={() => setView("source")}
          >
            Markdown
          </button>
        </div>
      )}

      {visual && (
        <VisualEditor
          key={generation}
          id={id}
          mode={mode}
          initial={markdown}
          disabled={disabled}
          rows={rows}
          describedBy={noteId}
          onChange={set}
        />
      )}

      {/* Always in the form; the visible field itself when JavaScript or the visual view is off. */}
      <textarea
        id={visual ? undefined : id}
        className={visual ? "ad-rich-store" : "ad-rich-source"}
        name={name}
        value={markdown}
        onChange={(event) => set(event.target.value)}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        tabIndex={visual ? -1 : undefined}
        aria-hidden={visual || undefined}
        aria-describedby={noteId}
      />

      <p className="ad-rich-note" id={noteId}>
        {!safe && view === "source"
          ? "Opened as Markdown: this text uses formatting the visual editor cannot keep."
          : mode === "document"
            ? "Headings, lists, quotes, images, bold, italic and links. Paste from Word keeps them."
            : "Bold, italic and links. Paste from Word keeps them."}
      </p>
    </div>
  );
}

function VisualEditor({
  id,
  mode,
  initial,
  disabled,
  rows,
  describedBy,
  onChange,
}: {
  readonly id: string;
  readonly mode: EditorMode;
  readonly initial: string;
  readonly disabled?: boolean;
  readonly rows: number;
  readonly describedBy: string;
  readonly onChange: (markdown: string) => void;
}): ReactNode {
  const config = {
    namespace: `admin-${mode}`,
    nodes: NODES[mode],
    editable: !disabled,
    theme: {
      text: { bold: "ad-rich-b", italic: "ad-rich-i" },
      link: "ad-rich-link",
      heading: { h2: "ad-rich-h2", h3: "ad-rich-h3" },
      quote: "ad-rich-quote",
      list: { ul: "ad-rich-ul", ol: "ad-rich-ol", listitem: "ad-rich-li" },
      paragraph: "ad-rich-p",
    },
    onError: (error: Error) => {
      throw error;
    },
    editorState: () =>
      $convertFromMarkdownString(initial, TRANSFORMERS[mode], undefined, PRESERVE_NEWLINES[mode]),
  };

  return (
    <LexicalComposer initialConfig={config}>
      <Toolbar mode={mode} disabled={disabled} />
      <div className="ad-rich-surface">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              id={id}
              className="ad-rich-input"
              style={{ minHeight: `${rows * 1.6}em` }}
              aria-describedby={describedBy}
              aria-multiline
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <LinkPlugin validateUrl={validEditorialHref} />
      {mode === "document" && <ListPlugin />}
      <SafeLinks />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(state: EditorState) =>
          state.read(() =>
            onChange(
              cleanMarkdown(
                $convertToMarkdownString(TRANSFORMERS[mode], undefined, PRESERVE_NEWLINES[mode]),
              ),
            ),
          )
        }
      />
    </LexicalComposer>
  );
}

/** A link whose address the shared rule refuses (pasted `http://…`, `javascript:…`) becomes text. */
function SafeLinks(): null {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerNodeTransform(LinkNode, (node) => {
        if (validEditorialHref(node.getURL())) return;
        for (const child of node.getChildren()) node.insertBefore(child);
        node.remove();
      }),
    [editor],
  );
  return null;
}

/** `window.prompt`, guarded: some embedded browsers disable it and make it throw. */
function ask(message: string, initial = ""): string | null {
  try {
    return window.prompt(message, initial);
  } catch {
    return null;
  }
}

function Toolbar({
  mode,
  disabled,
}: {
  readonly mode: EditorMode;
  readonly disabled?: boolean;
}): ReactNode {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState({ bold: false, italic: false, link: false });

  useEffect(
    () =>
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const node = selection.anchor.getNode();
            setState({
              bold: selection.hasFormat("bold"),
              italic: selection.hasFormat("italic"),
              link: !!$findMatchingParent(node, $isLinkNode) || $isLinkNode(node.getParent()),
            });
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  );

  const link = (): void => {
    if (state.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    const url = ask(`Link address — ${EDITORIAL_HREF_HINT}`)?.trim();
    if (!url) return;
    if (!validEditorialHref(url)) {
      window.alert(`That address cannot be used. ${EDITORIAL_HREF_HINT}`);
      return;
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  };

  return (
    <div className="ad-rich-toolbar" role="toolbar" aria-label="Formatting">
      <Tool
        label="Bold"
        active={state.bold}
        disabled={disabled}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        <b>B</b>
      </Tool>
      <Tool
        label="Italic"
        active={state.italic}
        disabled={disabled}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        <i>I</i>
      </Tool>
      <Tool
        label={state.link ? "Remove link" : "Link"}
        active={state.link}
        disabled={disabled}
        onClick={link}
      >
        {state.link ? "Unlink" : "Link"}
      </Tool>
      {mode === "document" && (
        <>
          <span className="ad-rich-sep" aria-hidden="true" />
          <Tool label="Paragraph" disabled={disabled} onClick={() => setBlock(editor, "p")}>
            ¶
          </Tool>
          <Tool label="Heading" disabled={disabled} onClick={() => setBlock(editor, "h2")}>
            H2
          </Tool>
          <Tool label="Subheading" disabled={disabled} onClick={() => setBlock(editor, "h3")}>
            H3
          </Tool>
          <Tool label="Quote" disabled={disabled} onClick={() => setBlock(editor, "quote")}>
            “ ”
          </Tool>
          <Tool
            label="Bulleted list"
            disabled={disabled}
            onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
          >
            •
          </Tool>
          <Tool
            label="Numbered list"
            disabled={disabled}
            onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
          >
            1.
          </Tool>
          <Tool label="Image" disabled={disabled} onClick={() => insertImage(editor)}>
            Image
          </Tool>
        </>
      )}
    </div>
  );
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  readonly label: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text selection: a click would otherwise move focus off the editor first.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function setBlock(editor: LexicalEditor, block: "p" | HeadingTagType | "quote"): void {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    $setBlocksType(selection, () =>
      block === "p"
        ? $createParagraphNode()
        : block === "quote"
          ? $createQuoteNode()
          : $createHeadingNode(block),
    );
  });
}

function insertImage(editor: LexicalEditor): void {
  const src = ask(
    "Image address — upload the image below first, then paste its address here",
  )?.trim();
  if (!src) return;
  if (!/^(https:\/\/|\/)\S+$/.test(src)) {
    window.alert("Use an https:// address or a path on this site for the image.");
    return;
  }
  const alt = ask("Describe the image for people who cannot see it (alt text)") ?? "";
  editor.update(() => {
    $insertNodes([$createImageNode(src, alt.replace(/[[\]]/g, ""))]);
  });
}
