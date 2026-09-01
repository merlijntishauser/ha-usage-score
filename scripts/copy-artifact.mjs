/**
 * Copy the built card into the integration.
 *
 * The card ships inside the integration rather than as a separate HACS plugin,
 * so the built artifact is committed and the integration serves it. The release
 * workflow rebuilds and diffs against the committed copy.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "dist/haus-card.js");
const target = resolve(root, "custom_components/haus/www/haus-card.js");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`copied ${source} -> ${target}`);
