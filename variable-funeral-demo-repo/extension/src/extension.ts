import * as vscode from 'vscode';
import { findCandidateDeclarations } from './analyzer';
import { causeOfDeath, epitaph } from './humor';
import { BuriedRecord, GraveyardStats, Tombstone } from './types';
import { GraveyardDataSource, GraveyardPanel } from './graveyardPanel';

const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact'
]);

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

/** filePath -> tombstones currently DEAD in that file. Rebuilt on every scan of that file. */
const graveyard = new Map<string, Tombstone[]>();
/** filePath -> count of candidate declarations that turned out to be in use. */
const aliveCounts = new Map<string, number>();
/** ids the user chose to "Ignore" — excluded from future scans until Clear Results. */
const ignoredIds = new Set<string>();
/** Declarations that were actually removed from source, most recent last. */
let buriedRecords: BuriedRecord[] = [];

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('variableFuneral');
  outputChannel = vscode.window.createOutputChannel('Variable Funeral');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'variableFuneral.openGraveyard';
  statusBarItem.text = '$(circle-outline) Variable Funeral';
  statusBarItem.tooltip = 'Open the graveyard';
  statusBarItem.show();

  const dataSource: GraveyardDataSource = {
    getTombstones,
    getBuried: () => buriedRecords,
    getStats,
    ignore,
    bury,
    resurrect,
    jumpTo
  };

  context.subscriptions.push(
    diagnosticCollection,
    outputChannel,
    statusBarItem,
    vscode.commands.registerCommand('variableFuneral.scanFile', () => scanActiveFile()),
    vscode.commands.registerCommand('variableFuneral.scanWorkspace', () => scanWorkspace()),
    vscode.commands.registerCommand('variableFuneral.openGraveyard', () =>
      GraveyardPanel.createOrShow(context.extensionUri, dataSource)
    ),
    vscode.commands.registerCommand('variableFuneral.clear', () => clearAll()),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const config = vscode.workspace.getConfiguration('variableFuneral');
      if (config.get<boolean>('autoScanOnSave') && SUPPORTED_LANGUAGES.has(doc.languageId)) {
        scanDocument(doc);
      }
    })
  );

  updateStatusBar();
}

export function deactivate() {
  diagnosticCollection?.dispose();
  statusBarItem?.dispose();
}

async function scanActiveFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Variable Funeral: no active editor to scan.');
    return;
  }
  if (!SUPPORTED_LANGUAGES.has(editor.document.languageId)) {
    vscode.window.showWarningMessage(
      `Variable Funeral: "${editor.document.languageId}" isn't supported yet. JS/TS/JSX/TSX only for now.`
    );
    return;
  }
  const count = await scanDocument(editor.document);
  vscode.window.showInformationMessage(
    count === 0
      ? `Variable Funeral: nothing dead in ${basename(editor.document.fileName)}. Clean file.`
      : `Variable Funeral: found ${count} dead declaration${count === 1 ? '' : 's'} in ${basename(
          editor.document.fileName
        )}.`
  );
}

async function scanWorkspace() {
  const config = vscode.workspace.getConfiguration('variableFuneral');
  const ignore = config.get<string[]>('ignorePatterns') ?? [];
  const excludeGlob = `{${ignore.join(',')}}`;

  const files = await vscode.workspace.findFiles('**/*.{js,jsx,ts,tsx}', excludeGlob, 2000);

  if (files.length === 0) {
    vscode.window.showInformationMessage('Variable Funeral: no matching files found in workspace.');
    return;
  }

  let totalDead = 0;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Variable Funeral: scanning workspace',
      cancellable: true
    },
    async (progress, token) => {
      for (let i = 0; i < files.length; i++) {
        if (token.isCancellationRequested) {
          break;
        }
        const uri = files[i];
        progress.report({
          message: `${basename(uri.fsPath)} (${i + 1}/${files.length})`,
          increment: 100 / files.length
        });
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          totalDead += await scanDocument(doc);
        } catch (err) {
          outputChannel.appendLine(`Failed to scan ${uri.fsPath}: ${err}`);
        }
      }
    }
  );

  vscode.window.showInformationMessage(
    `Variable Funeral: workspace scan complete. ${totalDead} dead declaration${
      totalDead === 1 ? '' : 's'
    } found across ${files.length} files.`
  );
}

/** Scans one document, updates its diagnostics + graveyard entries, returns dead count. */
async function scanDocument(document: vscode.TextDocument): Promise<number> {
  const config = vscode.workspace.getConfiguration('variableFuneral');
  const ignoreNames = new Set(config.get<string[]>('ignoreNames') ?? []);

  const text = document.getText();
  const candidates = findCandidateDeclarations(text, document.fileName).filter(
    (c) => !ignoreNames.has(c.name)
  );

  const diagnostics: vscode.Diagnostic[] = [];
  const tombstones: Tombstone[] = [];
  let alive = 0;

  for (const candidate of candidates) {
    const id = `${document.uri.toString()}#${candidate.offset}`;
    if (ignoredIds.has(id)) {
      continue;
    }

    const position = document.positionAt(candidate.offset);
    const isDead = await isUnreferenced(document, position);
    if (!isDead) {
      alive++;
      continue;
    }

    const range = document.getWordRangeAtPosition(position) ?? new vscode.Range(position, position);
    const cause = causeOfDeath(candidate.name, candidate.kind, candidate.offset);

    const diagnostic = new vscode.Diagnostic(
      range,
      `💀 "${candidate.name}" is dead. ${cause}`,
      vscode.DiagnosticSeverity.Information
    );
    diagnostic.source = 'Variable Funeral';
    diagnostic.code = candidate.kind;
    diagnostics.push(diagnostic);

    tombstones.push({
      id,
      name: candidate.name,
      kind: candidate.kind,
      verdict: 'DEAD',
      filePath: document.uri.fsPath,
      fileName: basename(document.fileName),
      line: position.line,
      character: position.character,
      causeOfDeath: cause,
      epitaph: epitaph(candidate.name, candidate.offset),
      detectedAt: Date.now()
    });
  }

  diagnosticCollection.set(document.uri, diagnostics);
  graveyard.set(document.uri.fsPath, tombstones);
  aliveCounts.set(document.uri.fsPath, alive);
  updateStatusBar();
  GraveyardPanel.refreshIfOpen();

  return tombstones.length;
}

