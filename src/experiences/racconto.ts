import { StoryRenderer } from '../story/StoryRenderer';
import { rectAt, fitToScreen, keyIndexAt, type Keyframe } from '../story/timeline';
import { Player } from '../ui/player';
import { mediaVideoEl } from '../media';
import { dataUrl, type PaintingMeta } from '../data';
import { probe, log } from '../probe';

// Racconto: dopo il riconoscimento (o senza fotocamera) parte la storia.
// Con racconto.mp4 si guarda il video; altrimenti un racconto animato in tempo
// reale costruito da immagine + audio + timeline.

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export interface StoryHandle { stop(): void }

export async function startRacconto(meta: PaintingMeta, screen: HTMLElement, onBack: () => void): Promise<StoryHandle> {
  const stage = $('.story-stage', screen);
  const subs = $('.subtitles', screen);
  const controls = $('.story-controls', screen);
  const label = $('.story-label', screen);
  const chapters = $('.chapters', screen);
  $('.story-title', screen).textContent = meta.title;
  $('.story-artist', screen).textContent = [meta.artist, meta.year].filter(Boolean).join(', ');
  $('.badge-demo', screen).hidden = !meta.demo;
  let handle: StoryHandle = { stop() {} };
  $<HTMLButtonElement>('.story-back', screen).onclick = () => {
    handle.stop();
    onBack();
  };

  const video = meta.racconto?.video;
  if (video) return (handle = startVideo(meta, stage, subs, controls));

  // Lo stage finisce dove iniziano sottotitoli e controlli, così l'inquadratura non resta coperta.
  const bottom = $('.story-bottom', screen);
  const fitStage = () => (stage.style.bottom = `${Math.max(0, bottom.offsetHeight - 24)}px`);
  fitStage();
  const renderer = new StoryRenderer(stage);
  await renderer.load(dataUrl(meta.id, meta.image), meta.depth ? dataUrl(meta.id, meta.depth) : undefined);
  const player = new Player(controls, subs);
  if (meta.audio) {
    await player.load({ src: dataUrl(meta.id, meta.audio.src), fallback: dataUrl(meta.id, meta.audio.fallback), subtitles: meta.subtitles ? dataUrl(meta.id, meta.subtitles) : undefined });
  }
  const timeline: Keyframe[] = meta.racconto?.timeline ?? [];

  // Capitoli: un pulsante per ogni particolare nominato, per rivedere quel punto.
  chapters.replaceChildren(
    ...timeline
      .filter((k) => k.args.label)
      .map((k) => {
        const b = document.createElement('button');
        b.textContent = k.args.label!;
        b.onclick = () => {
          player.seekTo(k.t);
          void player.play();
          log('chapter', k.args.label);
        };
        return b;
      }),
  );

  const ro = new ResizeObserver(() => {
    fitStage();
    renderer.resize();
  });
  ro.observe(bottom);
  let running = true;
  let lastKey = -2;
  const started = performance.now();
  const loop = () => {
    if (!running) return;
    const t = player.time;
    const view = fitToScreen(rectAt(timeline, t), meta.aspect, renderer.aspect);
    // Dissolvenza d'ingresso di 0,8 s.
    renderer.render(view, Math.min(1, (performance.now() - started) / 800));
    const ki = keyIndexAt(timeline, t);
    if (ki !== lastKey) {
      lastKey = ki;
      const text = timeline[ki]?.args.label ?? '';
      label.textContent = text;
      label.hidden = !text;
      [...chapters.children].forEach((c) => c.classList.toggle('current', c.textContent === text && !!text));
      if (text) log('camera', text);
    }
    probe.storyTime = Math.round(t * 10) / 10;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  probe.phase = 'story';
  log('story-start', meta.id);
  void player.play();

  handle = {
    stop() {
      running = false;
      ro.disconnect();
      stage.style.bottom = '';
      player.destroy();
      renderer.dispose();
      chapters.replaceChildren();
    },
  };
  return handle;
}

function startVideo(meta: PaintingMeta, stage: HTMLElement, subs: HTMLElement, controls: HTMLElement): StoryHandle {
  const v = mediaVideoEl;
  const src = meta.racconto!.video!;
  const webm = src.fallback && v.canPlayType('video/webm; codecs="vp9, opus"');
  v.src = dataUrl(meta.id, webm ? src.fallback! : src.src);
  v.controls = true;
  v.className = 'story-video';
  stage.append(v);
  subs.hidden = true;
  controls.replaceChildren();
  probe.phase = 'story';
  log('story-video', meta.id);
  void v.play().catch(() => undefined);
  return {
    stop() {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.remove();
    },
  };
}
