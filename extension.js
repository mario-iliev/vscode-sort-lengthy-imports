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
  const rawText = document.getText();

  if (supportedFileExtensions[extension]) {
    const isWindows = rawText.includes("\r\n");
    const newLineChar = isWindows ? "\r\n" : "\n";
    const text = rawText.split(newLineChar);
    let startedScrapingImportText = false;
    let startedScrapingCommentText = false;
    let comment = [];
    let imports = [];
    let tempImport = [];

    const checkIfLineShouldStay = (line, index) => {
      const isImportLine =
        line.startsWith("import") || line.startsWith("// import");
      const isLineEnd = line.endsWith('";') || line.endsWith("';");
      const isCommentStart = line.startsWith("/*");
      const isCommentEnd = line.endsWith("*/");
      let lineShouldStay = false;

      if (startedScrapingImportText || startedScrapingCommentText) {
        lineShouldStay = true;
      }

      if (!startedScrapingImportText && isImportLine) {
        startedScrapingImportText = true;
        lineShouldStay = true;
      }

      if (startedScrapingImportText && isLineEnd) {
        startedScrapingImportText = false;
      }

      if (index === 0 && isCommentStart) {
        startedScrapingCommentText = true;
        lineShouldStay = true;
      }

      if (startedScrapingCommentText && isCommentEnd) {
        startedScrapingCommentText = false;
        lineShouldStay = true;
      }

      return lineShouldStay;
    };

    const importsLines = text.filter((line, index) =>
      checkIfLineShouldStay(line, index, true)
    );

    startedScrapingImportText = false;
    startedScrapingCommentText = false;

    const code = text.filter(
      (line, index) => !checkIfLineShouldStay(line, index)
    );

    const importsByContext = {
      external: [],
      internal: [],
    };

    importsLines.forEach((line, index) => {
      const isImportLine =
        line.startsWith("import") || line.startsWith("// import");
      const isLineEnd = line.endsWith('";') || line.endsWith("';");
      const isCommentStart = line.startsWith("/*");
      const isCommentEnd = line.endsWith("*/");

      if (index === 0 && isCommentStart && isCommentEnd) {
        comment.push(line);
      } else if (isImportLine && isLineEnd) {
        imports.push(line);
      } else {
        if (!isImportLine && !isLineEnd) {
          tempImport.push(line);
        }

        if (isLineEnd) {
          tempImport = tempImport.sort((a, b) => b.length - a.length);
          tempImport = `import {${newLineChar}${tempImport.join(
            newLineChar
          )}${newLineChar}${line}`;
          tempImport && imports.push(tempImport);
          tempImport = [];
        }
      }
    });

    imports.forEach((string) => {
      if (string) {
        if (
          string.includes('from ".') ||
          string.includes('from "/') ||
          string.includes("from '.") ||
          string.includes("from '/")
        ) {
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
    const hasComments = Boolean(comment.length);
    const importsSeparator =
      hasInternals && hasExternals ? `${newLineChar}${newLineChar}` : "";
    const importAndCodeSeparator =
      hasInternals || hasExternals ? `${newLineChar}${newLineChar}` : "";
    const externalExports = hasExternals
      ? `${importsByContext.external.join(newLineChar)}`
      : "";
    const internalExports = hasInternals
      ? `${importsByContext.internal.join(newLineChar)}`
      : "";
    const comments = hasComments ? `${comment.join(newLineChar)}` : "";
    const commentSeparator =
      hasComments && (hasInternals || hasExternals) ? newLineChar : "";
    let restOfDocument;

    // Remove empty lines before the code start
    for (let i = 0; i < code.length; i++) {
      if (code[i]) {
        restOfDocument = code.slice(i).join(newLineChar);

        break;
      }
    }

    return `${comments}${commentSeparator}${externalExports}${importsSeparator}${internalExports}${importAndCodeSeparator}${restOfDocument}`;
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
