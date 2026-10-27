import { audioEl } from '../media';
import { parseVtt, cueAt, type Cue } from '../story/timeline';
import { getPref, setPref } from '../prefs';

// Lettore audio comune: play/pausa, ±15 s, sottotitoli, muto, barra di
// avanzamento. Usa sempre l'unico elemento <audio> sbloccato al primo tap.

export interface PlayerSources { src: string; fallback: string; subtitles?: string }

export class Player {
  private cues: Cue[] = [];
  private raf = 0;
  readonly root: HTMLElement;

  constructor(private host: HTMLElement, private subtitleEl: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'player';
    this.root.innerHTML = `
      <input class="seek" type="range" min="0" max="1000" value="0" aria-label="Posizione nell'audio" />
      <div class="player-row">
        <button data-a="back" aria-label="Indietro di 15 secondi">−15</button>
        <button data-a="play" class="play" aria-label="Riproduci">▶</button>
        <button data-a="fwd" aria-label="Avanti di 15 secondi">+15</button>
        <button data-a="subs" aria-pressed="true" aria-label="Sottotitoli">CC</button>
        <button data-a="mute" aria-pressed="false" aria-label="Muto">🔊</button>
        <span class="time" aria-hidden="true">0:00</span>
      </div>`;
    host.append(this.root);
    this.root.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      if (a === 'play') this.toggle();
      if (a === 'back') audioEl.currentTime = Math.max(0, audioEl.currentTime - 15);
      if (a === 'fwd') audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 15);
      if (a === 'subs') this.setSubs(!this.subsOn);
      if (a === 'mute') this.setMuted(!audioEl.muted);
    });
    const seek = this.root.querySelector<HTMLInputElement>('.seek')!;
    seek.addEventListener('input', () => {
      if (audioEl.duration) audioEl.currentTime = (Number(seek.value) / 1000) * audioEl.duration;
    });
    for (const ev of ['play', 'pause', 'ended']) audioEl.addEventListener(ev, () => this.sync());
    this.setSubs(getPref('subs', '1') === '1');
    this.setMuted(getPref('muted', '0') === '1');
  }

  get subsOn() {
    return this.root.querySelector('[data-a="subs"]')!.getAttribute('aria-pressed') === 'true';
  }

  async load(s: PlayerSources) {
    const opus = audioEl.canPlayType('audio/ogg; codecs=opus');
    audioEl.src = opus ? s.src : s.fallback;
    audioEl.currentTime = 0;
    this.cues = [];
    if (s.subtitles) {
      try {
        this.cues = parseVtt(await (await fetch(s.subtitles)).text());
      } catch {
        this.cues = [];
      }
    }
    this.loop();
  }

  play() {
    return audioEl.play().catch(() => this.sync());
  }

  pause() {
    audioEl.pause();
  }

  toggle() {
    if (audioEl.paused) void this.play();
    else this.pause();
  }

  get time() {
    return audioEl.currentTime;
  }

  seekTo(t: number) {
    audioEl.currentTime = t;
  }

  private setSubs(on: boolean) {
    this.root.querySelector('[data-a="subs"]')!.setAttribute('aria-pressed', String(on));
    this.subtitleEl.hidden = !on;
    setPref('subs', on ? '1' : '0');
  }

  private setMuted(m: boolean) {
    audioEl.muted = m;
    const b = this.root.querySelector('[data-a="mute"]')!;
    b.setAttribute('aria-pressed', String(m));
    b.textContent = m ? '🔇' : '🔊';
    setPref('muted', m ? '1' : '0');
  }

  private sync() {
    const b = this.root.querySelector('[data-a="play"]')!;
    b.textContent = audioEl.paused ? '▶' : '❚❚';
    b.setAttribute('aria-label', audioEl.paused ? 'Riproduci' : 'Pausa');
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    const t = audioEl.currentTime;
    const cue = cueAt(this.cues, t);
    const text = cue?.text ?? '';
    if (this.subtitleEl.textContent !== text) this.subtitleEl.textContent = text;
    this.subtitleEl.classList.toggle('empty', !text);
    const seek = this.root.querySelector<HTMLInputElement>('.seek')!;
    if (audioEl.duration && document.activeElement !== seek) seek.value = String(Math.round((t / audioEl.duration) * 1000));
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    this.root.querySelector('.time')!.textContent = `${fmt(t)} / ${fmt(audioEl.duration || 0)}`;
    this.raf = requestAnimationFrame(this.loop);
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    audioEl.pause();
    this.root.remove();
  }
}
