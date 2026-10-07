/* Kept — View state and hash router */
import { todayKey } from '../lib/utils.js';
import { render } from './shell.js';

/* =====================================================================
   UI — shell, router, views
   ===================================================================== */
const V = { listLimit: 60, weekAnchor: null, selDay: todayKey(), cal: { mode: 'month', anchor: new Date(), sel: todayKey() }, taskFilter: 'open', capType: 'note',
  search: { q: '', scope: 'all', type: '', cat: '', tag: '', from: '', to: '' }, itemQ: '', contactQ: '' };
const route = () => { const h = (location.hash.replace(/^#\/?/, '') || 'today').split('#')[0] || 'today'; const [p, ...rest] = h.split('/'); return { name: p.split('?')[0], arg: rest.length ? decodeURIComponent(rest.join('/')) : null }; };
const go = h => { if (location.hash !== '#/' + h) location.hash = '#/' + h; else render(); };

export { V, go, route };
