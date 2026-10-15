import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { IconAlert, IconClose, IconInfo } from './Icons';

/** Espacios duros de `Intl` → espacios comunes (para nombres accesibles y textos de una línea). */
const HARD_SPACES = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g');
export const plainSpaces = (text: string): string => text.replace(HARD_SPACES, ' ');

type IconType = (p: { className?: string }) => ReactNode;

/** Título de pantalla con su baldosa de ícono, como las secciones de la app de Kamai. */
export function PageHead(props: { title: string; sub?: ReactNode; icon?: IconType }) {
  return (
    <header className="page-head">
      {props.icon ? (
        <span className="tile lg sage" aria-hidden="true">
          <props.icon />
        </span>
      ) : null}
      <div className="page-head-text">
        <h1 className="page-title">{props.title}</h1>
        {props.sub ? <p className="page-sub">{props.sub}</p> : null}
      </div>
    </header>
  );
}

/** Título de una tarjeta con su baldosa de ícono. */
export function SectionTitle(props: { id?: string; icon: IconType; children: ReactNode }) {
  return (
    <div className="section-head">
      <span className="tile" aria-hidden="true">
        <props.icon />
      </span>
      <h2 id={props.id}>{props.children}</h2>
    </div>
  );
}

export type QuestionTone = 'sage' | 'picked' | 'dark' | 'peach' | 'outline';

/** La baldosa del ícono contrasta con el fondo de la tarjeta. */
const TILE_FOR: Record<QuestionTone | 'plain', string> = {
  plain: 'tile',
  sage: 'tile dark',
  picked: 'tile dark',
  dark: 'tile ring',
  peach: 'tile white',
  outline: 'tile sage',
};

/**
 * Una pregunta de «Tus tres preguntas», en el orden en que ella se la hace, con su ícono. El tono marca lo
 * principal: verde suave para la respuesta clave, oscuro para el dato en soles y durazno para la tarifa.
 */
export function Question(props: {
  n: number;
  icon: IconType;
  question: string;
  answer: ReactNode;
  children?: ReactNode;
  tone?: QuestionTone;
  answerSize?: 'md';
}) {
  const tone = props.tone === 'picked' ? 'sage picked' : (props.tone ?? '');
  return (
    <section className={['card', tone].join(' ')} aria-labelledby={`pregunta-${props.n}`}>
      <div className="ask">
        <span className={TILE_FOR[props.tone ?? 'plain']} aria-hidden="true">
          <props.icon />
        </span>
        <h2 className="ask-q" id={`pregunta-${props.n}`}>
          {props.question}
        </h2>
      </div>
      <div className={props.answerSize === 'md' ? 'answer md' : 'answer'}>{props.answer}</div>
      {props.children}
    </section>
  );
}

export function Banner(props: {
  tone?: 'info' | 'error';
  children: ReactNode;
  onClose?: () => void;
  role?: 'status' | 'alert';
}) {
  const Icon = props.tone === 'error' ? IconAlert : IconInfo;
  return (
    <div
      className={props.tone === 'error' ? 'banner error' : 'banner'}
      role={props.role ?? (props.tone === 'error' ? 'alert' : 'status')}
    >
      <Icon className="banner-icon" />
      <div className="banner-body">{props.children}</div>
      {props.onClose ? (
        <button type="button" className="banner-close" onClick={props.onClose} aria-label="Cerrar aviso">
          <IconClose width={20} height={20} />
        </button>
      ) : null}
    </div>
  );
}

/** Esqueletos con la forma de las tarjetas que vienen (estáticos: nada se mueve). */
export function SkeletonCards(props: { count?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{props.label ?? 'Cargando…'}</span>
      {Array.from({ length: props.count ?? 3 }, (_, i) => (
        <div className="card" key={i} aria-hidden="true">
          <div className="skeleton" style={{ width: '45%', height: 14 }} />
          <div className="skeleton" style={{ width: '80%', height: 24, marginTop: 10 }} />
          <div className="skeleton" style={{ width: '60%', height: 14, marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function Field(
  props: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null },
) {
  const { label, hint, error, ...input } = props;
  const id = useId();
  const hintId = hint ? `${id}-ayuda` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...input}
      />
      {error ? (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Casilla con caja dibujada: el `input` real queda accesible y la zona táctil es la fila entera. */
export function Checkbox(props: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        className="sr-only check-input"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="check-box" aria-hidden="true" />
      <span>{props.label}</span>
    </label>
  );
}

export const LEVEL_TEXT = {
  investment: { BAJA: 'Inversión baja', MEDIA: 'Inversión media', ALTA: 'Inversión alta' },
  time: { BAJA: 'Pocos días', MEDIA: 'Unas horas por semana', ALTA: 'Varias horas por semana' },
  complexity: { BAJA: 'Fácil de hacer', MEDIA: 'Pide organizarse', ALTA: 'Pide un especialista' },
} as const;

/** Rótulo de datos que no son de Inés ni del caso. */
export function SourceTag(props: { source: string | null | undefined }) {
  if (props.source !== 'sintetico') return null;
  return <span className="chip data">Dato sintético de la demostración</span>;
}
