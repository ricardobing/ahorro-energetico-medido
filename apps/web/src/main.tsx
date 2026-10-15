import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/mona-sans';
import '@fontsource-variable/manrope';
import './styles/app.css';
import { App } from './App';
import { ApiError, currentDemoUser } from './lib/api';

// «Ver como» por la URL (?verComo=aliado): se guarda y se limpia de la barra de direcciones.
currentDemoUser();
if (new URLSearchParams(window.location.search).has('verComo')) {
  const url = new URL(window.location.href);
  url.searchParams.delete('verComo');
  window.history.replaceState(null, '', url);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Los errores con mensaje del servidor no se reintentan: se muestran.
      retry: (count, error) => !(error instanceof ApiError) && count < 2,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
