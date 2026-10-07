/* Kept — Record lists */
import { S, catOf, live, typeList, typeOf } from '../data/store.js';
import { byDay, runSearch, sortEntries, words } from '../features/search.js';
import { fmtNum, t, tn } from '../lib/i18n.js';
import { esc, icon } from '../lib/utils.js';
import { emptyState, entryList, header, listControls } from '../ui/entries.js';
import { V } from '../ui/router.js';
import { allTags } from './organize.js';

/* ---------- Lists ---------- */
function viewList(kind, arg) {
  let list = live(), title = '', sub = '', type = null, ws;
  const filt = {
    all: () => { title = t('nav.all'); },
    recent: () => { title = t('nav.recent'); const lim = Date.now() - 14 * 864e5; list = list.filter(e => new Date(e.updated_at) > lim); sub = t('recent.sub'); },
    favorites: () => { title = t('nav.favorites'); list = list.filter(e => e.favorite); },
    type: () => { type = arg; title = typeOf(arg).label; list = list.filter(e => e.type === arg); },
    category: () => { const c = catOf(arg); title = c ? `<span style="color:${esc(c.color)}">●</span> ${esc(c.name)}` : t('nav.categories'); list = list.filter(e => e.category_id === arg); },
    uncategorized: () => { title = t('nav.uncategorized'); list = list.filter(e => !e.category_id); },
    tag: () => { title = '#' + esc(arg); list = list.filter(e => e.tags.includes(arg)); }
  };
  filt[kind]?.();
  list = kind === 'recent' ? sortEntries(list, 'updated') : sortEntries(list);
  const ttl = ['category', 'tag'].includes(kind) ? title : esc(title);
  return `<div class="wrap view-enter">${header(ttl + ` <span class="mut">${fmtNum(list.length)}</span>`, sub ? esc(sub) : '', listControls())}
    ${entryList(list, { grouped: kind !== 'recent' && byDay(), empty: kind === 'favorites' ? emptyState(t('empty.favTitle'), t('empty.favSub')) : emptyState(t('empty.title'), t('empty.sub'), true, type) })}</div>`;
}
function viewSearch() {
  const f = V.search; const ws = words(f.q); const list = runSearch(f);
  const cats = [...S.categories.values()].sort((a, b) => a.name.localeCompare(b.name));
  const tags = allTags();
  return `<div class="wrap view-enter">${header(f.q ? `“${esc(f.q)}”` : esc(t('search.title')), esc(tn('search.results', list.length)), listControls({ select: true }))}
    <div class="toolbar-row ${V.filtOpen ? 'open' : ''}" role="group" aria-label="${esc(t('search.filters'))}">
      <div class="seg">${['all', 'recent', 'fav'].map(s => `<button class="${f.scope === s ? 'on' : ''}" data-act="sScope" data-v="${s}">${esc(t('search.scope.' + s))}</button>`).join('')}</div>
      <button class="btn sm filt-toggle" data-act="filtToggle">${icon('sliders-horizontal')}${esc(t('search.filters'))}${f.type || f.cat || f.tag || f.from || f.to ? ' •' : ''}</button>
      <select class="select adv" data-chg="sType"><option value="">${esc(t('search.anyType'))}</option>${typeList().map(x => `<option value="${x.id}" ${f.type === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
      <select class="select adv" data-chg="sCat"><option value="">${esc(t('search.anyCat'))}</option><option value="__none" ${f.cat === '__none' ? 'selected' : ''}>${esc(t('nav.uncategorized'))}</option>${cats.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select class="select adv" data-chg="sTag"><option value="">${esc(t('search.anyTag'))}</option>${tags.map(([g]) => `<option value="${esc(g)}" ${f.tag === g ? 'selected' : ''}>#${esc(g)}</option>`).join('')}</select>
      <label class="select adv" style="display:inline-flex;align-items:center;gap:6px;background-image:none;padding-right:10px">${icon('calendar')}<input type="date" data-chg="sFrom" value="${esc(f.from)}" style="border:0;background:transparent;outline:0;font-size:var(--t-cap)" aria-label="${esc(t('search.from'))}"></label>
      <label class="select adv" style="display:inline-flex;align-items:center;gap:6px;background-image:none;padding-right:10px">→<input type="date" data-chg="sTo" value="${esc(f.to)}" style="border:0;background:transparent;outline:0;font-size:var(--t-cap)" aria-label="${esc(t('search.to'))}"></label>
      ${f.type || f.cat || f.tag || f.from || f.to || f.scope !== 'all' ? `<button class="btn sm ghost" data-act="clearFilters">${icon('x')}${esc(t('search.clear'))}</button>` : ''}
    </div>
    ${entryList(list, { ws, grouped: !f.q && byDay(), empty: emptyState(t('search.none'), t('search.noneSub'), false) })}</div>`;
}

export { viewList, viewSearch };
