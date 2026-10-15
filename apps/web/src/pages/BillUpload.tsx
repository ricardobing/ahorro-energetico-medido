import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconBill, IconCamera, IconNumbers } from '../components/Icons';
import { Banner, Field, PageHead, SectionTitle } from '../components/ui';
import { api, ApiError, errorMessage, OfflineError, uploadPhoto } from '../lib/api';
import { clearDraft, loadDraft, saveDraft, type BillDraft } from '../lib/drafts';
import { preparePhoto, type PreparedPhoto } from '../lib/photo';
import { PHOTO_TIP } from '../lib/photo-quality';
import { refreshBusinessData, useMe } from '../lib/queries';
import type { Bill } from '../lib/types';

type PhotoState =
  | { step: 'none' }
  | { step: 'checking' }
  | { step: 'review'; photo: PreparedPhoto }
  | { step: 'uploading'; photo: PreparedPhoto; quality: 'ok' | 'retake' }
  | { step: 'ready'; photo: PreparedPhoto | null; fileId: string; quality: 'ok' | 'retake' }
  | { step: 'error'; message: string };

interface Values {
  kwhConsumed: string;
  costPerKwh: string;
  billingStartDate: string;
  billingEndDate: string;
}

const EMPTY: Values = { kwhConsumed: '', costPerKwh: '', billingStartDate: '', billingEndDate: '' };
const OFFLINE = 'No hay conexión. Guardamos tu factura en el teléfono y la enviamos cuando vuelva.';

/** «1.790» o «1790,5» → número; vacío → NaN (el servidor dice qué corregir). */
const toNumber = (v: string) => Number(v.trim().replace(/\s/g, '').replace(',', '.'));

