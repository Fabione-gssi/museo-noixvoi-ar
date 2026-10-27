"""Mappa di profondità con Depth Anything V2 Small (ONNX, Apache-2.0, CPU).

Serve al leggero effetto di parallasse del racconto. Uscita: JPEG in scala di
grigi (chiaro = vicino), lato lungo 512 px.

Uso: python depth.py <immagine> <out.jpg> <modello.onnx>
"""
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

from common import emit

SIDE = 518  # lato su cui è stato addestrato il modello (multiplo di 14)
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def main(image_path, out_path, model_path):
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    scale = SIDE / max(w, h)
    nw, nh = max(14, round(w * scale / 14) * 14), max(14, round(h * scale / 14) * 14)
    x = (np.asarray(img.resize((nw, nh), Image.BICUBIC), dtype=np.float32) / 255 - MEAN) / STD
    x = x.transpose(2, 0, 1)[None]
    emit("progress", step="profondita", percent=30)
    sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    depth = sess.run(None, {"pixel_values": x})[0][0]
    lo, hi = np.percentile(depth, 2), np.percentile(depth, 98)
    d = np.clip((depth - lo) / max(1e-6, hi - lo), 0, 1)
    out = Image.fromarray((d * 255).astype(np.uint8), "L")
    side = 512 / max(w, h)
    out = out.resize((round(w * side), round(h * side)), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    out.save(out_path, quality=85)
    emit("done", step="profondita")


if __name__ == "__main__":
    main(*sys.argv[1:4])
