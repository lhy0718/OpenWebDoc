import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  FileText,
  Info,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";

export interface IssueLike {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export function AppShell({
  title,
  subtitle,
  children,
  aside,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="owd-shell">
      <header className="owd-header">
        <div>
          <div className="owd-brand">
            <FileArchive size={22} aria-hidden="true" />
            <span>OpenWebDoc</span>
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="owd-layout">
        <main>{children}</main>
        {aside ? <aside>{aside}</aside> : null}
      </div>
    </div>
  );
}

export function ValidationPanel({ issues }: { issues: IssueLike[] }) {
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return (
    <section className="owd-panel">
      <div className="owd-panel-title">
        {hasErrors ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        <h2>Validation</h2>
      </div>
      {issues.length === 0 ? (
        <p className="owd-muted">No validation issues.</p>
      ) : (
        <ul className="owd-issue-list">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className={`owd-issue owd-${issue.severity}`}>
              <strong>{issue.code}</strong>
              <span>{issue.message}</span>
              {issue.path ? <code>{issue.path}</code> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ManifestSummary({ manifest }: { manifest?: Record<string, unknown> }) {
  return (
    <section className="owd-panel">
      <div className="owd-panel-title">
        <FileText size={18} />
        <h2>Manifest</h2>
      </div>
      {manifest ? (
        <dl className="owd-kv">
          <dt>Title</dt>
          <dd>{String(manifest.title ?? "")}</dd>
          <dt>Version</dt>
          <dd>{String(manifest.htmlxVersion ?? "")}</dd>
          <dt>Language</dt>
          <dd>{String(manifest.language ?? "")}</dd>
          <dt>Entry</dt>
          <dd>
            <code>{String(manifest.entry ?? "")}</code>
          </dd>
        </dl>
      ) : (
        <p className="owd-muted">No manifest loaded.</p>
      )}
    </section>
  );
}

export function SecurityNote() {
  return (
    <section className="owd-panel owd-security">
      <div className="owd-panel-title">
        <ShieldCheck size={18} />
        <h2>Security Model</h2>
      </div>
      <p>
        HTMLX packages are treated as untrusted input. Scripts, inline event handlers, remote
        resources, and unsafe paths are blocked by default.
      </p>
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="owd-empty">
      <Info size={28} />
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
