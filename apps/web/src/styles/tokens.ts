/**
 * Tokens del sistema visual de Kamai, medidos en kamailatam.com (D17 y «Dirección visual» en design.md).
 * `tokens.css` los declara para Tailwind; un test verifica que los dos archivos coinciden.
 */
export const TOKENS = {
  surfaceDark: '#1f3636',
  primary: '#143938',
  accent: '#d4e63d',
  ink: '#102525',
  fg: '#4b6665',
  muted: '#ececed',
  mutedFg: '#7d8787',
  border: '#d1dbdb',
  page: '#f2f2f2',
  card: '#ffffff',
  peach: '#f5e3c6',
  peachBorder: '#ead3ad',
  mist: '#e8f0ef',
  onDarkSoft: '#cbdcda',
  info: '#3da3b8',
  success: '#44841a',
  warning: '#d87c31',
  destructive: '#e00000',
} as const;

export type TokenName = keyof typeof TOKENS;

/**
 * Pares de texto sobre fondo que la interfaz usa. Todo par nuevo se agrega acá para que el test de
 * contraste lo verifique. El lima (`accent`) nunca es color de texto, y `mutedFg`, `info` y `warning` tampoco.
 */
export const TEXT_PAIRS: { text: TokenName; background: TokenName; usage: string }[] = [
  { text: 'ink', background: 'page', usage: 'texto principal sobre el fondo de página' },
  { text: 'ink', background: 'card', usage: 'texto principal en tarjetas' },
  { text: 'fg', background: 'card', usage: 'texto secundario en tarjetas' },
  { text: 'fg', background: 'page', usage: 'texto secundario sobre el fondo de página' },
  { text: 'ink', background: 'peach', usage: 'tarjeta de la tarifa: texto principal' },
  { text: 'fg', background: 'peach', usage: 'tarjeta de la tarifa: texto secundario (4,9:1)' },
  { text: 'primary', background: 'accent', usage: 'botón principal y dato resaltado en lima' },
  { text: 'card', background: 'primary', usage: 'texto sobre verde petróleo' },
  { text: 'card', background: 'surfaceDark', usage: 'barra superior y barra lateral' },
  { text: 'onDarkSoft', background: 'surfaceDark', usage: 'texto secundario en la barra lateral' },
  { text: 'onDarkSoft', background: 'primary', usage: 'texto secundario en la franja del veredicto' },
  { text: 'primary', background: 'mist', usage: 'ítem activo de la navegación' },
  { text: 'destructive', background: 'card', usage: 'mensajes de error en formularios' },
];
