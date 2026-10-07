/* Kept — Story home: the day and the records told as a few sentences instead of cards.
   Each paragraph may open with a short literary phrase that meets the day (season, time, weather),
   followed by what the records say, with counts and titles woven in as tappable chips.
   Choices are seeded by the date, so the story stays the same through the day until reshuffled. */
import { LANG } from '../lib/i18n.js';
import { esc, icon } from '../lib/utils.js';
import { Weather } from './weather.js';
import ko from '../i18n/story.ko.js';
import en from '../i18n/story.en.js';

const PACKS = { ko, en };
const pack = () => PACKS[LANG] || en;

function rng(seed) {
  let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
/* Korean particles: pick 이/가, 을/를, 은/는, 와/과, 으로/로 from the last syllable of the word before */
const DIGIT_BATCHIM = { 0: 1, 1: 2, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 2, 8: 2, 9: 0 }; // 0 none · 1 final consonant · 2 final ㄹ
function finalOf(word) {
  const s = String(word).replace(/[\s'"’”‘“)\].,!?]+$/, ''); const ch = s.slice(-1); if (!ch) return 0;
  if (/\d/.test(ch)) return DIGIT_BATCHIM[ch];
  const c = ch.charCodeAt(0); if (c < 0xac00 || c > 0xd7a3) return /[lmnr]$/i.test(ch) ? 1 : 0;
  const j = (c - 0xac00) % 28; return j === 0 ? 0 : j === 8 ? 2 : 1;
}
function josa(word, pair) {
  const [a, b] = pair.split('/'); const f = finalOf(word);
  if (a === '으로') return f === 1 ? '으로' : '로';
  return f ? a : b;
}
/* fill {slot} and {slot:이/가}; slots are { html, text } so particles follow the visible word */
function fill(tpl, slots) {
  return tpl.split(/(\{\w+(?::[^}]+)?\})/).map(part => {
    const m = part.match(/^\{(\w+)(?::([^}]+))?\}$/);
    if (!m) return esc(part);
    const v = slots[m[1]]; if (v == null) return '';
    const html = typeof v === 'object' ? v.html : esc(v); const text = typeof v === 'object' ? v.text : String(v);
    return html + (m[2] && LANG === 'ko' ? josa(text, m[2]) : '');
  }).join('');
}
function season(d = new Date()) {
  let m = d.getMonth(); if ((Weather.city()?.lat ?? 1) < 0) m = (m + 6) % 12; // southern hemisphere
  return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
}
const timeSlot = h => h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night';
function weatherPool() {
  const k = Weather.data && Weather.data.city === Weather.city()?.id ? Weather.kind() : null;
  return { rain: 'rain', drizzle: 'rain', thunder: 'rain', snow: 'snow', clear: 'clear', partly: 'clear', cloudy: 'cloudy', fog: 'cloudy' }[k] || null;
}
const count = (key, n) => { const c = pack().counts[key]; return typeof c === 'function' ? c(n) : c.replace('{n}', n); };
const chip = (key, n, ic, href) => { const txt = count(key, n); return { html: `<a class="sc" href="${href}"><span class="ic">${icon(ic)}</span><b>${esc(txt)}</b></a>`, text: txt }; };
const titleChip = (e, title) => { const q = pack().quote(title); return { html: `<button class="st-t" data-act="open" data-id="${e.id}">${esc(q)}</button>`, text: q }; };

/* data: { greet, nameHTML, nameText, events, tasksOpen, overdue, ideas, items, contacts, notes, featured, streak, total, titleOf, when } */
function storyHTML(data, shift = 0) {
  const P = pack(); const now = new Date(); const day = now.toISOString().slice(0, 10);
  const r = rng(`${day}|${LANG}|${shift}`); const pick = a => a[Math.floor(r() * a.length)];
  const used = new Set();
  const phrase = pools => { const all = pools.flatMap(k => P.phrases[k] || []).filter(x => !used.has(x)); const p = all.length ? pick(all) : ''; used.add(p); return p; };
  const paras = [];
  const add = (html, lead) => paras.push({ html, lead });

  // 1. greeting, led by the hour or the weather
  const wp = weatherPool();
  add(fill(pick(P.lines.greet), { greet: data.greet, name: data.nameText ? { html: data.nameHTML, text: data.nameText } : '' }).replace(/, \./, '.').replace(/,\s*$/, ''), phrase(wp && r() < .6 ? [wp] : [timeSlot(now.getHours())]));
  if (!data.total) { add(fill(pick(P.lines.empty), {}), phrase([season(now)])); return render(paras); }

  // 2. the day's plan
  const plan = [];
  if (data.events.length) { const e = data.events[0]; plan.push(fill(pick(P.lines.events), { chip: chip('events', data.events.length, 'calendar', '#/calendar'), first: titleChip(e, data.titleOf(e)), when: data.when(e) })); }
  if (data.tasksOpen.length) { const e = data.tasksOpen[0]; plan.push(fill(pick(P.lines.tasks), { chip: chip('tasks', data.tasksOpen.length, 'check', '#/tasks'), first: titleChip(e, data.titleOf(e)) })); }
  if (data.overdue) plan.push(fill(pick(P.lines.overdue), { n: data.overdue }));
  if (!plan.length) plan.push(fill(pick(data.events.length ? P.lines.tasksNone : P.lines.eventsNone), {}));
  add(plan.join(' '), phrase([season(now)]));

  // 3. what the user chose to keep on the home screen
  if (data.featured.length) add(fill(pick(P.lines.featured), { list: { html: P.joinList(data.featured.map(e => titleChip(e, data.titleOf(e)).html)), text: '' } }));

  // 4. the collections, two to a paragraph so it reads like prose
  const bits = [];
  if (data.ideas.length) bits.push(fill(pick(P.lines.ideas), { chip: chip('ideas', data.ideas.length, 'lightbulb', '#/type/idea'), first: titleChip(data.ideas[0], data.titleOf(data.ideas[0])) }));
  if (data.notes.length) bits.push(fill(pick(P.lines.notes), { chip: chip('notes', data.notes.length, 'file-text', '#/type/note'), first: titleChip(data.notes[0], data.titleOf(data.notes[0])) }));
  if (data.items.length) bits.push(fill(pick(P.lines.items), { chip: chip('items', data.items.length, 'map-pin', '#/items') }));
  if (data.contacts.length) bits.push(fill(pick(P.lines.contacts), { chip: chip('contacts', data.contacts.length, 'contact', '#/contacts'), first: titleChip(data.contacts[0], data.titleOf(data.contacts[0])) }));
  for (let i = 0; i < bits.length; i += 2) add(bits.slice(i, i + 2).join(' '), i === 0 ? phrase([season(now), 'any']) : '');

  // 5. closing
  add(data.streak > 1 ? fill(pick(P.lines.streak), { n: data.streak }) : fill(pick(P.lines.total), { chip: chip('total', data.total, 'archive', '#/all') }), phrase(['any']));
  return render(paras);
}
function render(paras) {
  return paras.map((p, i) => `<p class="st-p" style="--i:${i}">${p.lead ? `<span class="st-lead">${esc(p.lead)}.</span> ` : ''}${p.html}</p>`).join('');
}
const phraseCount = () => Object.values(pack().phrases).reduce((n, a) => n + a.length, 0);

export { josa, phraseCount, storyHTML };
