# BizTalk Rules Engine Viewer

[![Source on GitHub](https://img.shields.io/badge/source-GitHub-181717?logo=github)](https://github.com/lambogenius/biztalk-rules-engine-viewer-vscode)

A local-first, read-only VS Code custom editor for exported BizTalk Business Rules Engine policy XML.

## Features

- Opens exported `.xml` and `.brl` policy files through **Open With...**.
- Lists policies and versions contained in an export.
- Presents each rule as readable IF/THEN sections.
- Shows rule priority and active status.
- Filters rules across names, conditions, and actions.
- Refreshes as the underlying XML document changes.
- Keeps policy data local; the extension makes no network calls.

The first release reads exported policy files. Direct SQL Rule Store access, vocabulary browsing, policy execution, and deployment are outside the initial read-only scope.

## Install locally

Source code: [GitHub repository](https://github.com/lambogenius/biztalk-rules-engine-viewer-vscode)

```powershell
npm run build
npm run reinstall
```

`npm run build` runs the tests and packages the extension at
`artifacts/biztalk-rules-engine-viewer.vsix`. `npm run package:vsix` packages
without running the tests. `npm run reinstall` rebuilds the VSIX and force
installs it into VS Code using the `code` command-line launcher.

Reload VS Code, open an exported policy XML file, choose **Open With...**, then select **BizTalk Rules Engine Viewer**. XML remains associated with VS Code's text editor unless you explicitly choose the viewer.
