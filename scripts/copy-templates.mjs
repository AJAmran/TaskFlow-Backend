import fs from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "src", "app", "templates");
const dest = path.join(process.cwd(), "dist", "src", "app", "templates");

fs.mkdirSync(dest, { recursive: true });
for (const file of fs.readdirSync(src)) {
  if (file.endsWith(".ejs")) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
}
console.log("Templates copied to dist.");
