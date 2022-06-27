const vscode = require("vscode");
const path = require("path");

const { TextEdit, Range, commands, workspace, window } = vscode;
const { extname } = path;

const supportedFileExtensions = {
  js: 1,
  ts: 1,
  tsx: 1,
  jsx: 1,
};
let saveRegistration;

function activate(context) {
  const disposable = commands.registerCommand(
    "sortlengthyimports.sortlengthy",
    sortImports
  );

  context.subscriptions.push(disposable);
  updateSaveRegistration();
  workspace.onDidChangeConfiguration(updateSaveRegistration);
}

function deactivate() {}

function getMaxRange() {
  return new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
}

function sortImports() {
  const { activeTextEditor } = window;
  const { document } = activeTextEditor || {};
  const sortedText = sort(document);

  if (sortedText) {
    return activeTextEditor.edit((edit) => {
      edit.replace(getMaxRange(), sortedText);
    });
  }

  return;
}

function sort(document) {
  const extension = extname(document.fileName).substring(1);

  if (supportedFileExtensions[extension]) {
    const rawText = document.getText();
    const isWindows = rawText.includes("\r\n");
    const newLineChar = isWindows ? "\r\n" : "\n";
    const text = rawText.split(newLineChar);

    const isImportStatement = (string) =>
      string.startsWith("import") &&
      (string.endsWith('"') || string.endsWith(";"));

    const imports = text.filter(isImportStatement);
    const code = text.filter((line) => !isImportStatement(line));
    const importsByContext = {
      external: [],
      internal: [],
    };

    imports.forEach((string) => {
      if (string) {
        if (string.includes('from ".') || string.includes('from "/')) {
          importsByContext.internal.push(string);
        } else {
          importsByContext.external.push(string);
        }
      }
    });

    importsByContext.external.sort((a, b) => b.length - a.length);
    importsByContext.internal.sort((a, b) => b.length - a.length);

    const hasExternals = Boolean(importsByContext.external.length);
    const hasInternals = Boolean(importsByContext.internal.length);
    const hasImports = hasExternals || hasInternals;
    const importsSeparator =
      hasInternals && hasExternals ? `${newLineChar}${newLineChar}` : "";
    const externalExports = hasExternals
      ? `${importsByContext.external.join(newLineChar)}`
      : "";
    const internalExports = hasInternals
      ? `${importsByContext.internal.join(newLineChar)}`
      : "";
    const afterImportsSeparator = hasImports ? newLineChar : "";
    const restOfDocument = code.join(newLineChar);

    return `${externalExports}${importsSeparator}${internalExports}${afterImportsSeparator}${restOfDocument}`;
  } else {
    return document.getText();
  }
}

function sortImportsOnSave({ document, waitUntil }) {
  const edits = Promise.resolve([new TextEdit(getMaxRange(), sort(document))]);

  waitUntil(edits);
}

function unregisterWillSaveTextDocument() {
  if (!saveRegistration) {
    return;
  }

  saveRegistration.dispose();
  saveRegistration = null;
}

function registerWillSaveTextDocument() {
  if (saveRegistration) {
    return;
  }

  saveRegistration = workspace.onWillSaveTextDocument(sortImportsOnSave);
}

function getOnSaveSetting() {
  return workspace.getConfiguration("sortlengthyimports").get("onSave");
}

function getLanguagesSetting() {
  return workspace.getConfiguration("sortlengthyimports").get("languages");
}

function updateSaveRegistration() {
  if (getOnSaveSetting()) {
    registerWillSaveTextDocument();
  } else {
    unregisterWillSaveTextDocument();
  }
}

module.exports = {
  activate,
  deactivate,
};
