import { del, get, set } from 'idb-keyval';

/** Borrador de una factura guardado en el teléfono (IndexedDB) cuando se corta la conexión. */
export interface BillDraft {
  serviceType: 'electricity';
  kwhConsumed: string;
  costPerKwh: string;
  billingStartDate: string;
  billingEndDate: string;
  photo: Blob | null;
  photoQuality: 'ok' | 'retake' | null;
  savedAt: string;
}

const KEY = 'kamai.borrador-factura';

export async function saveDraft(draft: BillDraft): Promise<void> {
  await set(KEY, draft);
}

export async function loadDraft(): Promise<BillDraft | null> {
  return ((await get(KEY)) as BillDraft | undefined) ?? null;
}

export async function clearDraft(): Promise<void> {
  await del(KEY);
}
