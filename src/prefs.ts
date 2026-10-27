// Preferenze del visitatore in memoria locale. La memoria può non esserci
// (navigazione privata, dati bloccati): in quel caso si usano i valori in RAM.

const mem = new Map<string, string>();
const PREFIX = 'quadri:';

export function getPref(key: string, fallback: string) {
  try {
    return localStorage.getItem(PREFIX + key) ?? mem.get(key) ?? fallback;
  } catch {
    return mem.get(key) ?? fallback;
  }
}

export function setPref(key: string, value: string) {
  mem.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Solo in RAM.
  }
}
