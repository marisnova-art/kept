/* Kept — Categories, tags and trash */
import { S, live } from '../data/store.js';
import { fmtNum, t, tn } from '../lib/i18n.js';
import { esc, icon } from '../lib/utils.js';
import { emptyState, entryList, header } from '../ui/entries.js';

/* ---------- Categories & tags ---------- */
function allTags() { const m = new Map(); live().forEach(e => e.tags.forEach(g => m.set(g, (m.get(g) || 0) + 1))); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
function viewCategories() {
  const cats = [...S.categories.values()].sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name));
  const cnt = id => live().filter(e => e.category_id === id).length;
  return `<div class="wrap view-enter" style="max-width:760px">${header(esc(t('nav.categories')), esc(t('cat.sub')), `<button class="btn primary" data-act="catNew">${icon('plus')}${esc(t('cat.new'))}</button>`)}
    <div class="panel">${cats.length ? cats.map(c => `<div class="cat-row"><button class="sw-btn" style="--cc:${esc(c.color)}" data-act="catColor" data-id="${c.id}" aria-label="${esc(t('cat.color'))}"></button>
      <input value="${esc(c.name)}" maxlength="60" data-cat-name="${c.id}" aria-label="${esc(t('cat.name'))}"><a class="c" href="#/category/${c.id}">${esc(tn('cat.count', cnt(c.id)))}</a>
      <button class="icon-btn" data-act="catDel" data-id="${c.id}" aria-label="${esc(t('common.delete'))}">${icon('trash-2')}</button></div>`).join('') : `<div class="ag-empty" style="color:var(--text-2)">${esc(t('cat.empty'))}</div>`}</div>
    <a class="nav-item" href="#/uncategorized" style="background:var(--surface)">${icon('inbox')}<span>${esc(t('nav.uncategorized'))}</span><span class="cnt">${fmtNum(live().filter(e => !e.category_id).length)}</span></a></div>`;
}
function viewTags() {
  const tags = allTags();
  return `<div class="wrap view-enter" style="max-width:900px">${header(esc(t('nav.tags')) + ` <span class="mut">${fmtNum(tags.length)}</span>`, esc(t('tags.sub')))}
    ${tags.length ? `<div class="tag-cloud">${tags.map(([g, n]) => `<span class="tag-pill" data-act="tagOpen" data-tag="${esc(g)}">#${esc(g)}<span class="c">${fmtNum(n)}</span><button class="icon-btn" style="width:28px;height:28px" data-act="tagMenu" data-tag="${esc(g)}" aria-label="${esc(t('common.more'))}">${icon('more-horizontal')}</button></span>`).join('')}</div>` : emptyState(t('tags.emptyTitle'), t('tags.emptySub'))}</div>`;
}

/* ---------- Trash ---------- */
function viewTrash() {
  const list = [...S.entries.values()].filter(e => e.deleted_at).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
  return `<div class="wrap view-enter">${header(esc(t('nav.trash')) + ` <span class="mut">${fmtNum(list.length)}</span>`, esc(t('trash.sub')),
    `<div class="ph-actions">${list.length ? `<button class="btn sm ${S.selecting ? 'primary' : ''}" data-act="select">${icon('check-check')}${esc(t('bulk.select'))}</button><button class="btn sm danger" data-act="emptyTrash">${icon('trash-2')}${esc(t('trash.empty'))}</button>` : ''}</div>`)}
    ${entryList(list, { trash: true, empty: emptyState(t('trash.emptyTitle'), t('trash.emptySub')) })}</div>`;
}

export { allTags, viewCategories, viewTags, viewTrash };
