import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
const manifest = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(manifest.name, "dsh-training-lens");
assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
assert.equal(manifest.dsh.client.platform, "web");
for (const entry of ["./client", "./typert", "./remote"])
  await readFile(manifest.exports[entry]);
assert.equal(
  manifest.scripts.prepare,
  undefined,
  "Package must ship runnable code without install hooks",
);
assert.equal(manifest.scripts.postinstall, undefined);
const roots = ["src", "python", "dist"];
async function visit(path) {
  for (const e of await readdir(path, { withFileTypes: true })) {
    const file = join(path, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__pycache__") await visit(file);
      continue;
    }
    if (!/\.(js|py|html|css)$/.test(file)) continue;
    const source = await readFile(file, "utf8");
    assert(
      !/[A-Z]:[\\/](?:Users|Documents)[\\/]/i.test(source),
      `Personal path in ${relative(".", file)}`,
    );
    assert(
      !/(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/.test(source),
      `Credential-shaped value in ${file}`,
    );
  }
}
for (const path of roots) await visit(path);
for (const file of [
  "LICENSE",
  "README.md",
  "README.zh-CN.md",
  "requirements.txt",
  "CHANGELOG.md",
])
  await readFile(file);
console.log(
  "Package manifest, runnable entries and public source boundaries passed.",
);
