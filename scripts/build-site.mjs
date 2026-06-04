import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const siteDirectory = "dist/site";
const sampleRepoExportDirectory = "dist/sample-repos";
const sampleRepoSiteDirectory = "samples";
const packages = ["@openwebdoc/spec", "@openwebdoc/core", "@openwebdoc/ui"];
const app = { name: "OpenWebDoc", packageName: "@openwebdoc/app", route: "app" };
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const currentReleaseTag = `v${rootPackage.version}`;
const { examples: templates } = JSON.parse(await readFile("examples/gallery.json", "utf8"));
const { repositories: sampleRepositories } = JSON.parse(
  await readFile("samples/template-repos.json", "utf8"),
);
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
const featuredTemplates = templates.filter((template) => template.featured);
const groupedTemplates = groupTemplatesByCategory(templates);

for (const packageName of packages) {
  runPnpm(["--filter", packageName, "build"]);
}

runPnpm(["--filter", app.packageName, "build"]);
runNode(["scripts/export-sample-repos.mjs"]);

await rm(siteDirectory, { recursive: true, force: true });
await mkdir(siteDirectory, { recursive: true });
await mkdir(join(siteDirectory, sampleRepoSiteDirectory), { recursive: true });

await cp(`apps/openwebdoc/dist`, join(siteDirectory, app.route), { recursive: true });
await writeSampleRepositoryArchives();

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
        max-width: 1180px;
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
      .eyebrow {
        margin: 0 0 10px;
        color: #0f766e;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h2 {
        margin: 46px 0 14px;
        color: #162033;
        font-size: 28px;
      }
      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }
      .secondary-nav {
        margin-top: 12px;
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
      a:hover,
      a:focus-visible {
        border-color: #2f6fed;
        background: #f3f7ff;
      }
      .primary-link {
        border-color: #193b70;
        color: #ffffff;
        background: #193b70;
      }
      .primary-link:hover,
      .primary-link:focus-visible {
        color: #ffffff;
        background: #264c82;
      }
      code {
        border-radius: 6px;
        padding: 2px 5px;
        background: #edf3fb;
        color: #1b365d;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .hero-panel {
        border: 1px solid #d3deec;
        border-radius: 18px;
        padding: 38px;
        background:
          linear-gradient(135deg, rgba(25, 59, 112, 0.08), rgba(15, 118, 110, 0.05)),
          #ffffff;
        box-shadow: 0 24px 70px rgba(24, 40, 68, 0.1);
      }
      .hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
        gap: 28px;
        align-items: end;
      }
      .hero-metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .hero-metric {
        min-height: 96px;
        border: 1px solid #d6e1ee;
        border-radius: 12px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.74);
      }
      .hero-metric strong {
        display: block;
        color: #13213a;
        font-size: 24px;
        line-height: 1.1;
      }
      .hero-metric span {
        display: block;
        margin-top: 6px;
        color: #526078;
        font-size: 13px;
        line-height: 1.35;
      }
      .workflow {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-top: 24px;
      }
      .workflow-step {
        min-height: 124px;
        border: 1px solid #cdd7e6;
        border-radius: 12px;
        padding: 16px;
        background: #fff;
        box-shadow: 0 14px 36px rgba(24, 40, 68, 0.06);
      }
      .workflow-step strong {
        display: block;
        margin-bottom: 8px;
        color: #172033;
        font-size: 17px;
      }
      .workflow-step span {
        color: #526078;
        font-size: 14px;
        line-height: 1.45;
      }
      .template-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-top: 18px;
      }
      .featured-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-top: 18px;
      }
      .template-section {
        margin-top: 34px;
      }
      .template-section h3 {
        margin: 0 0 6px;
        color: #172033;
        font-size: 21px;
      }
      .template-section > p {
        margin: 0;
        font-size: 15px;
      }
      .template-card {
        display: grid;
        grid-template-rows: auto auto 1fr auto auto;
        gap: 10px;
        border: 1px solid #cdd7e6;
        border-radius: 12px;
        padding: 18px;
        background: #fff;
        box-shadow: 0 14px 36px rgba(24, 40, 68, 0.08);
      }
      .featured-card {
        border-color: #b9d2ef;
        background:
          linear-gradient(180deg, rgba(47, 111, 237, 0.08), transparent 44%),
          #ffffff;
      }
      .template-card h4 {
        margin: 0;
        color: #172033;
        font-size: 20px;
      }
      .template-card .type,
      .profile {
        display: inline-flex;
        width: max-content;
        border-radius: 999px;
        padding: 5px 9px;
        color: #0f4f79;
        background: #e9f5fb;
        font-size: 12px;
        font-weight: 800;
      }
      .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .profile {
        color: #5a3b0b;
        background: #fff3d5;
      }
      .template-card p {
        margin: 0;
        font-size: 15px;
        line-height: 1.5;
      }
      .best-for {
        border-left: 3px solid #0f766e;
        padding-left: 10px;
        color: #40526b;
        font-size: 13px;
        line-height: 1.45;
      }
      .template-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .template-actions a {
        display: inline-flex;
        min-height: 38px;
        align-items: center;
        justify-content: center;
        padding: 9px 11px;
        font-size: 13px;
        text-align: center;
      }
      .template-actions a:nth-child(3),
      .template-actions a:nth-child(4) {
        color: #0f5f58;
        background: #f3fbf8;
      }
      .sample-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-top: 18px;
      }
      .sample-card {
        display: grid;
        gap: 12px;
        border: 1px solid #cdd7e6;
        border-radius: 12px;
        padding: 18px;
        background: #fff;
        box-shadow: 0 14px 36px rgba(24, 40, 68, 0.08);
      }
      .sample-card h3 {
        margin: 0;
        color: #172033;
        font-size: 20px;
        line-height: 1.25;
      }
      .sample-card p {
        margin: 0;
        font-size: 15px;
        line-height: 1.5;
      }
      .sample-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .sample-actions a {
        display: inline-flex;
        min-height: 38px;
        align-items: center;
        justify-content: center;
        padding: 9px 11px;
        font-size: 13px;
        text-align: center;
      }
      .sample-actions a:first-child {
        border-color: #193b70;
        color: #ffffff;
        background: #193b70;
      }
      .sample-actions a:first-child:hover,
      .sample-actions a:first-child:focus-visible {
        color: #ffffff;
        background: #264c82;
      }
      .command {
        display: block;
        overflow-x: auto;
        margin-top: 12px;
        border-radius: 10px;
        padding: 12px;
        background: #101827;
        color: #d7e8ff;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre;
      }
      @media (max-width: 760px) {
        main {
          padding: 28px 14px;
        }
        .hero-panel {
          padding: 24px;
        }
        .hero-grid,
        .hero-metrics {
          grid-template-columns: 1fr;
        }
        .workflow {
          grid-template-columns: 1fr;
        }
        .template-grid,
        .featured-grid,
        .sample-grid,
        .sample-actions {
          grid-template-columns: 1fr;
        }
        h1 {
          font-size: 34px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero-panel" aria-label="OpenWebDoc overview">
        <div class="hero-grid">
          <div>
            <p class="eyebrow">Agent-safe document packages</p>
            <h1>OpenWebDoc</h1>
            <p>HTMLX is a browser-readable document package for opening, editing, validating, and sharing HTML/CSS documents that external AI coding agents can safely revise as package-local files.</p>
            <nav aria-label="OpenWebDoc app">
              <a class="primary-link" href="./app/">Open OpenWebDoc</a>
              <a href="#templates">Browse templates</a>
              <a href="https://github.com/lhy0718/OpenWebDoc">View repository</a>
              <a href="https://github.com/lhy0718/OpenWebDoc/releases/tag/${currentReleaseTag}">Release ${currentReleaseTag}</a>
            </nav>
            <nav class="secondary-nav" aria-label="OpenWebDoc documentation">
              <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/agents/index.md">Agent cookbook</a>
              <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/github-action.md">GitHub Action</a>
              <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/conformance.md">Conformance</a>
              <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/security-brief.md">Security brief</a>
              <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/faq.md">FAQ</a>
            </nav>
          </div>
          <div class="hero-metrics" aria-label="Template gallery summary">
            <div class="hero-metric"><strong>${templates.length}</strong><span>public examples and templates</span></div>
            <div class="hero-metric"><strong>3</strong><span>HTMLX profiles: flow, fixed-stage, slide deck</span></div>
            <div class="hero-metric"><strong>0</strong><span>browser-side model keys or hidden agent prompts</span></div>
          </div>
        </div>
      </section>
      <section aria-label="HTMLX workflow">
        <h2>Open, validate, edit with an agent, export</h2>
        <p>The core workflow is package-local: open a document, validate it, let an external agent edit ordinary HTML/CSS/metadata/assets, refresh reference metadata, then pack and validate again.</p>
        <div class="workflow">
          <div class="workflow-step"><strong>1. Open</strong><span>Read a local <code>.htmlx</code> package in the browser.</span></div>
          <div class="workflow-step"><strong>2. Validate</strong><span>Reject scripts, remote resources, path traversal, stale metadata, and undeclared assets.</span></div>
          <div class="workflow-step"><strong>3. Agent edit</strong><span>Revise unpacked package files directly instead of using hidden prompts or browser API keys.</span></div>
          <div class="workflow-step"><strong>4. Export</strong><span>Pack the edited directory and validate the final portable document.</span></div>
        </div>
      </section>
      <section id="templates" aria-label="Template gallery">
        <h2>Template gallery</h2>
        <p>Preview a package in the OpenWebDoc app, download the <code>.htmlx</code> file, validate it in CI, or follow the package-file editing workflow for an external coding agent.</p>
        <div class="featured-grid" aria-label="Recommended starting points">
          ${featuredTemplates.map((template) => renderTemplateCard(template, { featured: true })).join("\n          ")}
        </div>
        ${Array.from(groupedTemplates.entries())
          .map(
            ([
              category,
              categoryTemplates,
            ]) => `<section class="template-section" aria-label="${escapeHtml(category)}">
          <h3>${escapeHtml(category)}</h3>
          <p>${categoryDescription(category)}</p>
          <div class="template-grid">
            ${categoryTemplates.map((template) => renderTemplateCard(template)).join("\n            ")}
          </div>
        </section>`,
          )
          .join("\n        ")}
      </section>
      <section id="starter-repositories" aria-label="Starter repositories">
        <h2>Starter repositories</h2>
        <p>Download a copyable repository skeleton when you want to try HTMLX in a separate GitHub repository with pull-request validation already wired in.</p>
        <div class="sample-grid">
          ${sampleRepositories.map((repository) => renderSampleRepositoryCard(repository)).join("\n          ")}
        </div>
      </section>
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
      templates: templates.map((template) => ({
        id: template.id,
        name: template.title,
        type: template.type,
        profile: template.profile,
        category: template.category,
        audience: template.audience,
        preview: `${app.route}/?example=${template.id}`,
        download: `${app.route}/examples/${template.id}.htmlx`,
      })),
      sampleRepositories: sampleRepositories.map((repository) => ({
        id: repository.id,
        description: repository.description,
        url: repository.url,
        archive: `${sampleRepoSiteDirectory}/${repository.id}.zip`,
      })),
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

function runNode(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function writeSampleRepositoryArchives() {
  for (const repository of sampleRepositories) {
    const sourceDirectory = join(sampleRepoExportDirectory, repository.id);
    const destination = join(siteDirectory, sampleRepoSiteDirectory, `${repository.id}.zip`);
    const files = await readZipInputFiles(sourceDirectory);
    await writeFile(destination, createStoreZip(files));
  }
}

async function readZipInputFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readZipInputFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) continue;
      files.push({
        path: relativePath,
        data: await readFile(absolutePath),
      });
    }
  }
  return files;
}

function createStoreZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const filename = Buffer.from(file.path, "utf8");
    const data = Buffer.from(file.data);
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(33, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, filename, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(33, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, filename);

    offset += localHeader.length + filename.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function groupTemplatesByCategory(items) {
  const groups = new Map();
  for (const item of items.filter((template) => !template.featured)) {
    const entries = groups.get(item.category) ?? [];
    entries.push(item);
    groups.set(item.category, entries);
  }
  return groups;
}

function renderTemplateCard(template, options = {}) {
  const featuredClass = options.featured ? " featured-card" : "";
  return `<article class="template-card${featuredClass}">
            <div class="meta-row">
              <span class="type">${escapeHtml(template.type)}</span>
              <span class="profile">${escapeHtml(profileLabel(template.profile))}</span>
            </div>
            <h4>${escapeHtml(template.title)}</h4>
            <p>${escapeHtml(template.description)}</p>
            <span class="best-for">${escapeHtml(template.bestFor)}</span>
            <div class="template-actions">
              <a href="./app/?example=${template.id}">Preview</a>
              <a href="./app/examples/${template.id}.htmlx" download>Download .htmlx</a>
              <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/github-action.md">Validate in CI</a>
              <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/agent-editing.md">Agent edit</a>
            </div>
            <code class="command">pnpm htmlx unpack ${template.id}.htmlx ./work --json
pnpm htmlx refresh-metadata ./work --check --json
pnpm htmlx validate ./work --json</code>
          </article>`;
}

function renderSampleRepositoryCard(repository) {
  return `<article class="sample-card">
            <h3>${escapeHtml(repository.id)}</h3>
            <p>${escapeHtml(repository.description)}</p>
            <div class="sample-actions">
              <a href="${escapeHtml(repository.url)}">Use template repo</a>
              <a href="./${sampleRepoSiteDirectory}/${repository.id}.zip" download>Download ZIP</a>
              <a href="https://github.com/lhy0718/OpenWebDoc/tree/main/${escapeHtml(repository.source)}">View source</a>
            </div>
            <code class="command">Open a pull request
Validate HTMLX checks documents/**/*.htmlx</code>
          </article>`;
}

function profileLabel(profile) {
  if (profile === "flow-document") return "Flow";
  if (profile === "fixed-stage-document") return "Fixed-stage";
  if (profile === "slide-deck") return "Slide deck";
  return profile;
}

function categoryDescription(category) {
  if (category === "General documents") {
    return "Editable document packages for reports, specs, proposals, manuals, and team artifacts.";
  }
  if (category === "Presentations") {
    return "HTMLX-native slide decks that read as documents and present one 16:9 slide at a time.";
  }
  return "Recommended entry points for learning the format and runtime.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
