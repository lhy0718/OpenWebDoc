import "@openwebdoc/ui/styles.css";
import "./style.css";
import {
  AppShell,
  EmptyState,
  ManifestSummary,
  SecurityNote,
  ValidationPanel,
} from "@openwebdoc/ui";
import { Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface ViewerState {
  filename: string;
  html?: string;
  manifest?: Record<string, unknown>;
  entries: string[];
  issues: Array<{ severity: "error" | "warning"; code: string; message: string; path?: string }>;
  revoke?: () => void;
}

function ViewerApp() {
  const [state, setState] = useState<ViewerState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => state?.revoke?.();
  }, [state]);

  async function openFile(file: File) {
    setBusy(true);
    state?.revoke?.();
    const { openHtmlx, resolveHtmlxDocument, validateHtmlx } = await import("@openwebdoc/core");

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const validation = await validateHtmlx(bytes);
      if (!validation.valid) {
        setState({
          filename: file.name,
          manifest: validation.manifest as unknown as Record<string, unknown>,
          entries: [],
          issues: validation.issues,
        });
        return;
      }

      const pkg = await openHtmlx(bytes);
      const resolved = resolveHtmlxDocument(pkg);
      setState({
        filename: file.name,
        html: resolved.html,
        manifest: pkg.manifest as unknown as Record<string, unknown>,
        entries: [...pkg.files.keys()].sort(),
        issues: pkg.validation.issues,
        revoke: resolved.revoke,
      });
    } catch (error) {
      setState({
        filename: file.name,
        entries: [],
        issues: [
          {
            severity: "error",
            code: "viewer.open_failed",
            message: error instanceof Error ? error.message : "Unable to open HTMLX package.",
          },
        ],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="HTMLX Viewer"
      subtitle="Open and inspect pageless HTMLX Document Package files with local-only validation."
      aside={
        <>
          <ManifestSummary manifest={state?.manifest} />
          <ValidationPanel issues={state?.issues ?? []} />
          <SecurityNote />
        </>
      }
    >
      <section className="viewer-toolbar">
        <label className="file-button">
          <Upload size={18} />
          <span>{busy ? "Opening..." : "Open .htmlx"}</span>
          <input
            type="file"
            accept=".htmlx,application/vnd.openwebdoc.htmlx+zip"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void openFile(file);
            }}
          />
        </label>
        {state ? <span className="filename">{state.filename}</span> : null}
      </section>

      {state?.html ? (
        <section className="document-surface">
          <iframe title="HTMLX document" sandbox="" srcDoc={state.html} />
        </section>
      ) : (
        <EmptyState
          title="No document loaded"
          body="Choose a local .htmlx package to validate and render its sanitized HTML entry."
        />
      )}

      {state?.entries.length ? (
        <section className="entry-list">
          <h2>Package Entries</h2>
          <ul>
            {state.entries.map((entry) => (
              <li key={entry}>
                <code>{entry}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(<ViewerApp />);
