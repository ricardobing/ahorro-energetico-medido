import type { ReactNode } from 'react';

export interface ShellUser {
  displayName: string;
  businessName: string | null;
  role: 'owner' | 'partner' | 'staff';
}

/**
 * Navegación con los colores de Kamai: barra lateral de 248 px con
 * grupos en pantallas de más de 900 px y pestañas fijas abajo en celular. Un solo `<nav>`.
 * Etapa 2: la interfaz existe; el componente se construye en la etapa 3.
 */
export function AppShell(props: { user: ShellUser; children: ReactNode }): ReactNode {
  void props;
  throw new Error('No implementado todavía: AppShell');
}
