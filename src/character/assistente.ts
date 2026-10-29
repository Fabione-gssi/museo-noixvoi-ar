// Richiesta all'assistente online (assistente/src/index.js): la domanda e gli
// id dei passaggi trovati sul telefono. Risponde il testo da dire, null se
// l'assistente non ha una risposta, undefined se non è raggiungibile.

export const ASSISTANT_URL: string = __ASSISTENTE_URL__;
const TIMEOUT_MS = 10_000;

export async function askAssistant(quadro: string, domanda: string, passaggi: string[], url = ASSISTANT_URL): Promise<string | null | undefined> {
  if (!url || !navigator.onLine) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quadro, domanda, passaggi }),
      signal: ctrl.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { risposta?: string | null };
    return typeof data.risposta === 'string' && data.risposta.trim() ? data.risposta.trim() : null;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
