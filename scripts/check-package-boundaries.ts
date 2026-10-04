import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

type Manifest = {
  name: string;
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const allowed: Record<string, string[]> = {
  constants: [],
  'game-domain': ['constants', 'combat-core'],
  'combat-core': [],
  'game-content': ['constants', 'game-domain', 'combat-core'],
  'game-rules': ['constants', 'game-domain', 'combat-core', 'game-content'],
  contracts: ['constants', 'game-domain', 'combat-core'],
};
const root = process.cwd();
const workspaces = ['apps', 'packages'].flatMap((folder) =>
  readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(folder, entry.name))
    .filter((directory) => existsSync(path.join(directory, 'package.json')))
    .map((directory) => ({
      directory,
      manifest: JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')) as Manifest,
    })),
);
const byName = new Map(workspaces.map((workspace) => [workspace.manifest.name, workspace]));
const errors: string[] = [];
let imports = 0;

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
  });
}

for (const { directory, manifest } of workspaces) {
  const library = directory.startsWith('packages/');
  const permitted = allowed[path.basename(directory)];
  if (library && !permitted) errors.push(`${directory}: library has no dependency policy`);
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  for (const name of Object.keys(dependencies).filter((name) => name.startsWith('@daoyou/'))) {
    if (!byName.has(name)) errors.push(`${directory}: unknown workspace dependency ${name}`);
    if (library && !permitted?.includes(name.slice('@daoyou/'.length))) {
      errors.push(`${directory}: forbidden dependency ${name}`);
    }
    if (!library && name.match(/^@daoyou\/(api|web)$/)) {
      errors.push(`${directory}: applications cannot depend on each other`);
    }
  }
  for (const [entry, target] of Object.entries(manifest.exports ?? {})) {
    if (entry.includes('*')) errors.push(`${directory}: wildcard export ${entry}`);
    const source = path.join(directory, target.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts'));
    if (!existsSync(source)) errors.push(`${directory}: export ${entry} has no source: ${source}`);
  }
  for (const file of sourceFiles(path.join(directory, 'src'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function check(specifier: string, typeOnly = false) {
      imports++;
      if (specifier.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), specifier);
        if (!resolved.startsWith(path.resolve(directory, 'src') + path.sep)) {
          errors.push(`${file}: relative import leaves workspace source: ${specifier}`);
        }
        return;
      }
      if (library && (specifier.startsWith('@app/') || specifier.startsWith('@server/'))) {
        errors.push(`${file}: library imports host alias ${specifier}`);
      }
      if (!specifier.startsWith('@daoyou/')) return;
      const [scope, packageName, ...subpath] = specifier.split('/');
      const name = `${scope}/${packageName}`;
      if (manifest.name === '@daoyou/game-domain' && name === '@daoyou/combat-core' && !typeOnly) {
        errors.push(`${file}: domain models may only import combat-core types`);
      }
      if (library && name === manifest.name) {
        errors.push(`${file}: use relative source imports inside a library, not its own dist exports`);
      }
      const target = byName.get(name);
      if (!target) {
        errors.push(`${file}: unknown workspace import ${specifier}`);
        return;
      }
      if (name !== manifest.name && !dependencies[name]) {
        errors.push(`${file}: undeclared dependency ${name}`);
      }
      const entry = subpath.length ? `./${subpath.join('/')}` : '.';
      if (!target.manifest.exports?.[entry]) errors.push(`${file}: private or missing export ${specifier}`);
      if (!/\.(test|spec)\.[jt]sx?$/.test(file) && name !== manifest.name && !manifest.dependencies?.[name]) {
        errors.push(`${file}: production import requires a runtime dependency: ${name}`);
      }
    }
    function visit(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const typeOnly = ts.isImportDeclaration(node)
          ? Boolean(node.importClause?.isTypeOnly || (node.importClause && !node.importClause.name && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every((element) => element.isTypeOnly)))
          : Boolean(node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every((element) => element.isTypeOnly)));
        check(node.moduleSpecifier.text, typeOnly);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        check(node.argument.literal.text, true);
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) check(argument.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}

const visited = new Set<string>();
function visitDependencies(name: string, ancestors: string[]) {
  if (ancestors.includes(name)) {
    errors.push(`Workspace dependency cycle: ${[...ancestors, name].join(' -> ')}`);
    return;
  }
  if (visited.has(name)) return;
  const manifest = byName.get(name)!.manifest;
  for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (byName.has(dependency)) visitDependencies(dependency, [...ancestors, name]);
  }
  visited.add(name);
}
for (const name of byName.keys()) visitDependencies(name, []);

if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exitCode = 1;
} else {
  console.info(`Package boundaries passed: ${workspaces.length} workspaces, ${imports} imports (including types and tests), ${path.basename(root)}.`);
}
