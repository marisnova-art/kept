/* Kept — Inline formatting engine */
import { hydrateIcons } from '../lib/sanitize.js';

/* =====================================================================
   RICH — inline formatting engine.
   Each block ("container") is read as a flat list of runs {text, marks},
   marks are changed on exact character ranges, and the block is re-rendered
   with clean, canonical markup. With a collapsed caret a zero-width "pending"
   run carries the chosen style, so the very next keystroke (IME included)
   is typed with it — format first, type second.
   ===================================================================== */
const ZW = '​', ZWRE = /​/g;
const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H2', 'H3']);
const MARK_ORDER = ['size', 'color', 'hl', 'b', 'i', 'u', 's'];
const isBlockEl = n => n && n.nodeType === 1 && BLOCK_TAGS.has(n.tagName);
const isLeafEl = n => n.nodeType === 1 && (n.tagName === 'BR' || n.classList.contains('ico'));

const Rich = {
  marksOf(el, m) {
    switch (el.tagName) {
      case 'B': case 'STRONG': m.b = true; break;
      case 'I': case 'EM': m.i = true; break;
      case 'U': m.u = true; break;
      case 'S': case 'STRIKE': case 'DEL': m.s = true; break;
      case 'SPAN': case 'MARK': case 'FONT':
        el.classList.forEach(c => {
          let r;
          if ((r = c.match(/^c-(\w+)$/))) m.color = r[1] === 'default' ? null : r[1];
          else if ((r = c.match(/^fs-(\w+)$/))) m.size = r[1] === 'm' ? null : r[1];
          else if ((r = c.match(/^(hl|bg)-(\w+)$/))) m.hl = r[2] === 'none' ? null : c;
        });
    }
    return m;
  },
  isContainer(el) {
    if (!isBlockEl(el) || el.tagName === 'UL' || el.tagName === 'OL') return false;
    const kids = [...el.childNodes];
    if (!kids.some(isBlockEl)) return true;
    return kids.some(c => !isBlockEl(c) && !(c.nodeType === 3 && !c.nodeValue.trim()));
  },
  containerOf(node, root) {
    let n = node.nodeType === 3 ? node.parentNode : node;
    while (n && n !== root) { if (this.isContainer(n)) return n; n = n.parentNode; }
    return null;
  },
  containersIn(root, range) {
    const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT); let n;
    while ((n = w.nextNode())) if (this.isContainer(n) && range.intersectsNode(n)) out.push(n);
    return out;
  },
  leaves(C) {
    const out = [];
    const walk = node => node.childNodes.forEach(c => {
      if (node === C && isBlockEl(c)) return;
      if (c.nodeType === 3) out.push(c);
      else if (c.nodeType === 1) { if (isLeafEl(c)) out.push(c); else if (!isBlockEl(c)) walk(c); }
    });
    walk(C); return out;
  },
  leafLen: n => n.nodeType === 3 ? n.nodeValue.replace(ZWRE, '').length : 1,
  runsOf(C) {
    const runs = [];
    const walk = (node, m) => node.childNodes.forEach(c => {
      if (node === C && isBlockEl(c)) return;
      if (c.nodeType === 3) { const t = c.nodeValue.replace(ZWRE, ''); if (t) runs.push({ t, m }); }
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') runs.push({ br: true, m });
        else if (c.classList.contains('ico')) runs.push({ ico: c.dataset.ico, m });
        else if (!isBlockEl(c)) walk(c, this.marksOf(c, { ...m }));
      }
    });
    walk(C, {}); return runs;
  },
  rlen: r => r.t != null ? r.t.length : 1,
  /* DOM point → character offset inside container C (zero-width chars ignored) */
  posToOffset(C, node, off) {
    const L = this.leaves(C); let acc = 0;
    if (node.nodeType === 3) for (const l of L) { if (l === node) return acc + node.nodeValue.slice(0, off).replace(ZWRE, '').length; acc += this.leafLen(l); }
    const pt = document.createRange(); try { pt.setStart(node, off); } catch { return 0; } pt.collapse(true);
    acc = 0;
    for (const l of L) { const p = l.parentNode, i = [...p.childNodes].indexOf(l); if (pt.comparePoint(p, i + 1) <= 0) acc += this.leafLen(l); else break; }
    return acc;
  },
  offsetToPos(C, off) {
    const L = this.leaves(C); let acc = 0;
    for (const l of L) {
      const len = this.leafLen(l);
      if (l.nodeType === 3) { if (off <= acc + len) { let k = off - acc, i = 0; const v = l.nodeValue; while (i < v.length && (k > 0 || v[i] === ZW)) { if (v[i] !== ZW) k--; i++; } return { node: l, offset: i }; } }
      else if (off <= acc) { const p = l.parentNode; return { node: p, offset: [...p.childNodes].indexOf(l) }; }
      acc += len;
    }
    const last = L[L.length - 1];
    if (!last) return { node: C, offset: 0 };
    if (last.nodeType === 3) return { node: last, offset: last.nodeValue.length };
    if (last.tagName === 'BR') { const p = last.parentNode; return { node: p, offset: [...p.childNodes].indexOf(last) }; }
    const p = last.parentNode; return { node: p, offset: [...p.childNodes].indexOf(last) + 1 };
  },
  splitAt(runs, off) {
    let acc = 0;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i], L = this.rlen(r);
      if (acc === off) return i;
      if (off < acc + L) { runs.splice(i, 1, { ...r, t: r.t.slice(0, off - acc) }, { ...r, t: r.t.slice(off - acc) }); return i + 1; }
      acc += L;
    }
    return runs.length;
  },
  same(a, b) { return MARK_ORDER.every(k => (a[k] || null) === (b[k] || null)); },
  wrapEl(key, v) {
    if (key === 'size') { const s = document.createElement('span'); s.className = 'fs-' + v; return s; }
    if (key === 'color') { const s = document.createElement('span'); s.className = 'c-' + v; return s; }
    if (key === 'hl') { const s = document.createElement('mark'); s.className = v; return s; }
    return document.createElement({ b: 'b', i: 'i', u: 'u', s: 's' }[key]);
  },
  render(C, runs) {
    // drop empty text, merge equal neighbours (keep the pending run separate)
    const rs = [];
    runs.forEach(r => { if (r.t === '' && !r.pending) return; const p = rs[rs.length - 1]; if (p && p.t != null && r.t != null && !p.pending && !r.pending && this.same(p.m, r.m)) p.t += r.t; else rs.push({ ...r }); });
    const leaf = r => {
      if (r.br) return document.createElement('br');
      if (r.ico) { const s = document.createElement('span'); s.className = 'ico'; s.dataset.ico = r.ico; return s; }
      return (r.node = document.createTextNode(r.t));
    };
    const build = (list, lvl) => {
      const key = MARK_ORDER[lvl]; if (!key) return list.map(leaf);
      const out = []; let i = 0;
      while (i < list.length) {
        const v = list[i].m[key] || null; let j = i; while (j < list.length && (list[j].m[key] || null) === v) j++;
        const kids = build(list.slice(i, j), lvl + 1);
        if (v) { const el = this.wrapEl(key, v); kids.forEach(k => el.appendChild(k)); out.push(el); } else out.push(...kids);
        i = j;
      }
      return out;
    };
    const frag = document.createDocumentFragment(); build(rs, 0).forEach(n => frag.appendChild(n));
    const managed = [...C.childNodes].filter(n => !isBlockEl(n)); const firstBlock = [...C.childNodes].find(isBlockEl);
    managed.forEach(n => n.remove());
    if (firstBlock) C.insertBefore(frag, firstBlock); else C.appendChild(frag);
    const ls = this.leaves(C);
    if (!ls.length && !firstBlock) C.appendChild(document.createElement('br'));
    else if (ls.length && ls[ls.length - 1].nodeType === 1 && ls[ls.length - 1].classList.contains('ico')) ls[ls.length - 1].after(document.createTextNode(ZW)); // caret can land after a trailing icon
    hydrateIcons(C);
    return rs;
  },
  /* style at a collapsed caret = what the next typed character will get */
  marksAtCaret(C, node, off) {
    if (node.nodeType === 3) { const m = {}; const chain = []; let n = node.parentNode; while (n && n !== C) { chain.unshift(n); n = n.parentNode; } chain.forEach(el => this.marksOf(el, m)); return m; }
    const runs = this.runsOf(C); const o = this.posToOffset(C, node, off); let acc = 0, prev = null;
    for (const r of runs) { if (acc >= o) break; prev = r; acc += this.rlen(r); }
    return { ...((prev || runs[0] || { m: {} }).m) };
  },
  /* aggregated state over the current selection, for toolbar highlighting */
  stateOf(root, range) {
    if (range.collapsed) { const C = this.containerOf(range.startContainer, root); return C ? this.marksAtCaret(C, range.startContainer, range.startOffset) : {}; }
    const st = { b: true, i: true, u: true, s: true, color: undefined, hl: undefined, size: undefined }; let any = false;
    this.containersIn(root, range).forEach(C => {
      const runs = this.runsOf(C); const s = this.posToOffset(C, range.startContainer, range.startOffset), e = this.posToOffset(C, range.endContainer, range.endOffset);
      let acc = 0;
      runs.forEach(r => { const L = this.rlen(r); if (acc < e && acc + L > s && r.t != null) { any = true; ['b', 'i', 'u', 's'].forEach(k => { if (!r.m[k]) st[k] = false; }); ['color', 'hl', 'size'].forEach(k => { const v = r.m[k] || null; st[k] = st[k] === undefined ? v : (st[k] === v ? v : '*'); }); } acc += L; });
    });
    if (!any) return {};
    return st;
  },
  /* apply: fn(marks) → new marks, on the selection; returns info to restore the caret */
  apply(root, range, fn) {
    if (range.collapsed) {
      const C = this.containerOf(range.startContainer, root); if (!C) return null;
      const cur = this.marksAtCaret(C, range.startContainer, range.startOffset);
      const runs = this.runsOf(C); const off = this.posToOffset(C, range.startContainer, range.startOffset);
      const i = this.splitAt(runs, off); runs.splice(i, 0, { t: ZW, m: fn({ ...cur }), pending: true });
      const rs = this.render(C, runs); const pend = rs.find(r => r.pending);
      return { pending: pend.node, caret: { node: pend.node, offset: 1 } };
    }
    const Cs = this.containersIn(root, range); if (!Cs.length) return null;
    const plan = Cs.map(C => ({ C, s: this.posToOffset(C, range.startContainer, range.startOffset), e: this.posToOffset(C, range.endContainer, range.endOffset) }));
    plan.forEach(p => {
      if (p.e <= p.s) return;
      const runs = this.runsOf(p.C); const a = this.splitAt(runs, p.s); const b = this.splitAt(runs, p.e);
      for (let k = a; k < b; k++) runs[k] = { ...runs[k], m: fn({ ...runs[k].m }) };
      this.render(p.C, runs);
    });
    const first = plan[0], last = plan[plan.length - 1];
    return { start: this.offsetToPos(first.C, first.s), end: this.offsetToPos(last.C, last.e) };
  },
  insertIcon(root, range, name) {
    const C = this.containerOf(range.endContainer, root); if (!C) return null;
    const cur = this.marksAtCaret(C, range.endContainer, range.endOffset);
    const runs = this.runsOf(C); const off = this.posToOffset(C, range.endContainer, range.endOffset);
    const i = this.splitAt(runs, off); runs.splice(i, 0, { ico: name, m: cur });
    this.render(C, runs);
    return { caret: this.offsetToPos(C, off + 1) };
  },
  /* make sure top-level content lives in paragraphs (typing into an empty editor creates bare text) */
  normalizeTop(root) {
    const bad = [...root.childNodes].filter(n => !isBlockEl(n) && !(n.nodeType === 3 && !n.nodeValue.trim() && n.nodeValue.includes('\n')));
    if (!bad.length) return false;
    let p = null;
    [...root.childNodes].forEach(n => {
      if (isBlockEl(n)) { p = null; return; }
      if (n.nodeType === 3 && !n.nodeValue.trim() && n.nodeValue.includes('\n')) { n.remove(); return; }
      if (!p) { p = document.createElement('p'); root.insertBefore(p, n); }
      p.appendChild(n);
    });
    return true;
  },
  /* remove the zero-width char once real text has been typed next to it */
  scrubZW(node) {
    if (!node || node.nodeType !== 3 || !node.nodeValue.includes(ZW) || node.nodeValue.replace(ZWRE, '') === '') return null;
    const s = getSelection(); const inNode = s.rangeCount && s.anchorNode === node; const off = inNode ? s.anchorOffset : 0;
    const before = node.nodeValue.slice(0, off).replace(ZWRE, '').length;
    const prevIco = node.previousSibling && node.previousSibling.nodeType === 1 && node.previousSibling.classList?.contains('ico');
    node.nodeValue = node.nodeValue.replace(ZWRE, '');
    if (prevIco && !node.nodeValue) node.nodeValue = ZW;
    if (inNode) { const r = document.createRange(); r.setStart(node, Math.min(before, node.nodeValue.length)); r.collapse(true); s.removeAllRanges(); s.addRange(r); }
    return true;
  },
  /* a pending run the caret has left behind is just an empty wrapper — drop it */
  dropPending(node, root) {
    if (!node || !node.isConnected || node.nodeValue.replace(ZWRE, '') !== '') return;
    let p = node.parentNode; node.remove();
    while (p && p !== root && !isBlockEl(p) && !p.childNodes.length) { const q = p.parentNode; p.remove(); p = q; }
    if (p && isBlockEl(p) && !p.childNodes.length) p.appendChild(document.createElement('br'));
  }
};

export { Rich, ZWRE, isBlockEl };
