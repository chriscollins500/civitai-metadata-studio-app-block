/** Narrow consumption of the official @civitai/app-sdk 0.89.0 wire contract.
 * Source pins: protocol-provenance.json. This is not an SDK runtime or metadata model.
 * Unused token/viewer/settings fields are neither read nor retained.
 */
export type ParentOrigin = "https://civitai.com" | "https://civitai.red" | "https://civitai.green";
export type HostMessage =
  | { type: "BLOCK_INIT"; payload: { blockInstanceId: string; context: { slotId: "app.page" }; theme: "light" | "dark"; renderMode: "iframe" } }
  | { type: "SAVE_IMAGE_RESULT"; payload: { requestId: string; ok?: boolean; error?: string } }
  | { type: "THEME_CHANGE"; payload: { theme: "light" | "dark" } }
  | { type: "SUSPEND" | "RESUME"; payload?: undefined };
export type EditorMessage =
  | { type: "BLOCK_READY"; payload: { height: number } }
  | { type: "SAVE_IMAGE"; payload: { requestId: string; bytes: ArrayBuffer; filename: string } }
  | { type: "NAVIGATE"; payload: { path: string; scope: "site"; target: "new_tab" } };
