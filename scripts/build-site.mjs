import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const siteDirectory = "dist/site";
const packages = ["@openwebdoc/spec", "@openwebdoc/core", "@openwebdoc/ui"];
const app = { name: "OpenWebDoc", packageName: "@openwebdoc/app", route: "app" };
const templates = [
  {
    id: "template-flow-article",
    title: "Flow Document Brief",
    type: "Flow document",
    description: "Default reflowing HTMLX document profile with semantic content.",
  },
  {
    id: "template-research-brief",
    title: "Research Brief",
    type: "Document",
    description: "Evidence, claims, decisions, and follow-up questions.",
  },
  {
    id: "template-product-spec",
    title: "Product Spec",
    type: "Document",
    description: "Requirements, non-goals, release gates, and owner decisions.",
  },
  {
    id: "template-operations-manual",
    title: "Operations Manual",
    type: "Document",
    description: "Safe package intake, validation, and escalation procedure.",
  },
  {
    id: "template-meeting-notes",
    title: "Meeting Notes",
    type: "Document",
    description: "Agenda, decisions, owners, due dates, and follow-up actions.",
  },
  {
    id: "template-project-proposal",
    title: "Project Proposal",
    type: "Document",
    description: "Need, approach, validation plan, and expected outcomes.",
  },
  {
    id: "template-data-report",
    title: "Data Report",
    type: "Document",
    description: "Headline metrics, method notes, data table, and interpretation.",
  },
  {
    id: "template-pitch-deck",
    title: "Pitch Deck",
    type: "Presentation",
    description: "Problem, solution, user boundary, and ask.",
  },
  {
    id: "template-lesson-deck",
    title: "Lesson Deck",
    type: "Presentation",
    description: "Concept, practice, and recap slides for workshops.",
  },
  {
    id: "template-research-talk",
    title: "Research Talk",
    type: "Presentation",
    description: "Research question, method, evidence, and limitations.",
  },
  {
    id: "template-status-review-deck",
    title: "Status Review Deck",
    type: "Presentation",
    description: "Progress, risks, decisions, and commitments.",
  },
];

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
      code {
        border-radius: 6px;
        padding: 2px 5px;
        background: #edf3fb;
        color: #1b365d;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
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
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 18px;
      }
      .template-card {
        border: 1px solid #cdd7e6;
        border-radius: 12px;
        padding: 18px;
        background: #fff;
        box-shadow: 0 14px 36px rgba(24, 40, 68, 0.08);
      }
      .template-card h3 {
        margin: 0;
        color: #172033;
        font-size: 20px;
      }
      .template-card .type {
        display: inline-flex;
        margin: 0 0 10px;
        border-radius: 999px;
        padding: 5px 9px;
        color: #0f4f79;
        background: #e9f5fb;
        font-size: 12px;
        font-weight: 800;
      }
      .template-card p {
        margin: 10px 0 14px;
        font-size: 15px;
        line-height: 1.5;
      }
      .template-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .template-actions a {
        padding: 9px 11px;
        font-size: 13px;
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
        .workflow {
          grid-template-columns: 1fr;
        }
        .template-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Agent-safe document packages</p>
      <h1>OpenWebDoc</h1>
      <p>HTMLX is a browser-readable document package that AI coding agents can edit through a validated local workflow. OpenWebDoc is the reference opener, validator, template gallery, and runtime.</p>
      <nav aria-label="OpenWebDoc app">
        <a href="./app/">Open OpenWebDoc</a>
        <a href="./app/?example=openwebdoc-introduction">View introduction</a>
        <a href="./app/?example=openwebdoc-slide-deck">View slide deck</a>
      </nav>
      <nav class="secondary-nav" aria-label="OpenWebDoc documentation">
        <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/agents/index.md">Agent cookbook</a>
        <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/github-action.md">GitHub Action</a>
        <a href="https://github.com/lhy0718/OpenWebDoc/blob/main/docs/faq.md">FAQ</a>
      </nav>
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
      <section aria-label="Template gallery">
        <h2>Template gallery</h2>
        <p>Preview a template in the OpenWebDoc app, download the <code>.htmlx</code> package, or copy the command boundary into an agent workflow.</p>
        <div class="template-grid">
          ${templates
            .map(
              (template) => `<article class="template-card">
            <span class="type">${template.type}</span>
            <h3>${template.title}</h3>
            <p>${template.description}</p>
            <div class="template-actions">
              <a href="./app/?example=${template.id}">Preview</a>
              <a href="./app/examples/${template.id}.htmlx" download>Download .htmlx</a>
            </div>
            <code class="command">htmlx unpack ${template.id}.htmlx ./work --json
htmlx refresh-metadata ./work --check --json
htmlx validate ./work --json</code>
          </article>`,
            )
            .join("\n          ")}
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
        name: template.title,
        type: template.type,
        preview: `${app.route}/?example=${template.id}`,
        download: `${app.route}/examples/${template.id}.htmlx`,
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
