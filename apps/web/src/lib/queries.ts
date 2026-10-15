import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Bill, FirstStep, Me, Notification, Plan, Profile, Savings } from './types';

export const keys = {
  me: ['me'] as const,
  firstStep: ['first-step'] as const,
  plans: ['plans'] as const,
  savings: ['savings'] as const,
  bills: ['bills'] as const,
  notifications: ['notifications'] as const,
  profile: ['profile'] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/me') });
export const useFirstStep = () =>
  useQuery({ queryKey: keys.firstStep, queryFn: () => api<FirstStep>('/first-step') });
export const usePlans = (enabled = true) =>
  useQuery({
    queryKey: keys.plans,
    enabled,
    queryFn: () => api<{ items: Plan[] }>('/user-eco-card').then((r) => r.items),
  });
export const useSavings = () => useQuery({ queryKey: keys.savings, queryFn: () => api<Savings>('/savings') });
export const useBills = () =>
  useQuery({
    queryKey: keys.bills,
    queryFn: () => api<{ items: Bill[] }>('/user-bill').then((r) => r.items),
  });
export const useNotifications = (enabled = true) =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<{ items: Notification[]; unread: number }>('/notifications'),
    enabled,
  });
export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => api<Profile>('/profile') });

/** Después de cambiar facturas, planes o perfil, lo que depende de eso se vuelve a pedir. */
export function refreshBusinessData(client: QueryClient): Promise<unknown> {
  return Promise.all(
    [keys.firstStep, keys.plans, keys.savings, keys.bills, keys.notifications, keys.profile].map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}
