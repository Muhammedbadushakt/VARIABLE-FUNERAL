# Change Log

All notable changes to the "variable-funeral" extension will be documented in this file.

## [0.1.0] - Basic Detector

- Initial scaffold via `yo code`, restructured to esbuild bundling + `@vscode/test-cli`
- AST-based candidate detection (variables, params, imports, functions, classes)
  via the TypeScript compiler API
- Live reference-checking via VS Code's language service to decide dead vs. alive
- Diagnostics with a cause-of-death message, "Open Graveyard" quick pick, status bar counter
- Commands: Scan Current File, Scan Entire Workspace, Open Graveyard, Clear Results
