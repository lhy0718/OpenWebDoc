# Support Quality Report

This source note describes the report that is packaged as
`documents/support-quality-report.htmlx`.

## Why this repository uses HTMLX

- The report can include tables and local assets while staying browser-readable.
- A coding agent can revise bounded sections in unpacked package files.
- Pull requests fail when package integrity, resources, security rules, or metadata
  freshness break.

## Review checklist

1. Confirm the metric interpretation is still correct.
2. Confirm the `.htmlx` package validates.
3. Open the package in the OpenWebDoc app for visual review.
4. Keep large redesigns in package files, not in the browser runtime.
