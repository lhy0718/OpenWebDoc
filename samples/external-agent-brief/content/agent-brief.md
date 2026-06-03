# Agent-Edited Brief

This brief demonstrates the external-agent editing boundary for HTMLX.

## Operating principle

Large document changes happen in unpacked package files. The browser runtime stays focused on reading and small corrections.

## Pull request expectation

- The agent edits package-local files.
- Metadata is refreshed after visible text or block IDs change.
- The directory validates before packing.
- The final `.htmlx` validates before review.
