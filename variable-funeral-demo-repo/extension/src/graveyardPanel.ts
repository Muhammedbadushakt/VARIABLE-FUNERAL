import * as vscode from 'vscode';
import { BuriedRecord, GraveyardStats, Tombstone } from './types';

type OutboundMessage =
  | { type: 'state'; tombstones: Tombstone[]; buried: BuriedRecord[]; stats: GraveyardStats };

type InboundMessage =
  | { type: 'ready' }
  | { type: 'jump'; id: string }
  | { type: 'bury'; id: string }
  | { type: 'ignore'; id: string }
  | { type: 'resurrect'; id: string };

export interface GraveyardDataSource {
  getTombstones(): Tombstone[];
  getBuried(): BuriedRecord[];
  getStats(): GraveyardStats;
  ignore(id: string): void;
  bury(id: string): Promise<void>;
  resurrect(id: string): Promise<void>;
  jumpTo(id: string): Promise<void>;
}

export class GraveyardPanel {
  private static current: GraveyardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri, dataSource: GraveyardDataSource) {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (GraveyardPanel.current) {
      GraveyardPanel.current.panel.reveal(column);
      GraveyardPanel.current.refresh();
      return GraveyardPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      'variableFuneralGraveyard',
      'Graveyard — Variable Funeral',
      column ?? vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    GraveyardPanel.current = new GraveyardPanel(panel, extensionUri, dataSource);
    return GraveyardPanel.current;
  }

  /** Called by extension.ts after every scan so an already-open panel updates live. */
  static refreshIfOpen() {
    GraveyardPanel.current?.refresh();
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly dataSource: GraveyardDataSource
  ) {
    this.panel = panel;
    this.panel.webview.html = this.renderHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message: InboundMessage) => {
        switch (message.type) {
          case 'ready':
            this.refresh();
            break;
          case 'jump':
            await this.dataSource.jumpTo(message.id);
            break;
          case 'bury':
            await this.dataSource.bury(message.id);
            this.refresh();
            break;
          case 'ignore':
            this.dataSource.ignore(message.id);
            this.refresh();
            break;
          case 'resurrect':
            await this.dataSource.resurrect(message.id);
            this.refresh();
            break;
        }
      },
      null,
      this.disposables
    );
  }

  refresh() {
    const message: OutboundMessage = {
      type: 'state',
      tombstones: this.dataSource.getTombstones(),
      buried: this.dataSource.getBuried(),
      stats: this.dataSource.getStats()
    };
    this.panel.webview.postMessage(message);
  }

  private dispose() {
    GraveyardPanel.current = undefined;
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }

  private renderHtml(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'graveyard.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'graveyard.js')
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Graveyard</title>
</head>
<body>
  <div class="ambient" aria-hidden="true">
    <div class="smoke"></div>
    <div class="smoke s2"></div>
    <div class="smoke s3"></div>
  </div>
  <div class="fog-layer" aria-hidden="true">
    <div class="fog-bank"></div>
    <div class="fog-bank f2"></div>
  </div>
  <div id="snow" class="snow" aria-hidden="true"></div>
  <div class="shell">
  <header class="topbar">
    <div class="title">
      <span class="glyph" aria-hidden="true">⚰</span>
      <div><h1>Variable Funeral</h1><small>Dead code cemetery • enter if you dare</small></div>
    </div>
    <dl class="stats" id="stats">
      <div class="stat stat-alive"><dt>Alive</dt><dd id="stat-alive">0</dd></div>
      <div class="stat stat-dead"><dt>Dead</dt><dd id="stat-dead">0</dd></div>
      <div class="stat stat-buried"><dt>Buried</dt><dd id="stat-buried">0</dd></div>
    </dl>
  </header>

  <div class="toolbar">
    <input id="search" type="text" placeholder="Search the graveyard by name or file…" aria-label="Search graves" />
    <div class="filters" id="filters" role="group" aria-label="Filter by kind">
      <button class="filter-chip is-active" data-kind="all">All</button>
      <button class="filter-chip" data-kind="const">Const</button>
      <button class="filter-chip" data-kind="let">Let</button>
      <button class="filter-chip" data-kind="var">Var</button>
      <button class="filter-chip" data-kind="parameter">Params</button>
      <button class="filter-chip" data-kind="import">Imports</button>
      <button class="filter-chip" data-kind="function">Functions</button>
      <button class="filter-chip" data-kind="class">Classes</button>
    </div>
    <select id="sort" aria-label="Sort graves">
      <option value="file">Sort: File</option>
      <option value="name">Sort: Name</option>
      <option value="recent">Sort: Most recent</option>
    </select>
  </div>

  <main id="grid" class="grid" aria-live="polite"></main>

  <section id="empty" class="empty" hidden>
    <div class="fog"></div>
    <p>The graveyard is empty. Run a scan to find dead code.</p>
  </section>

  <footer class="memorial">
    <h2>Recently buried</h2>
    <ul id="buried-list" class="buried-list"></ul>
  </footer>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
