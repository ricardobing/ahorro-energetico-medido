/**
 * `npm run trace`: verifica que cada escenario de la spec tenga un test con su nombre exacto y escribe
 * `docs/trazabilidad.md`. Sale con error si falta alguno.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseScenarios, parseTestTitles, toMarkdown, trace } from './trace-lib.js';

const root = join(import.meta.dirname, '..');
const specPath = 'openspec/changes/primer-paso-ahorro-medido/specs/primer-paso-ahorro-medido/spec.md';
const testDirs = ['packages', 'apps', 'e2e/tests'];
const isTest = (f: string) => /\.(test|spec)\.tsx?$/.test(f) && !f.includes('node_modules');

const scenarios = parseScenarios(readFileSync(join(root, specPath), 'utf8'));
const titles = testDirs.flatMap((dir) =>
  readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter(isTest)
    .flatMap((f) => {
      const abs = join(root, dir, f);
      return parseTestTitles(relative(root, abs).replaceAll('\\', '/'), readFileSync(abs, 'utf8'));
    }),
);

const { rows, missing } = trace(scenarios, titles);
mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'trazabilidad.md'), toMarkdown(rows, specPath));

console.log(
  `Escenarios: ${scenarios.length} · con test: ${scenarios.length - missing.length} · sin test: ${missing.length}`,
);
if (missing.length) {
  for (const m of missing) console.log(`  sin test: #${m.index} ${m.requirement} › ${m.name}`);
  process.exit(1);
}
console.log('Tabla escrita en docs/trazabilidad.md');
