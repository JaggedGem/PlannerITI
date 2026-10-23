const { it, expect } = require('@jest/globals');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const DEPENDENCY_ARGUMENT = {
  useAnimatedStyle: 1,
  useAnimatedProps: 1,
  useDerivedValue: 1,
  useAnimatedReaction: 2,
  useAnimatedScrollHandler: 1,
  useHandler: 1,
};

function findNativeDependencyArrays(directory) {
  const failures = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      failures.push(...findNativeDependencyArrays(file));
      continue;
    }
    if (!/\.[jt]sx?$/.test(file) || file.endsWith('.d.ts')) continue;
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const index = DEPENDENCY_ARGUMENT[node.expression.getText(source)];
        const dependencies = index === undefined ? undefined : node.arguments[index];
        if (
          dependencies &&
          dependencies.getText(source) !== 'undefined' &&
          !(
            ts.isCallExpression(dependencies) &&
            dependencies.expression.getText(source) === 'getAnimationDependencies'
          )
        ) {
          failures.push(
            `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
          );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return failures;
}

it('applies the bottom-sheet compatibility patch to the entry Metro uses on native', () => {
  const root = path.dirname(require.resolve('@gorhom/bottom-sheet/package.json'));
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  expect(metadata['react-native']).toBe('src/index.ts');
  expect(fs.existsSync(path.join(root, 'src/utilities/getAnimationDependencies.ts'))).toBe(true);
  expect(findNativeDependencyArrays(path.join(root, 'src'))).toEqual([]);
});

it('keeps app animation dependencies restricted to web as well', () => {
  const root = path.dirname(require.resolve('../package.json'));
  expect(findNativeDependencyArrays(path.join(root, 'components'))).toEqual([]);
  expect(findNativeDependencyArrays(path.join(root, 'app'))).toEqual([]);
});
