// Testo completo del museo sul personaggio (approfondimento.txt) → passaggi.
//
// Formato (scritto dal museo, in prima persona come parla il personaggio):
//   Chi parla: Albrecht Dürer, pittore di Norimberga, nel suo autoritratto del 1500.
//   ## Titolo di una sezione
//   Un paragrafo per idea, separati da una riga vuota.
//   Fonte: da dove viene il paragrafo (riga subito sotto).
// I paragrafi lunghi si spezzano tra una frase e l'altra.

const MAX_WORDS = 110;

/** @returns {{ chiParla: string, passages: { id: string, section: string, text: string, fonte?: string }[] }} */
export function parseApprofondimento(src) {
  let chiParla = '';
  let section = '';
  const passages = [];
  const add = (text, fonte) => {
    const sentences = text.match(/[^.!?]+[.!?]+["»]?\s*|[^.!?]+$/g) ?? [text];
    let cur = '';
    const push = () => {
      if (cur.trim()) passages.push({ id: `p${passages.length + 1}`, section, text: cur.trim(), ...(fonte ? { fonte } : {}) });
      cur = '';
    };
    for (const s of sentences) {
      if (cur && (cur + s).split(/\s+/).length > MAX_WORDS) push();
      cur += s;
    }
    push();
  };
  for (const block of src.replace(/\r/g, '').split(/\n\s*\n/)) {
    const body = [];
    let fonte;
    for (const l of block.split('\n').map((x) => x.trim()).filter(Boolean)) {
      if (/^chi parla\s*:/i.test(l)) chiParla = l.replace(/^chi parla\s*:\s*/i, '');
      else if (l.startsWith('#')) section = l.replace(/^#+\s*/, '');
      else if (/^fonte\s*:/i.test(l)) fonte = l.replace(/^fonte\s*:\s*/i, '');
      else body.push(l);
    }
    if (body.length) add(body.join(' '), fonte);
  }
  return { chiParla, passages };
}
