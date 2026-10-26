/**
 * Small Editor command catalogue.
 *
 * The palette is inspired by Sejda's "All Tools" menu: every entry has a
 * caption, a one-line description and keywords, and the search matches across
 * all three. Only commands that this app really implements are listed.
 */

export const TOOLS = [
  {
    id: "open-file",
    title: "Open PDF",
    description: "Load a PDF from your computer. Nothing is uploaded anywhere.",
    category: "File",
    keywords: ["upload", "file", "document", "pdf", "browse"],
  },
  {
    id: "open-sample",
    title: "Open sample PDF",
    description: "Load the bundled four-page sample document to try search.",
    category: "File",
    keywords: ["demo", "example", "sample", "test"],
  },
  {
    id: "find",
    title: "Find in document",
    description: "Search text, highlight every hit and jump between matches.",
    category: "Search",
    keywords: ["search", "find", "text", "locate", "ctrl f", "highlight"],
  },
  {
    id: "find-next",
    title: "Next match",
    description: "Go to the next search result, wrapping at the end.",
    category: "Search",
    keywords: ["search", "next", "result", "enter"],
  },
  {
    id: "find-previous",
    title: "Previous match",
    description: "Go to the previous search result, wrapping at the start.",
    category: "Search",
    keywords: ["search", "previous", "back", "shift enter"],
  },
  {
    id: "match-case",
    title: "Toggle match case",
    description: "Make the find query case-sensitive or case-insensitive.",
    category: "Search",
    keywords: ["case", "sensitive", "uppercase", "lowercase"],
  },
  {
    id: "whole-word",
    title: "Toggle whole word",
    description: "Only match the query when it stands alone as a word.",
    category: "Search",
    keywords: ["word", "boundary", "exact", "whole"],
  },
  {
    id: "clear-search",
    title: "Clear search",
    description: "Remove highlights and reset the find bar.",
    category: "Search",
    keywords: ["reset", "clear", "close", "escape"],
  },
  {
    id: "download-text",
    title: "Export text",
    description: "Download the document text as a .txt file for other tools.",
    category: "File",
    keywords: ["export", "save", "txt", "extract", "copy"],
  },
  {
    id: "copy-text",
    title: "Copy page text",
    description: "Copy the current page's extracted text to the clipboard.",
    category: "Edit",
    keywords: ["clipboard", "copy", "text"],
  },
  {
    id: "zoom-in",
    title: "Zoom in",
    description: "Render pages larger for easier reading.",
    category: "View",
    keywords: ["zoom", "bigger", "scale", "magnify"],
  },
  {
    id: "zoom-out",
    title: "Zoom out",
    description: "Render pages smaller to see more of the layout.",
    category: "View",
    keywords: ["zoom", "smaller", "scale"],
  },
  {
    id: "fit-width",
    title: "Fit width",
    description: "Reset the zoom so each page fits the viewer width.",
    category: "View",
    keywords: ["zoom", "fit", "width", "reset"],
  },
  {
    id: "first-page",
    title: "First page",
    description: "Scroll to the first page of the document.",
    category: "Navigate",
    keywords: ["page", "start", "top", "begin"],
  },
  {
    id: "last-page",
    title: "Last page",
    description: "Scroll to the last page of the document.",
    category: "Navigate",
    keywords: ["page", "end", "bottom"],
  },
  {
    id: "toggle-dim",
    title: "Toggle dimmed matches",
    description: "Match Sejda's style: dim non-current hits instead of hiding them.",
    category: "Search",
    keywords: ["opacity", "dim", "matches", "sejda", "highlight"],
  },
  {
    id: "toggle-theme",
    title: "Toggle theme",
    description: "Switch between the light and dark reading themes.",
    category: "View",
    keywords: ["dark", "light", "theme", "appearance"],
  },
  {
    id: "print",
    title: "Print",
    description: "Open the browser print dialog for the current document.",
    category: "File",
    keywords: ["print", "paper", "pdf"],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    description: "Show every shortcut this editor supports.",
    category: "Help",
    keywords: ["keys", "help", "hotkeys", "shortcut"],
  },
  {
    id: "about",
    title: "About Small Editor",
    description: "How search works and where the data goes.",
    category: "Help",
    keywords: ["info", "privacy", "local", "about"],
  },
];

/** Same five defaults Sejda seeds into its "Recent" strip. */
export const DEFAULT_PINNED = ["open-file", "find", "open-sample", "download-text", "toggle-theme"];
export const DEFAULT_RECENT = ["find"];

export function toolById(id) {
  return TOOLS.find((tool) => tool.id === id);
}
