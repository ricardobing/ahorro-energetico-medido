import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/components/AppShell';

const ines = { displayName: 'Inés Huamán', businessName: 'Panadería Santa Inés', role: 'owner' as const };

function renderShell(path = '/ahorro') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell user={ines}>
        <p>contenido</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('estructura de la navegación', () => {
  it('tiene un solo nav y cada identificador de prueba una sola vez', () => {
    renderShell();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    for (const id of ['nav-primer-paso', 'nav-plan', 'nav-factura', 'nav-ahorro', 'nav-mas']) {
      expect(screen.getAllByTestId(id)).toHaveLength(1);
    }
  });

  it('marca el destino activo con aria-current', () => {
    renderShell('/ahorro');
    expect(screen.getByTestId('nav-ahorro')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-plan')).not.toHaveAttribute('aria-current');
  });

  it('muestra el rótulo de prototipo y el enlace para saltar al contenido', () => {
    renderShell();
    expect(screen.getByText('Prototipo para el reto técnico de Agora')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute('href', '#contenido');
  });
});
