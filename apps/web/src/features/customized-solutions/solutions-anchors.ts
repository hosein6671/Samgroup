/**
 * The Customized Solutions page's in-page anchors.
 *
 * **Structural identifiers, so they are code and not content.** An anchor is part of a URL —
 * `/en/customized-solutions#custom-request` — and structural URLs stay fixed English across every
 * locale (PROJECT_HANDOFF §6.12). Localising them would give one section three addresses; putting
 * them in the CMS would let an edit break a link somebody had already shared.
 *
 * ── The request anchor is the one the CMS deliberately cannot reach ─────────
 *
 * The hero's request action jumps to the form below it. Its **label** is editorial and comes from
 * the `CustomizedSolutions` Global; its **target** is this constant, and nothing in `sam_cms`
 * projects onto it — the API serves that action as a label alone. An editor renames the button;
 * nobody can point it somewhere else.
 */
export const ANCHORS = {
  process: "process",
  request: "custom-request",
} as const;
