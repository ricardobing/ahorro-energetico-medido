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

export async function saveDraft(draft: BillDraft): Promise<void> {
  throw new Error(`No implementado todavía: saveDraft (${draft.savedAt})`);
}

export async function loadDraft(): Promise<BillDraft | null> {
  throw new Error('No implementado todavía: loadDraft');
}

export async function clearDraft(): Promise<void> {
  throw new Error('No implementado todavía: clearDraft');
}
