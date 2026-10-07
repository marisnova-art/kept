/* Kept — Tasks */
import { entryDisplayTitle, live } from '../data/store.js';
import { fmtNum, t } from '../lib/i18n.js';
import { esc, icon, todayKey } from '../lib/utils.js';
import { emptyState, header, metaBadge, swipeWrap } from '../ui/entries.js';
import { V } from '../ui/router.js';

/* ---------- Tasks ---------- */
function taskRow(e) {
  const m = e.meta;
  return `<div class="task ${m.done ? 'done' : ''}" data-act="open" data-id="${e.id}" tabindex="0">
    <button class="chk ${m.done ? 'on' : ''}" data-act="toggleDone" data-id="${e.id}" aria-label="${esc(t('task.toggle'))}" aria-pressed="${!!m.done}">${icon('check')}</button>
    <span class="tt">${esc(entryDisplayTitle(e))}</span>
    ${m.priority ? `<span class="prio p${m.priority}">P${m.priority}</span>` : ''}${metaBadge(e)}
    <button class="star-btn ${m.important ? 'on' : ''}" data-act="star" data-id="${e.id}" aria-label="${esc(t('f.important'))}">${icon('star')}</button></div>`;
}
const taskRowS = e => swipeWrap(e, taskRow(e), 'task');
function viewTasks() {
  const all = live().filter(e => e.type === 'todo'); const k = todayKey();
  const sorter = (a, b) => (b.meta.important ? 1 : 0) - (a.meta.important ? 1 : 0) || (a.meta.priority || 9) - (b.meta.priority || 9) || (a.meta.due || '9999').localeCompare(b.meta.due || '9999') || b.created_at.localeCompare(a.created_at);
  const open = all.filter(e => !e.meta.done), done = all.filter(e => e.meta.done).sort((a, b) => (b.meta.done_at || '').localeCompare(a.meta.done_at || ''));
  const grp = (title, list, cls = '') => list.length ? `<div class="tgroup"><h4 class="${cls}">${esc(title)} <span class="c">${fmtNum(list.length)}</span></h4>${list.sort(sorter).map(taskRowS).join('')}</div>` : '';
  let body = '';
  if (V.taskFilter !== 'done') {
    body += grp(t('task.overdue'), open.filter(e => e.meta.due && e.meta.due < k), 'over') + grp(t('date.today'), open.filter(e => e.meta.due === k)) +
      grp(t('task.upcoming'), open.filter(e => e.meta.due && e.meta.due > k)) + grp(t('task.noDate'), open.filter(e => !e.meta.due));
  }
  if (V.taskFilter !== 'open') body += `<div class="tgroup"><h4>${esc(t('task.completed'))} <span class="c">${fmtNum(done.length)}</span></h4>${done.slice(0, 200).map(taskRowS).join('')}</div>`;
  const empty = V.taskFilter === 'open' && !open.length;
  return `<div class="wrap view-enter" style="max-width:860px">${header(esc(t('nav.tasks')) + ` <span class="mut">${fmtNum(open.length)}</span>`, '', `<div class="seg">${['open', 'done', 'all'].map(f => `<button class="${V.taskFilter === f ? 'on' : ''}" data-act="taskFilter" data-v="${f}">${esc(t('task.f.' + f))}</button>`).join('')}</div>`)}
    <form class="quick-add" id="taskAdd" autocomplete="off">${icon('plus')}<input type="text" id="taskTitle" maxlength="300" placeholder="${esc(t('task.addPh'))}" aria-label="${esc(t('task.addPh'))}">
      <label class="qa-date" id="taskDueBox">${icon('calendar')}<span id="taskDueLbl">${esc(t('f.due'))}</span><input type="date" id="taskDue" aria-label="${esc(t('f.due'))}"></label><select class="select" id="taskPrio" aria-label="${esc(t('f.priority'))}" style="height:36px">${[0, 1, 2, 3].map(p => `<option value="${p}">${esc(t('prio.' + p))}</option>`).join('')}</select>
      <button class="btn primary sm" type="submit">${esc(t('common.add'))}</button></form>
    ${empty ? emptyState(t('task.emptyTitle'), t('task.emptySub')) : body}</div>`;
}

export { viewTasks };
