"""Voce DEMO: sintetizza testo.txt con Piper (voce "serena", dataset sintetico CC-BY-4.0).

Genera frase per frase, così i tempi di ogni frase sono esatti e non serve
riconoscimento vocale per l'allineamento. I tempi delle parole sono stimati
in proporzione alla lunghezza.

Uso: python tts.py <testo.txt> <out.wav> <out-allineamento.json> <modello.onnx> [pronuncia.txt]
"""
import json
import re
import sys
import wave

import numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig

from common import emit, read_text, split_sentences, words

PAUSE_SENTENCE = 0.45
PAUSE_PARAGRAPH = 0.9


def load_pronunciations(path):
    """Righe "parola = lettura"; le voci più lunghe hanno la precedenza."""
    if not path:
        return []
    pairs = []
    for line in read_text(path).splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            a, b = (x.strip() for x in line.split("=", 1))
            pairs.append((a, b))
    return sorted(pairs, key=lambda p: -len(p[0]))


def spoken(sentence, pron):
    for a, b in pron:
        sentence = re.sub(rf"(?<!\w){re.escape(a)}(?!\w)", b, sentence)
    return sentence


def main(text_path, wav_path, align_path, model_path, pron_path=None):
    text = read_text(text_path)
    pron = load_pronunciations(pron_path)
    voice = PiperVoice.load(model_path)
    rate = voice.config.sample_rate
    # Leggermente più lenta del normale: in sala si ascolta in piedi, con rumore.
    syn = SynthesisConfig(length_scale=1.08)

    paragraphs = [p for p in text.strip().split("\n\n") if p.strip()]
    chunks, sentences, t = [], [], 0.0
    total = sum(len(split_sentences(p)) for p in paragraphs)
    done = 0
    for pi, para in enumerate(paragraphs):
        for si, sent in enumerate(split_sentences(para)):
            audio = np.concatenate([c.audio_float_array for c in voice.synthesize(spoken(sent, pron), syn)])
            dur = len(audio) / rate
            ws = words(sent)
            weights = [len(w) + 1 for w in ws]
            acc, wlist = 0.0, []
            for w, k in zip(ws, weights):
                start = t + dur * acc / sum(weights)
                acc += k
                wlist.append({"w": w, "start": round(start, 3), "end": round(t + dur * acc / sum(weights), 3)})
            sentences.append({"text": sent, "start": round(t, 3), "end": round(t + dur, 3), "words": wlist, "paragraph": pi})
            chunks.append(audio)
            t += dur
            last = si == len(split_sentences(para)) - 1
            pause = PAUSE_PARAGRAPH if last else PAUSE_SENTENCE
            chunks.append(np.zeros(int(pause * rate), dtype=np.float32))
            t += pause
            done += 1
            emit("progress", step="voce", percent=round(100 * done / total))

    pcm = (np.clip(np.concatenate(chunks), -1, 1) * 32767).astype("<i2")
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    with open(align_path, "w", encoding="utf-8") as f:
        json.dump({"source": "tts", "voice": "piper it_IT-serena-medium", "durationSec": round(t, 3), "sentences": sentences}, f, ensure_ascii=False, indent=1)
    emit("done", step="voce", durationSec=round(t, 1))


if __name__ == "__main__":
    main(*sys.argv[1:6])
