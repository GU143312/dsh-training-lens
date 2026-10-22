import { build } from "esbuild";
await build({
  entryPoints: ["src/client.js"],
  outfile: "dist/client.js",
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: ["react"],
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "dsh-training-lens", factory(require) { const module = {exports: {}}; const exports = module.exports;',
  },
  footer: { js: "return module.exports; }});" },
});
