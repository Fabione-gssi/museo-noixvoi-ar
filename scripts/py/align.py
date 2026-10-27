"""Allinea una registrazione vera a testo.txt (faster-whisper, locale, CPU).

Whisper trascrive con i tempi delle parole; poi ogni parola di testo.txt viene
abbinata alla parola trascritta corrispondente (confronto di sequenze). Le
parole non abbinate prendono un tempo interpolato. Il testo dei sottotitoli è
sempre quello di testo.txt, mai la trascrizione.

Uso: python align.py <audio> <testo.txt> <out.json> <cartella-modelli> <ffmpeg>
"""
import difflib
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

from common import emit, norm, read_text, split_sentences, words


def load_audio(path, ffmpeg):
    # PyAV in faster-whisper non è compatibile con questa versione: decodifica con ffmpeg.
    raw = subprocess.run([ffmpeg, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def main(audio_path, text_path, out_path, models_dir, ffmpeg):
    audio = load_audio(audio_path, ffmpeg)
    duration = len(audio) / 16000
    emit("progress", step="allineamento", percent=5, message="carico il modello")
    model = WhisperModel("small", device="cpu", compute_type="int8", download_root=models_dir)
    segments, _ = model.transcribe(audio, language="it", word_timestamps=True, vad_filter=True)
    heard = []
    for seg in segments:
        for w in seg.words or []:
            heard.append((norm(w.word), w.start, w.end))
        emit("progress", step="allineamento", percent=min(95, 5 + round(90 * seg.end / duration)))

    text = read_text(text_path)
    sents = split_sentences(text)
    ref = [(si, w) for si, s in enumerate(sents) for w in words(s)]
    times = [None] * len(ref)
    sm = difflib.SequenceMatcher(a=[norm(w) for _, w in ref], b=[h[0] for h in heard], autojunk=False)
    for block in sm.get_matching_blocks():
        for k in range(block.size):
            _, s, e = heard[block.b + k]
            times[block.a + k] = (s, e)
    matched = sum(t is not None for t in times)

    # Interpolazione lineare per le parole non riconosciute.
    known = [i for i, t in enumerate(times) if t]
    for i, t in enumerate(times):
        if t:
            continue
        prev = max((k for k in known if k < i), default=None)
        nxt = min((k for k in known if k > i), default=None)
        a = times[prev][1] if prev is not None else 0.0
        b = times[nxt][0] if nxt is not None else duration
        span_from = prev if prev is not None else -1
        span_to = nxt if nxt is not None else len(times)
        f0 = (i - span_from) / (span_to - span_from)
        f1 = (i + 1 - span_from) / (span_to - span_from)
        times[i] = (a + (b - a) * f0 - 0.0, a + (b - a) * f1)

    out_sents = []
    for si, s in enumerate(sents):
        ws = [{"w": w, "start": round(times[i][0], 3), "end": round(times[i][1], 3)} for i, (k, w) in enumerate(ref) if k == si]
        if not ws:
            continue
        out_sents.append({"text": s, "start": ws[0]["start"], "end": ws[-1]["end"], "words": ws})

    coverage = matched / max(1, len(ref))
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"source": "whisper", "durationSec": round(duration, 3), "coverage": round(coverage, 3), "sentences": out_sents},
                  f, ensure_ascii=False, indent=1)
    emit("done", step="allineamento", coverage=round(coverage, 3))


if __name__ == "__main__":
    main(*sys.argv[1:6])