/**
 * Asks VS Code's built-in language service how many references this symbol
 * has. If the only reference is the declaration itself, it's dead.
 */
async function isUnreferenced(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<boolean> {
  try {
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      document.uri,
      position
    );
    if (!locations) {
      return false;
    }
    return locations.length <= 1;
  } catch {
    return false;
  }
}

function updateStatusBar() {
  const { dead } = getStats();
  statusBarItem.text = dead === 0 ? '$(circle-outline) Variable Funeral' : `$(warning) ${dead} dead`;
  statusBarItem.tooltip =
    dead === 0 ? 'No dead code detected yet' : `${dead} dead declaration(s) — click to open graveyard`;
}

function getTombstones(): Tombstone[] {
  const all: Tombstone[] = [];
  for (const tombstones of graveyard.values()) {
    all.push(...tombstones);
  }
  return all;
}

function getStats(): GraveyardStats {
  let dead = 0;
  for (const tombstones of graveyard.values()) {
    dead += tombstones.length;
  }
  let alive = 0;
  for (const count of aliveCounts.values()) {
    alive += count;
  }
  return { alive, dead, buried: buriedRecords.length };
}

function findTombstone(id: string): Tombstone | undefined {
  for (const tombstones of graveyard.values()) {
    const found = tombstones.find((t) => t.id === id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

async function jumpTo(id: string) {
  const t = findTombstone(id);
  if (!t) {
    vscode.window.showWarningMessage('Variable Funeral: that grave is no longer available — try rescanning.');
    return;
  }
  const uri = vscode.Uri.file(t.filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
  const pos = new vscode.Position(t.line, t.character);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}

function ignore(id: string) {
  ignoredIds.add(id);
  const t = findTombstone(id);
  if (!t) {
    return;
  }
  const uri = vscode.Uri.file(t.filePath);
  vscode.workspace.openTextDocument(uri).then((doc) => scanDocument(doc));
}

/**
 * Removes the declaration's entire line from source, after explicit
 * confirmation that shows exactly what will be deleted. The edit goes
 * through the normal VS Code undo stack, so Ctrl+Z always works; "Resurrect"
 * is a convenience on top of that for after the panel/session has moved on.
 */
async function bury(id: string) {
  const t = findTombstone(id);
  if (!t) {
    vscode.window.showWarningMessage('Variable Funeral: that grave is no longer available — try rescanning.');
    return;
  }

  const uri = vscode.Uri.file(t.filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  if (t.line >= doc.lineCount) {
    vscode.window.showWarningMessage('Variable Funeral: the file has changed since this was detected — rescan first.');
    return;
  }

  const lineText = doc.lineAt(t.line).text;
  const choice = await vscode.window.showWarningMessage(
    `Bury "${t.name}"? This deletes this line:`,
    { modal: true, detail: lineText.trim() },
    'Bury it'
  );
  if (choice !== 'Bury it') {
    return;
  }

  const range = doc.lineAt(t.line).rangeIncludingLineBreak;
  const removedText = doc.getText(range);

  const edit = new vscode.WorkspaceEdit();
  edit.delete(uri, range);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage('Variable Funeral: could not apply the edit. Nothing was buried.');
    return;
  }

  buriedRecords.push({
    id: t.id,
    name: t.name,
    kind: t.kind,
    filePath: t.filePath,
    fileName: t.fileName,
    line: t.line,
    removedText,
    buriedAt: Date.now()
  });

  const freshDoc = await vscode.workspace.openTextDocument(uri);
  await scanDocument(freshDoc);
  vscode.window.setStatusBarMessage(`⚰️ ${epitaph(t.name, 0)}`, 4000);
}

/** Best-effort: re-inserts the removed text at the line it was buried from. */
async function resurrect(id: string) {
  const recordIndex = buriedRecords.findIndex((b) => b.id === id);
  if (recordIndex === -1) {
    return;
  }
  const record = buriedRecords[recordIndex];
  const uri = vscode.Uri.file(record.filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const targetLine = Math.min(record.line, doc.lineCount);
  const insertPos = new vscode.Position(targetLine, 0);

  const edit = new vscode.WorkspaceEdit();
  edit.insert(uri, insertPos, record.removedText);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage('Variable Funeral: could not resurrect — the surrounding code may have changed too much.');
    return;
  }

  buriedRecords = buriedRecords.filter((b) => b.id !== id);
  const freshDoc = await vscode.workspace.openTextDocument(uri);
  await scanDocument(freshDoc);
  vscode.window.showInformationMessage(`"${record.name}" has risen again.`);
}

function clearAll() {
  diagnosticCollection.clear();
  graveyard.clear();
  aliveCounts.clear();
  ignoredIds.clear();
  buriedRecords = [];
  updateStatusBar();
  GraveyardPanel.refreshIfOpen();
  vscode.window.showInformationMessage('Variable Funeral: graveyard cleared.');
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1];
}
