const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const viewType = 'biztalkRulesViewer.editor';

function configureWebview(webview, context) {
  const mediaUri = vscode.Uri.joinPath(context.extensionUri, 'media');
  const nonce = Math.random().toString(36).slice(2);
  let html = fs.readFileSync(path.join(context.extensionPath, 'media', 'index.html'), 'utf8');
  html = html.replaceAll('{{nonce}}', nonce).replaceAll('{{cspSource}}', webview.cspSource)
    .replace(/{{media}}\/([\w.-]+)/g, (_, file) => webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, file)).toString());
  webview.options = { enableScripts: true, localResourceRoots: [mediaUri] };
  webview.html = html;
}

function activate(context) {
  const provider = vscode.window.registerCustomEditorProvider(viewType, {
    resolveCustomTextEditor(document, panel) {
      configureWebview(panel.webview, context);
      const send = () => panel.webview.postMessage({ type: 'openRules', fileName: path.basename(document.uri.fsPath || document.uri.path), source: document.getText() });
      const messages = panel.webview.onDidReceiveMessage(message => { if (message?.type === 'ready') void send(); });
      const changes = vscode.workspace.onDidChangeTextDocument(event => { if (event.document.uri.toString() === document.uri.toString()) void send(); });
      panel.onDidDispose(() => { messages.dispose(); changes.dispose(); });
    },
  }, { webviewOptions: { retainContextWhenHidden: true } });
  const command = vscode.commands.registerCommand('biztalkRulesViewer.open', async uri => {
    const target = uri || (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'BizTalk BRE exports': ['xml', 'brl'] } }))?.[0];
    if (target) await vscode.commands.executeCommand('vscode.openWith', target, viewType);
  });
  context.subscriptions.push(provider, command);
}

module.exports = { activate, deactivate() {} };
