const fs = require("fs");
const path = require("path");

const sourceDir = path.resolve(__dirname, "..", "assets");
const targetDir = path.resolve(__dirname, "..", "dist", "assets");

if (!fs.existsSync(sourceDir)) {
  console.warn(`[copy-assets] Source directory not found: ${sourceDir}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });

console.log(`[copy-assets] Copied ${sourceDir} -> ${targetDir}`);