export function BillUploadPage(): ReactNode {
  const me = useMe();
  const client = useQueryClient();
  const fileId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [photo, setPhoto] = useState<PhotoState>({ step: 'none' });
  const [pendingPhoto, setPendingPhoto] = useState<{ blob: Blob; quality: 'ok' | 'retake' } | null>(null);
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'saved'; bill: Bill }
    | { kind: 'offline' }
    | { kind: 'error'; message: string; field?: string }
    | { kind: 'confirm'; message: string }
  >({ kind: 'idle' });
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const currencySymbol = me.data?.business?.country === 'BO' ? 'Bs' : 'S/';

  // Si quedó una factura guardada en el teléfono, vuelve al formulario.
  useEffect(() => {
    let alive = true;
    loadDraft()
      .then((draft) => {
        if (!alive || !draft) return;
        setValues({
          kwhConsumed: draft.kwhConsumed,
          costPerKwh: draft.costPerKwh,
          billingStartDate: draft.billingStartDate,
          billingEndDate: draft.billingEndDate,
        });
        if (draft.photo && draft.photoQuality)
          setPendingPhoto({ blob: draft.photo, quality: draft.photoQuality });
        setDraftLoaded(true);
      })
      .catch(() => undefined);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      alive = false;
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const set = (key: keyof Values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (status.kind === 'error' || status.kind === 'confirm') setStatus({ kind: 'idle' });
  };

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto({ step: 'checking' });
    try {
      setPhoto({ step: 'review', photo: await preparePhoto(file) });
    } catch (error) {
      setPhoto({
        step: 'error',
        message: error instanceof Error ? error.message : 'No pudimos leer la foto.',
      });
    }
  }

  async function acceptPhoto(quality: 'ok' | 'retake') {
    if (photo.step !== 'review') return;
    const prepared = photo.photo;
    setPhoto({ step: 'uploading', photo: prepared, quality });
    try {
      const { fileId: id } = await uploadPhoto(prepared.blob);
      setPhoto({ step: 'ready', photo: prepared, fileId: id, quality });
    } catch (error) {
      if (error instanceof OfflineError) {
        // Sin conexión la foto viaja con el borrador y se sube al reenviar.
        setPendingPhoto({ blob: prepared.blob, quality });
        setPhoto({ step: 'none' });
        return;
      }
      setPhoto({ step: 'error', message: errorMessage(error) });
    }
  }

  async function keepDraft() {
    const draft: BillDraft = {
      serviceType: 'electricity',
      ...values,
      photo: photo.step === 'ready' ? (photo.photo?.blob ?? null) : (pendingPhoto?.blob ?? null),
      photoQuality: photo.step === 'ready' ? photo.quality : (pendingPhoto?.quality ?? null),
      savedAt: new Date().toISOString(),
    };
    await saveDraft(draft).catch(() => undefined);
    setStatus({ kind: 'offline' });
  }

  async function send(confirmAtypical = false) {
    setStatus({ kind: 'sending' });
    try {
      let uploaded: string[] = [];
      let quality: 'ok' | 'retake' | undefined;
      if (photo.step === 'ready') {
        uploaded = [photo.fileId];
        quality = photo.quality;
      } else if (pendingPhoto) {
        uploaded = [(await uploadPhoto(pendingPhoto.blob)).fileId];
        quality = pendingPhoto.quality;
      }
      const bill = await api<Bill>('/user-bill', {
        method: 'POST',
        json: {
          serviceType: 'electricity',
          kwhConsumed: toNumber(values.kwhConsumed),
          costPerKwh: toNumber(values.costPerKwh),
          billingStartDate: values.billingStartDate,
          billingEndDate: values.billingEndDate,
          uploadedFiles: uploaded,
          ...(quality ? { photoQuality: quality } : {}),
          ...(confirmAtypical ? { confirmAtypical: true } : {}),
        },
      });
      await clearDraft().catch(() => undefined);
      setDraftLoaded(false);
      setPendingPhoto(null);
      setValues(EMPTY);
      setPhoto({ step: 'none' });
      setStatus({ kind: 'saved', bill });
      await refreshBusinessData(client);
    } catch (error) {
      if (error instanceof OfflineError) return keepDraft();
      if (error instanceof ApiError && error.code === 'BILL_NEEDS_CONFIRMATION')
        return setStatus({ kind: 'confirm', message: error.message });
      const field =
        error instanceof ApiError
          ? ((error.details?.errors as { field?: string }[] | undefined)?.[0]?.field ?? undefined)
          : undefined;
      setStatus({ kind: 'error', message: errorMessage(error), field });
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  const errorFor = (field: keyof Values) =>
    status.kind === 'error' && status.field === field ? status.message : null;

  return (
    <>
      <PageHead
        icon={IconBill}
        title="Subir factura"
        sub="Tu factura de luz: los números del recibo y, si puedes, una foto."
      />

      {draftLoaded && status.kind !== 'offline' ? (
        <Banner>
          <p>
            Tienes una factura guardada en el teléfono, sin enviar. Revisa los datos y envíala cuando tengas
            conexión.
          </p>
        </Banner>
      ) : null}
      {status.kind === 'offline' ? (
        <Banner>
          <p>{OFFLINE}</p>
          {online ? (
            <div>
              <button type="button" className="btn btn-secondary" onClick={() => void send()}>
                Enviar ahora
              </button>
            </div>
          ) : null}
        </Banner>
      ) : null}
      {status.kind === 'saved' ? (
        <Banner>
          <p>
            {status.bill.evidence === 'photo_retake'
              ? 'Factura guardada. Cuando puedas, súbela de nuevo con una foto más clara.'
              : status.bill.evidence === 'no_photo'
                ? 'Factura guardada. Si tienes la foto, puedes agregarla después.'
                : 'Factura guardada con su foto.'}
          </p>
          <div>
            <Link className="btn btn-quiet" to="/ahorro">
              Ver mi ahorro
            </Link>
          </div>
        </Banner>
      ) : null}

      <section className="card" aria-labelledby="foto">
        <SectionTitle id="foto" icon={IconCamera}>
          La foto
        </SectionTitle>
        <p className="support">
          Se achica en tu teléfono antes de enviarse (menos de 250 KB) para cuidar tus datos.
        </p>
        <input
          ref={fileInput}
          id={fileId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void onPhoto(e)}
        />
        {photo.step === 'none' || photo.step === 'error' ? (
          <div className="actions">
            <label htmlFor={fileId} className="btn btn-secondary">
              <IconCamera /> Foto de la factura
            </label>
          </div>
        ) : null}
        {photo.step === 'error' ? <p className="field-error">{photo.message}</p> : null}
        {photo.step === 'checking' ? (
          <p className="support" role="status">
            Revisando la foto…
          </p>
        ) : null}
        {photo.step === 'review' || photo.step === 'uploading' || photo.step === 'ready' ? (
          <div className="photo-review">
            {photo.photo ? (
              <img src={photo.photo.previewUrl} alt="Vista previa de la factura" className="photo-preview" />
            ) : null}
            {photo.step === 'review' ? (
              photo.photo.quality.ok ? (
                <div className="actions">
                  <button type="button" className="btn btn-primary" onClick={() => void acceptPhoto('ok')}>
                    Usar esta foto
                  </button>
                  <label htmlFor={fileId} className="btn btn-secondary">
                    Tomar otra
                  </label>
                </div>
              ) : (
                <>
                  <p className="support" role="status">
                    {PHOTO_TIP}
                  </p>
                  <div className="actions">
                    <label htmlFor={fileId} className="btn btn-primary">
                      Tomar otra
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void acceptPhoto('retake')}
                    >
                      Guardar igual
                    </button>
                  </div>
                </>
              )
            ) : null}
            {photo.step === 'uploading' ? (
              <p className="support" role="status">
                Subiendo la foto…
              </p>
            ) : null}
            {photo.step === 'ready' ? (
              <p className="support" role="status">
                {photo.quality === 'ok' ? 'Foto lista.' : 'Foto guardada aunque se vea poco clara.'}
              </p>
            ) : null}
          </div>
        ) : null}
        {pendingPhoto && photo.step === 'none' ? (
          <p className="field-hint">La foto se envía junto con la factura.</p>
        ) : null}
      </section>

      <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="numeros">
        <SectionTitle id="numeros" icon={IconNumbers}>
          Los números del recibo
        </SectionTitle>
        <div className="grid-2">
          <Field
            label="Consumo del periodo (kWh)"
            inputMode="decimal"
            autoComplete="off"
            value={values.kwhConsumed}
            onChange={set('kwhConsumed')}
            error={errorFor('kwhConsumed')}
          />
          <Field
            label={`Precio por kWh (${currencySymbol})`}
            inputMode="decimal"
            autoComplete="off"
            value={values.costPerKwh}
            onChange={set('costPerKwh')}
            error={errorFor('costPerKwh')}
          />
          <Field
            label="Inicio del periodo"
            type="date"
            value={values.billingStartDate}
            onChange={set('billingStartDate')}
            error={errorFor('billingStartDate')}
          />
          <Field
            label="Cierre del periodo"
            type="date"
            value={values.billingEndDate}
            onChange={set('billingEndDate')}
            error={errorFor('billingEndDate')}
          />
        </div>

        {status.kind === 'error' && !status.field ? (
          <div style={{ marginTop: 14 }}>
            <Banner tone="error">{status.message}</Banner>
          </div>
        ) : null}
        {status.kind === 'confirm' ? (
          <div style={{ marginTop: 14 }}>
            <Banner tone="error">
              <p>{status.message}</p>
              <div className="actions" style={{ marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => void send(true)}>
                  Sí, está bien
                </button>
              </div>
            </Banner>
          </div>
        ) : null}

        <div className="actions">
          <button type="submit" className="btn btn-primary btn-block" disabled={status.kind === 'sending'}>
            {status.kind === 'sending' ? 'Guardando…' : 'Guardar factura'}
          </button>
        </div>
      </form>
    </>
  );
}
