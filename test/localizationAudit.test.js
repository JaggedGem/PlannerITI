const { it, expect } = require('@jest/globals');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.dirname(require.resolve('../package.json'));
const copyAttributes = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'placeholder',
  'searchPlaceholder',
  'emptyMessage',
  'emptyResultsMessage',
  'loadingText',
  'title',
  'label',
]);
const standardTimeMarkers = new Set(['AM', 'PM']);

function findHardcodedCopy(file) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const failures = [];
  function report(node, text) {
    if (!/\p{L}/u.test(text) || standardTimeMarkers.has(text.trim())) return;
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    failures.push(`${path.relative(root, file)}:${line}: ${text.trim()}`);
  }
  // Only inspect values that can be displayed. String keys passed into translation functions,
  // condition checks, style values, routes, and user/server content are not literal UI copy.
  function inspectValue(node) {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      report(node, node.text);
    else if (ts.isTemplateExpression(node)) {
      report(node.head, node.head.text);
      node.templateSpans.forEach((span) => report(span.literal, span.literal.text));
    } else if (ts.isConditionalExpression(node)) {
      inspectValue(node.whenTrue);
      inspectValue(node.whenFalse);
    } else if (ts.isParenthesizedExpression(node)) inspectValue(node.expression);
    else if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) inspectValue(node.left);
      if (
        [
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind)
      )
        inspectValue(node.right);
    }
  }
  function visit(node) {
    if (ts.isJsxText(node)) report(node, node.text);
    if (ts.isJsxAttribute(node) && copyAttributes.has(node.name.getText(source))) {
      if (node.initializer && ts.isJsxExpression(node.initializer))
        inspectValue(node.initializer.expression);
      else inspectValue(node.initializer);
    }
    if (
      ts.isJsxExpression(node) &&
      ts.isJsxElement(node.parent) &&
      ['Text', 'ThemedText'].includes(node.parent.openingElement.tagName.getText(source))
    ) {
      inspectValue(node.expression);
    }
    if (
      ts.isCallExpression(node) &&
      ['Alert.alert', 'showCustomAlert', 'setError', 'setPasswordError'].includes(
        node.expression.getText(source),
      )
    ) {
      inspectValue(node.arguments[0]);
      if (node.expression.getText(source) !== 'setError') inspectValue(node.arguments[1]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return failures;
}

function scanDirectory(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? scanDirectory(file)
      : /\.tsx$/.test(file)
        ? findHardcodedCopy(file)
        : [];
  });
}

it('keeps visible JSX text, input labels, alert copy, and literal fallbacks in translations', () => {
  expect(
    ['app', 'components'].flatMap((directory) => scanDirectory(path.join(root, directory))),
  ).toEqual([]);
});
