export interface Scenario {
  index: number;
  requirement: string;
  name: string;
}

export interface TestTitle {
  file: string;
  line: number;
  title: string;
}

/** Requisitos y escenarios de un `spec.md` de OpenSpec, en orden. */
export function parseScenarios(spec: string): Scenario[] {
  const scenarios: Scenario[] = [];
  let requirement = '';
  for (const line of spec.split(/\r?\n/)) {
    const req = /^### Requirement: (.+?)\s*$/.exec(line);
    if (req) {
      requirement = req[1]!;
      continue;
    }
    const sc = /^#### Scenario: (.+?)\s*$/.exec(line);
    if (sc) scenarios.push({ index: scenarios.length + 1, requirement, name: sc[1]! });
  }
  return scenarios;
}

/** Títulos de `it(...)` y `test(...)` de un archivo de pruebas, con su línea. */
export function parseTestTitles(file: string, source: string): TestTitle[] {
  const titles: TestTitle[] = [];
  const re = /\b(?:it|test)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const m of source.matchAll(re)) {
    const line = source.slice(0, m.index).split('\n').length;
    titles.push({ file, line, title: m[2]!.replace(/\\(['"`])/g, '$1') });
  }
  return titles;
}

export interface TraceRow extends Scenario {
  tests: TestTitle[];
}

/** Cruza escenarios con tests por título exacto. */
export function trace(scenarios: Scenario[], titles: TestTitle[]): { rows: TraceRow[]; missing: Scenario[] } {
  const rows = scenarios.map((s) => ({ ...s, tests: titles.filter((t) => t.title === s.name) }));
  return { rows, missing: rows.filter((r) => r.tests.length === 0) };
}

/** Tabla de trazabilidad en Markdown. */
export function toMarkdown(rows: TraceRow[], specPath: string): string {
  const covered = rows.filter((r) => r.tests.length > 0).length;
  const lines = [
    '# Trazabilidad escenario → test',
    '',
    `Generado por \`npm run trace\` a partir de \`${specPath}\`. Cada escenario de la especificación tiene al menos un test cuyo título es el nombre exacto del escenario.`,
    '',
    `**Cobertura:** ${covered} de ${rows.length} escenarios con test.`,
    '',
    '| # | Requisito | Escenario | Tests |',
    '|---|---|---|---|',
  ];
  for (const r of rows) {
    const tests = r.tests.length
      ? r.tests.map((t) => `\`${t.file}:${t.line}\``).join('<br>')
      : '**sin test**';
    lines.push(`| ${r.index} | ${r.requirement} | ${r.name} | ${tests} |`);
  }
  return `${lines.join('\n')}\n`;
}
