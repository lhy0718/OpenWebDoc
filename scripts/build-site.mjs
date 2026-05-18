import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const siteDirectory = "dist/site";
const packages = ["@openwebdoc/spec", "@openwebdoc/core", "@openwebdoc/ui"];
const app = { name: "OpenWebDoc", packageName: "@openwebdoc/app", route: "app" };

for (const packageName of packages) {
  runPnpm(["--filter", packageName, "build"]);
}

runPnpm(["--filter", app.packageName, "build"]);

await rm(siteDirectory, { recursive: true, force: true });
await mkdir(siteDirectory, { recursive: true });

await cp(`apps/openwebdoc/dist`, join(siteDirectory, app.route), { recursive: true });

await writeFile(
  join(siteDirectory, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenWebDoc</title>
    <style>
      :root {
        color: #162033;
        background: #f7f9fc;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
      }
      main {
        max-width: 820px;
        margin: 0 auto;
        padding: 56px 24px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 44px;
        line-height: 1.05;
      }
      p {
        max-width: 680px;
        color: #526078;
        font-size: 18px;
        line-height: 1.6;
      }
      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }
      a {
        border: 1px solid #cdd7e6;
        border-radius: 8px;
        padding: 12px 16px;
        color: #1f4d8f;
        background: #fff;
        font-weight: 700;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>OpenWebDoc</h1>
      <p>OpenWebDoc opens HTMLX Document Package files as browser-readable documents. Editable packages can switch into direct editing on the same document surface.</p>
      <nav aria-label="OpenWebDoc app">
        <a href="./app/">Open OpenWebDoc</a>
      </nav>
    </main>
  </body>
</html>
`,
);

await writeFile(
  join(siteDirectory, "manifest.json"),
  `${JSON.stringify(
    {
      name: "OpenWebDoc static site",
      apps: [{ name: app.name, path: `${app.route}/` }],
    },
    null,
    2,
  )}\n`,
);

console.log(`Built OpenWebDoc static site at ${siteDirectory}`);

function runPnpm(args) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
