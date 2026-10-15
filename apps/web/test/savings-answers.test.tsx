import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SavingsDisplay } from '@ppam/domain';
import { SavingsAnswers } from '../src/components/SavingsAnswers';

const measured: SavingsDisplay = {
  status: 'MEASURED',
  summary:
    'Desde que cambiaste los burletes usas 6 % menos de luz por día. A la tarifa de hoy son unos S/ 90 menos por mes (entre S/ 20 y S/ 160).',
  headline: 'Sí: usas 6 % menos luz por día',
  money: {
    text: 'Unos S/ 90 menos por mes',
    rangeText: 'Entre S/ 20 y S/ 160',
    mostLikelyText: 'Lo más probable: S/ 90',
  },
  methodLine: 'Comparado con tus 3 meses antes del cambio. Todavía no podemos corregir por temporada.',
  tariffNote:
    'Tu tarifa subió 8 % desde enero: por eso tu factura puede subir aunque uses menos luz. Eso no depende de ti.',
  nextStep: null,
};

const notYet: SavingsDisplay = {
  status: 'INSUFFICIENT_DATA',
  summary:
    'Todavía no podemos saberlo. Parece que bajó un poco, pero todavía está dentro de lo que tu consumo varía de un mes a otro. Lo sabremos con tu factura que cierra alrededor del 30 de septiembre.',
  headline: 'Todavía no podemos saberlo',
  money: null,
  methodLine: null,
  tariffNote: measured.tariffNote,
  nextStep: 'Lo sabremos con tu factura que cierra alrededor del 30 de septiembre.',
};

describe('«Tu ahorro»: tus tres preguntas', () => {
  it('con ahorro medido responde las tres preguntas en orden', () => {
    render(<SavingsAnswers display={measured} />);
    const questions = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(questions).toEqual([
      '¿Bajó tu consumo?',
      '¿Cuánto es en soles?',
      '¿Por qué tu factura no baja igual?',
    ]);
    expect(screen.getByText('Sí: usas 6 % menos luz por día')).toBeInTheDocument();
    expect(screen.getByText('Unos S/ 90 menos por mes')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Entre S/ 20 y S/ 160, lo más probable S/ 90' }),
    ).toBeInTheDocument();
    expect(screen.getByText(measured.methodLine!)).toBeInTheDocument();
  });

  it('cuando todavía no se sabe, no muestra soles y dice cuándo se va a saber', () => {
    render(<SavingsAnswers display={notYet} />);
    expect(screen.getByText('Todavía no podemos saberlo')).toBeInTheDocument();
    expect(screen.queryByText(/Unos S\//)).not.toBeInTheDocument();
    expect(screen.getByText(notYet.nextStep!)).toBeInTheDocument();
    expect(screen.getByText(notYet.tariffNote!)).toBeInTheDocument();
  });
});
