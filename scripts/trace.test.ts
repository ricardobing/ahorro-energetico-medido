import { describe, expect, it } from 'vitest';
import { parseScenarios, parseTestTitles, toMarkdown, trace } from './trace-lib.js';

const spec = `# Spec
### Requirement: Comparación en kWh por día
El sistema SHALL comparar por día.

#### Scenario: Febrero contra enero
- **WHEN** a
- **THEN** b

### Requirement: Otra
#### Scenario: ¿Por qué esto?
- **WHEN** a
- **THEN** b
`;

describe('trazabilidad', () => {
  it('lee requisitos y escenarios en orden', () => {
    expect(parseScenarios(spec)).toEqual([
      { index: 1, requirement: 'Comparación en kWh por día', name: 'Febrero contra enero' },
      { index: 2, requirement: 'Otra', name: '¿Por qué esto?' },
    ]);
  });

  it('lee títulos de it y test con comillas simples, dobles y escapadas', () => {
    const source = `it('Febrero contra enero', () => {});\n  test("¿Por qué esto?", async () => {});\nit('L\\'Oréal', () => {});`;
    expect(parseTestTitles('a.test.ts', source)).toEqual([
      { file: 'a.test.ts', line: 1, title: 'Febrero contra enero' },
      { file: 'a.test.ts', line: 2, title: '¿Por qué esto?' },
      { file: 'a.test.ts', line: 3, title: "L'Oréal" },
    ]);
  });

  it('marca como faltante el escenario sin test y lo muestra en la tabla', () => {
    const { rows, missing } = trace(parseScenarios(spec), [
      { file: 'a.test.ts', line: 1, title: 'Febrero contra enero' },
    ]);
    expect(missing.map((m) => m.name)).toEqual(['¿Por qué esto?']);
    const md = toMarkdown(rows, 'spec.md');
    expect(md).toContain('**Cobertura:** 1 de 2');
    expect(md).toContain('| 2 | Otra | ¿Por qué esto? | **sin test** |');
  });
});
