# Variable Funeral — Extension Quickstart

## What's in the folder

- `package.json` — the extension manifest. Declares commands, settings, and
  points `main` at `./dist/extension.js` (the esbuild bundle).
- `src/extension.ts` — the extension entry point: registers commands,
  diagnostics, the graveyard quick-pick, and the status bar item.
- `src/analyzer.ts` — pure AST walker (no `vscode` import) that finds
  candidate declarations using the `typescript` compiler API.
- `src/humor.ts` — static (non-AI) cause-of-death / epitaph text generator.
- `src/types.ts` — shared types.
- `src/test/extension.test.ts` — smoke test verifying commands register.

## Get up and running

1. `npm install`
2. Press `F5` to open a new window with the extension loaded (this runs the
   `watch` build task first automatically).
3. Open any `.js`/`.ts`/`.jsx`/`.tsx` file in the dev host window, then run
   one of the `Variable Funeral: ...` commands from the Command Palette
   (`Cmd+Shift+P` / `Ctrl+Shift+P`).
4. Set breakpoints in `src/extension.ts` to debug.
5. Edit source files — the watch task rebuilds automatically; reload the
   dev host window (`Cmd+R` / `Ctrl+R`) to pick up changes.

## Run tests

1. Install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
2. Run the "watch-tests" task via **Tasks: Run Task**
3. Open the Testing view and click "Run Test", or `F5` with the "Extension
   Tests" launch config

## Package for distribution

```
npx vsce package
```

This runs the `vscode:prepublish` script (type-check, lint, production
esbuild bundle) and produces a `.vsix` you can install via
**Extensions: Install from VSIX...**.

## Roadmap

See `README.md` for the full feature roadmap (v0.2 webview graveyard, v0.3
AI-generated funeral content via a Flask backend, v0.4 gamification).
