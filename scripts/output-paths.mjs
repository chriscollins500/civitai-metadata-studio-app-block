import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
// The imported dist/ is a pinned reference artifact. Local builds never overwrite it.
export const standaloneDirectory = join(root, "build/standalone");
export const appBlockDirectory = join(root, "build/app-block");
