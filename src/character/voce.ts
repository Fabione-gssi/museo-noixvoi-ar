// Voce del telefono (sintesi vocale del sistema, gratuita e senza rete sulla
// maggior parte dei telefoni) per le risposte libere, che non hanno un audio
// preparato. La bocca non può seguire il volume (il browser non dà l'audio):
// si muove a sillabe mentre parla, si chiude un attimo tra una parola e
// l'altra e si arrotonda sulle o/u della parola detta in quel momento.
// Senza voce italiana sul telefono: solo sottotitoli, con la bocca che si
// muove per la durata stimata della frase.

const SECONDS_PER_WORD = 0.38;
const ROUND: Record<string, number> = { o: 1, u: 1, a: 0.35, e: 0.15, i: 0 };

export class DeviceVoice {
  /** Sta "parlando" (anche in pausa): la bocca segue la voce del telefono, non l'audio preparato. */
  active = false;
  paused = false;
  private synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
  private text = '';
  private word = '';
  private wordAt = 0;
  private startedAt = 0;
  private timer = 0;
  private onEnd: (() => void) | null = null;

  /** Da chiamare dentro il tocco (iOS vuole un gesto prima di parlare dopo un'attesa). */
  unlock() {
    if (!this.synth || this.synth.speaking) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    this.synth.speak(u);
  }

  get hasVoice() {
    return !!this.voice();
  }

  speak(text: string, onEnd?: () => void) {
    this.stop();
    this.text = text;
    this.active = true;
    this.paused = false;
    this.onEnd = onEnd ?? null;
    this.startedAt = performance.now();
    this.word = text.split(/\s+/)[0] ?? '';
    this.wordAt = this.startedAt;
    const estimate = text.split(/\s+/).length * SECONDS_PER_WORD * 1000;
    const voice = this.voice();
    if (!this.synth || !voice) {
      this.timer = window.setTimeout(() => this.finish(), estimate);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 1;
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      this.word = text.slice(e.charIndex).split(/\s+/)[0] ?? '';
      this.wordAt = performance.now();
    };
    u.onend = () => this.finish();
    u.onerror = () => this.finish();
    this.synth.speak(u);
    // Rete di sicurezza: alcuni browser non segnalano la fine.
    this.timer = window.setTimeout(() => this.finish(), estimate * 2 + 3000);
  }

  pause() {
    if (!this.active) return;
    this.paused = true;
    this.synth?.pause();
  }

  resume() {
    if (!this.active) return;
    this.paused = false;
    this.synth?.resume();
  }

  stop() {
    clearTimeout(this.timer);
    if (this.active) this.synth?.cancel();
    this.active = false;
    this.paused = false;
    this.onEnd = null;
  }

  /** Apertura (0-1) e arrotondamento (0-1) della bocca in questo istante. */
  mouth(now: number) {
    if (!this.active || this.paused) return { open: 0, round: 0 };
    const t = (now - this.startedAt) / 1000;
    // Sillabe a circa 5 al secondo, con ampiezza irregolare; chiusura breve a inizio parola.
    const syll = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 5.2);
    const vary = 0.65 + 0.35 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1);
    const gap = Math.min(1, (now - this.wordAt) / 90);
    const vowels = [...this.word.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')].filter((c) => c in ROUND);
    const round = vowels.length ? vowels.reduce((s, c) => s + ROUND[c], 0) / vowels.length : 0;
    return { open: syll * vary * gap * 0.85, round };
  }

  private finish() {
    clearTimeout(this.timer);
    if (!this.active) return;
    const cb = this.onEnd;
    this.active = false;
    this.paused = false;
    this.onEnd = null;
    cb?.();
  }

  private voice() {
    const voices = this.synth?.getVoices() ?? [];
    const it = voices.filter((v) => v.lang.toLowerCase().startsWith('it'));
    return it.find((v) => v.localService) ?? it[0] ?? null;
  }
}
