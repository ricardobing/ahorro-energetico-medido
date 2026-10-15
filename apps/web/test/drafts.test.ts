import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (key: string) => store.get(key),
  set: async (key: string, value: unknown) => {
    store.set(key, value);
  },
  del: async (key: string) => {
    store.delete(key);
  },
}));

const { clearDraft, loadDraft, saveDraft } = await import('../src/lib/drafts');

beforeEach(() => store.clear());

describe('borradores sin conexión', () => {
  it('guarda, recupera y borra el borrador de una factura con su foto', async () => {
    const photo = new Blob(['foto'], { type: 'image/jpeg' });
    const draft = {
      serviceType: 'electricity' as const,
      kwhConsumed: '1770',
      costPerKwh: '0.84',
      billingStartDate: '2026-08-01',
      billingEndDate: '2026-08-31',
      photo,
      photoQuality: 'ok' as const,
      savedAt: '2026-09-02T10:00:00Z',
    };
    await saveDraft(draft);
    expect(await loadDraft()).toEqual(draft);
    await clearDraft();
    expect(await loadDraft()).toBeNull();
  });
});
