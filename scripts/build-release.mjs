import { readFile } from "node:fs/promises";

const epoch = await readFile(new URL("../app-block/build-epoch.txt", import.meta.url), "utf8");
process.env.SOURCE_DATE_EPOCH ??= epoch.trim();
await import("./build-app-block.mjs");
