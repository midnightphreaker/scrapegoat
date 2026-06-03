/**
 * Type declarations for @joplin/turndown-plugin-gfm
 * The package ships without TypeScript definitions.
 */
declare module "@joplin/turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  type GfmPlugin = (service: TurndownService) => void;

  export const gfm: GfmPlugin;
  export const highlightedCodeBlock: GfmPlugin;
  export const strikethrough: GfmPlugin;
  export const tables: GfmPlugin;
  export const taskListItems: GfmPlugin;
}
