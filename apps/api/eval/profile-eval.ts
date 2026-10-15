/**
 * Eval del perfil asistido (`npm run eval:profile`). Necesita AI_API_KEY y queda fuera de CI: corre las
 * 40 descripciones sintéticas contra el modelo configurado, mide aciertos por campo, demora y tokens, y
 * guarda el informe en `apps/api/eval/results/`. Sirve para elegir el modelo de producción con datos.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeModelSuggestions, suggestByKeywords, type ProfileSuggestions } from '@ppam/domain';
import { loadAiConfig } from '../src/config.js';
import { OpenAiProfileModel } from '../src/services/profile-model.js';
import { EVAL_CASES, type EvalCase } from './descriptions.js';

const FIELDS = ['ciiu', 'equipment', 'ovenType', 'budgetAmount', 'hoursPerWeek'] as const;
type Field = (typeof FIELDS)[number];

function flatten(s: ProfileSuggestions): Record<Field, unknown> {
  return {
    ciiu: s.ciiu?.code ?? null,
    equipment: [...s.equipment].sort(),
    ovenType: s.ovenType,
    budgetAmount: s.budget?.amount ?? null,
    hoursPerWeek: s.hoursPerWeek,
  };
}

function expectedOf(c: EvalCase): Record<Field, unknown> {
  return { ...c.expected, equipment: [...c.expected.equipment].sort() };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface Row {
  id: string;
  source: 'ai' | 'keywords';
  ms: number;
  hits: Record<Field, boolean>;
  invented: boolean;
  error?: string;
}

async function main() {
  const ai = loadAiConfig(process.env);
  if (!ai) {
    console.error(
      'Falta AI_API_KEY: el eval llama al modelo de verdad y por eso no corre sin clave ni en CI.\n' +
        'Configúrala en .env (ver .env.example) y vuelve a correr `npm run eval:profile`.',
    );
    process.exit(2);
  }
  const model = new OpenAiProfileModel(ai);
  const rows: Row[] = [];
  const keywordRows: Row[] = [];
  for (const c of EVAL_CASES) {
    const expected = expectedOf(c);
    const started = Date.now();
    let suggestions: ProfileSuggestions;
    let error: string | undefined;
    let invented = false;
    try {
      const raw = (await model.suggest(c.description, AbortSignal.timeout(10_000))) as Record<
        string,
        unknown
      >;
      // «Inventado»: el modelo devolvió un monto u horas que no están escritos en el texto (el dominio los descarta).
      invented =
        (raw.budgetAmount !== null && expected.budgetAmount === null) ||
        (raw.hoursPerWeek !== null && expected.hoursPerWeek === null);
      suggestions = sanitizeModelSuggestions(raw, c.description, c.country);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      suggestions = suggestByKeywords(c.description, c.country);
    }
    const got = flatten(suggestions);
    rows.push({
      id: c.id,
      source: error ? 'keywords' : 'ai',
      ms: Date.now() - started,
      hits: Object.fromEntries(FIELDS.map((f) => [f, same(got[f], expected[f])])) as Record<Field, boolean>,
      invented,
      error,
    });
    const kw = flatten(suggestByKeywords(c.description, c.country));
    keywordRows.push({
      id: c.id,
      source: 'keywords',
      ms: 0,
      hits: Object.fromEntries(FIELDS.map((f) => [f, same(kw[f], expected[f])])) as Record<Field, boolean>,
      invented: false,
    });
    process.stdout.write(rows.at(-1)!.error ? 'x' : '.');
  }
  process.stdout.write('\n');

  const pct = (list: Row[], f: Field) =>
    Math.round((list.filter((r) => r.hits[f]).length / list.length) * 100);
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = ms[Math.floor(ms.length / 2)] ?? 0;
  const p95 = ms[Math.floor(ms.length * 0.95)] ?? 0;
  const usage = model.usage;
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Eval del perfil asistido — ${date}`,
    '',
    `Modelo: \`${ai.model}\` · URL base: \`${new URL(ai.baseURL).host}\` · ${EVAL_CASES.length} descripciones sintéticas.`,
    '',
    '| Campo | Modelo (después de la verificación del dominio) | Solo palabras clave |',
    '|---|---|---|',
    ...FIELDS.map((f) => `| ${f} | ${pct(rows, f)} % | ${pct(keywordRows, f)} % |`),
    '',
    `- Respuestas que cayeron a palabras clave por error o demora: ${rows.filter((r) => r.error).length}`,
    `- Montos u horas que el modelo inventó (y el dominio descartó): ${rows.filter((r) => r.invented).length}`,
    `- Demora: mediana ${p50} ms, p95 ${p95} ms`,
    `- Tokens: ${usage.promptTokens} de entrada y ${usage.completionTokens} de salida en total (${Math.round(
      (usage.promptTokens + usage.completionTokens) / EVAL_CASES.length,
    )} por descripción)`,
    '',
    '## Fallos por caso',
    '',
    ...rows
      .filter((r) => r.error || FIELDS.some((f) => !r.hits[f]))
      .map(
        (r) =>
          `- \`${r.id}\`: ${r.error ? `error (${r.error})` : FIELDS.filter((f) => !r.hits[f]).join(', ')}`,
      ),
  ];
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${date}-${ai.model.replace(/[^\w.-]+/g, '_')}.md`);
  await writeFile(file, `${lines.join('\n')}\n`);
  console.log(lines.slice(0, 15).join('\n'));
  console.log(`\nInforme guardado en ${path.relative(process.cwd(), file)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
