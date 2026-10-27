"""Funzioni condivise dagli script Python della pipeline (testo, frasi, parole)."""
import json
import re
import sys
import unicodedata

# Le frasi finiscono con . ! ? seguiti da spazio o fine testo.
_SENT_END = re.compile(r'(?<=[.!?…])\s+')
_WORD = re.compile(r"[\wÀ-ÿ]+(?:['’][\wÀ-ÿ]+)*", re.UNICODE)


def emit(event, **data):
    """Una riga JSON per evento su stdout (letta da Node e dallo Studio)."""
    sys.stdout.write(json.dumps({"event": event, **data}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def read_text(path):
    with open(path, encoding="utf-8-sig") as f:
        return f.read()


def split_sentences(text):
    """Frasi in ordine; i paragrafi vuoti vengono saltati."""
    out = []
    for para in re.split(r'\n\s*\n', text.strip()):
        para = " ".join(para.split())
        out += [s.strip() for s in _SENT_END.split(para) if s.strip()]
    return out


def words(text):
    """Parole visibili (con l'apostrofo agganciato: "dell'attuale")."""
    return _WORD.findall(text)


def norm(word):
    """Forma confrontabile: minuscole, senza accenti né apostrofi."""
    w = unicodedata.normalize("NFKD", word.lower())
    return "".join(c for c in w if c.isalnum())
