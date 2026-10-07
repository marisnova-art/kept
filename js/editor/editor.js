/* Kept — Rich text editor */
import { S, catOf, emit, entryDisplayTitle, isEmptyEntry, live, newEntry, onChange, purgeEntries, restoreEntries, saveEntry, trashEntries, typeList, typeOf } from '../data/store.js';
import { Sync } from '../data/sync.js';
import { Rich, ZWRE, isBlockEl } from './rich.js';
import { Aurora, AuroraFX } from '../features/aurora.js';
import { Data } from '../features/data-io.js';
import { Prompts } from '../features/prompts.js';
import { Share } from '../features/share.js';
import { LIMITS } from '../lib/config.js';
import { LANG, applyI18n, fmtDate, fmtNum, fmtRel, fmtTime, t } from '../lib/i18n.js';
import { SAFE, htmlToMarkdown, htmlToText, hydrateIcons, sanitizeHTML } from '../lib/sanitize.js';
import { $, $$, addDays, clamp, dayKey, debounce, esc, icon, ls, nowISO, parseDay, startOfWeek, todayKey } from '../lib/utils.js';
import { fmtDue } from '../ui/entries.js';
import { burst, confirmDlg, download, menu, toast } from '../ui/feedback.js';
import { V } from '../ui/router.js';
import { UI } from '../ui/shell.js';
import { newFolder } from '../views/folders.js';
import { REPEATS, repeatLabel } from '../views/today.js';
import { land, pop, reduced, saveTarget } from '../ui/motion.js';
import { SPACINGS, entrySpacing } from './spacing.js';
import { TEMPLATES, templateHTML } from './templates.js';

/* =====================================================================
   EDITOR — rich text with word-level styling, inline icons, autosave.
   Mobile-first: a fixed two-row toolbar sits right above the keyboard,
   option panels open inline (no floating menus), the sheet follows the
   visual viewport so nothing covers the line being typed.
   ===================================================================== */
const TEXT_COLORS = ['gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'];
const HL_COLORS = ['yellow', 'orange', 'green', 'blue', 'pink', 'violet'];
SAFE.cls = /^(c-(default|gray|red|orange|amber|green|teal|blue|violet|pink)|hl-(yellow|orange|green|blue|pink|violet|none)|bg-(yellow|orange|green|blue|pink|violet)|fs-(s|m|l|xl)|ico)$/;
const isTouch = () => matchMedia('(pointer: coarse)').matches;
const isNarrow = () => matchMedia('(max-width: 900px)').matches;
const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
const ICON_SETS = {
  essentials: ['calendar', 'check-square', 'lightbulb', 'alert-triangle', 'star', 'heart', 'flag', 'pin', 'bookmark', 'circle-check', 'circle-alert', 'circle-help', 'info', 'zap', 'sparkles', 'flame', 'target', 'trophy', 'rocket', 'crown', 'gem', 'thumbs-up', 'thumbs-down', 'ban', 'lock', 'key', 'link', 'quote', 'hash', 'tag'],
  time: ['clock', 'alarm-clock', 'hourglass', 'timer', 'calendar-days', 'repeat', 'sunrise', 'sun-medium', 'moon-star', 'coffee', 'bell'],
  people: ['user', 'users', 'baby', 'dog', 'message-circle', 'mail', 'phone', 'contact', 'gift', 'cake', 'hand-heart', 'smile-plus'],
  places: ['home', 'map-pin', 'map', 'compass', 'building-2', 'store', 'school', 'hospital', 'church', 'landmark', 'mountain', 'waves', 'plane', 'train-front', 'bus', 'car', 'bike', 'ticket'],
  things: ['box', 'package', 'archive', 'key-round', 'sofa', 'bed', 'lamp', 'shirt', 'scissors', 'wrench', 'hammer', 'laptop', 'tv', 'smartphone', 'battery-charging', 'headphones', 'camera', 'gamepad-2', 'umbrella'],
  life: ['briefcase', 'graduation-cap', 'book-open', 'notebook-pen', 'pen-tool', 'palette', 'music', 'dumbbell', 'pill', 'stethoscope', 'utensils', 'shopping-cart', 'wallet', 'credit-card', 'receipt', 'piggy-bank', 'banknote', 'chart-line', 'leaf', 'brain', 'feather', 'cloud-rain', 'snowflake', 'thermometer']
};
const EMOJI_SETS = {
  smileys: '😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 🤗 🤭 🤔 🤨 😐 😑 😶 🙄 😏 😬 😌 😴 😷 🤒 🥵 🥶 😵 🤯 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😲 😳 🥺 😢 😭 😤 😡 🤬 💀 👻 🤖 💩',
  gestures: '👍 👎 👏 🙌 🙏 🤝 💪 ✌️ 🤞 🤟 👌 👉 👆 👇 ✋ 👋 ✍️ 💅 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💯 ✨ ⭐ 🌟 🔥 💥 💡 💭 💬',
  objects: '📌 📍 📎 🔑 🗝️ 🔒 📦 🗂️ 📁 📅 🗓️ ⏰ ⌛ 📝 ✏️ 📚 📖 🔖 💼 💰 💳 🧾 🛒 🎁 🎈 🎉 📱 💻 ⌚ 📷 🎧 🎮 🔋 🔌 💊 🩺 🧴 🧸 🪴 🛋️ 🛏️ 🚪 🪑 🧳 👓 👟 👕 🧥',
  nature: '☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ 🌈 🌊 🌙 🌸 🌻 🌿 🍀 🍁 🌲 🌵 🐶 🐱 🐻 🐼 🦊 🐰 🐥 🐟 🦋 🐝',
  food: '☕ 🍵 🧃 🍺 🍷 🍎 🍋 🍓 🍇 🍉 🥑 🥕 🍞 🧀 🍳 🍔 🍕 🍜 🍣 🍱 🍰 🍪 🍫 🍦',
  travel: '🏠 🏢 🏫 🏥 🏖️ ⛰️ 🗺️ 🧭 ✈️ 🚆 🚌 🚗 🚲 🛵 ⛽ 🚀 🎫 🏁',
  symbols: '✅ ☑️ ✔️ ❌ ❎ ⚠️ ❗ ❓ ‼️ ⭕ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🔺 🔻 ➡️ ⬅️ ⬆️ ⬇️ 🔁 🔄 ➕ ➖ 🆕 🆗 🔝 💲 #️⃣ ©️'
};
const EMOJI_KW = { '✅': 'check done 완료 체크', '❌': 'no x cancel 취소', '⚠️': 'warning caution 주의 경고', '💡': 'idea light 아이디어 전구', '📅': 'calendar date 일정 달력', '📌': 'pin 핀 고정', '🔑': 'key 열쇠', '❤️': 'heart love 하트 사랑', '🔥': 'fire hot 불', '⭐': 'star 별', '🎉': 'party 축하', '📦': 'box package 상자 택배', '📍': 'location place 위치 장소', '⏰': 'alarm clock 알람 시계', '📝': 'note memo 메모', '💊': 'pill medicine 약', '🛒': 'shopping cart 쇼핑 장보기', '💰': 'money 돈', '🏠': 'home house 집', '😀': 'smile happy 웃음', '😢': 'sad cry 슬픔', '👍': 'thumbs up good 좋아요', '🙏': 'thanks please 감사', '☕': 'coffee 커피', '🎁': 'gift present 선물', '📚': 'books study 책 공부', '💼': 'work business 업무 일', '✈️': 'travel plane 여행 비행기', '🚗': 'car 자동차', '🍎': 'apple fruit 사과', '❓': 'question 질문', '❗': 'important 중요' };
const ICON_KW = { 'calendar': '일정 달력 date', 'check-square': '완료 체크 todo done', 'lightbulb': '아이디어 전구 idea', 'alert-triangle': '경고 주의 warning', 'star': '별 중요', 'heart': '하트 사랑', 'map-pin': '위치 장소 location', 'key': '열쇠', 'key-round': '열쇠', 'home': '집', 'phone': '전화', 'mail': '메일 이메일', 'clock': '시간 시계', 'bell': '알림', 'box': '상자 물건', 'package': '택배 상자', 'gift': '선물', 'pill': '약', 'wallet': '지갑 돈', 'book-open': '책', 'car': '자동차', 'plane': '비행기 여행', 'flag': '깃발', 'pin': '핀 고정', 'lock': '잠금 비밀', 'users': '사람들', 'user': '사람', 'cake': '생일 케이크', 'music': '음악', 'shopping-cart': '쇼핑 장보기', 'briefcase': '업무 회사', 'target': '목표', 'trophy': '성취', 'brain': '생각', 'sparkles': '반짝' };

const Editor = {
  e: null, isNew: false, dirty: false, touched: false, hist: [], hidx: -1, savedRange: null, pending: null, panel: null,
  last: Object.assign({ color: 'red', hl: 'hl-yellow', size: 'l' }, ls.get('kept.last', {})),
  el: {},
  init() {
    const root = $('#editor');
    const tb = (attr, ic, title, extra = '') => `<button class="tb ${extra}" ${attr} data-i18n-title="${title}">${icon(ic)}</button>`;
    root.innerHTML = `
      <div class="scrim show" data-ed="close"></div>
      <section class="ed-panel" role="dialog" aria-modal="true" aria-label="${esc(t('ed.label'))}">
        <div class="ed-grab" aria-hidden="true"><span></span></div>
        <div class="ed-top">
          <button class="btn sm ed-cancel" data-ed="cancel"><span data-i18n="common.cancel"></span></button>
          <button class="ed-status" id="edStatus" data-s="saved" data-ed="retry"><span class="led"></span><span class="txt"></span></button>
          <span class="tb-spacer"></span>
          <button class="ed-optbtn" data-ed="drawer" id="edOptBtn" aria-expanded="false" aria-controls="edDrawer"><span class="ob-ic" id="edOptIc"></span><span class="ob-t" id="edOptSum"></span>${icon('sliders-horizontal', 'ob-sl')}</button>
          <button class="btn sm primary ed-done" data-ed="close"><span class="lbl"></span></button>
        </div>
        <div class="ed-drawer" id="edDrawer" aria-hidden="true">
          <div class="ed-drawer-in"><div class="ed-drawer-pad">
            <div class="ed-dsec"><span class="ed-dl" data-i18n="ed.typeH"></span><div class="ed-typesel" id="edTypeSel" role="radiogroup"></div></div>
            <div class="ed-dsec ed-dsec-props"><span class="ed-dl" data-i18n="ed.detailsH"></span><span class="props" id="edFields"></span></div>
            <div class="ed-dsec"><span class="ed-dl" data-i18n="ed.organizeH"></span>
              <div class="ed-meta">
                <button class="mchip" data-ed="type" id="edType" hidden></button>
                <button class="mchip" data-ed="cat" id="edCat"></button>
                <button class="mchip share" data-ed="share" id="edShare" hidden></button>
                <span class="tag-edit" id="edTags"></span>
                <input class="tag-input" id="edTagIn" list="tagSuggest" maxlength="40" enterkeyhint="done" autocapitalize="off" data-i18n-ph="ed.addTag">
                <datalist id="tagSuggest"></datalist>
              </div>
            </div>
            <div class="ed-drow">
              <button class="mchip" data-ed="pin" id="edPin">${icon('pin')}<span data-i18n="ed.pin"></span></button>
              <button class="mchip heart" data-ed="fav" id="edFav">${icon('heart')}<span data-i18n="ed.favorite"></span></button>
              <span class="ed-dates" id="edDates"></span>
              <span class="tb-spacer"></span>
              <button class="mchip" data-ed="more">${icon('more-horizontal')}<span data-i18n="common.more"></span></button>
              <button class="mchip ed-dclose" data-ed="drawer">${icon('chevron-up')}<span data-i18n="ed.keepWriting"></span></button>
            </div>
            <div class="ed-dslot" id="edDSlot"></div>
          </div></div>
        </div>
        <div class="ed-scroll" id="edScroll">
          <div class="ed-inner">
            <div id="edTrash" class="note warn" hidden style="margin:6px 0 10px"></div>
            <div class="ed-prompt" id="edPrompt" aria-hidden="true"></div>
            <div class="ed-titlebox"><textarea class="ed-title" id="edTitle" rows="1" maxlength="300" enterkeyhint="next"></textarea></div>
            <div class="prose" id="edBody" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" enterkeyhint="enter"></div>
          </div>
        </div>
        <div class="ed-opt" id="edOpt" hidden></div>
        <div class="ed-saved" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
        <div class="ed-tools collapsed" id="edTools" role="toolbar" aria-label="${esc(t('fmt.toolbar'))}">
          ${tb('data-cmd="undo"', 'undo-2', 'fmt.undo')}${tb('data-cmd="redo"', 'redo-2', 'fmt.redo')}
          <span class="tb-sep"></span>
          <button class="tb tb-pill tb-fmt" data-cmd="fmt" aria-expanded="false" aria-controls="edToolsX" data-i18n-title="fmt.tools"><span class="fg" aria-hidden="true">Aa</span><span class="fl" data-i18n="fmt.tools"></span>${icon('chevron-up', 'fc')}</button><button class="tb tb-pill tb-tpl" data-panel="tpl" data-i18n-title="tpl.title"><span class="fg" aria-hidden="true">${icon('layout-template')}</span><span class="fl" data-i18n="tpl.short"></span></button>
          <span class="tb-x" id="edToolsX">
            <span class="tb-sep"></span>
            ${tb('data-mark="b"', 'bold', 'fmt.bold')}${tb('data-mark="i"', 'italic', 'fmt.italic')}${tb('data-mark="u"', 'underline', 'fmt.underline')}${tb('data-mark="s"', 'strikethrough', 'fmt.strike')}
            <span class="tb-sep"></span>
            ${tb('data-panel="color"', 'baseline', 'fmt.color', 'tb-color')}${tb('data-panel="hl"', 'highlighter', 'fmt.highlight', 'tb-color tb-hl')}${tb('data-panel="size"', 'type', 'fmt.size')}
            <span class="tb-sep"></span>
            ${tb('data-panel="icon"', 'shapes', 'fmt.icon')}${tb('data-panel="emoji"', 'smile', 'fmt.emoji')}
            <span class="tb-sep"></span>
            ${tb('data-cmd="ul"', 'list', 'fmt.bullets')}${tb('data-cmd="ol"', 'list-ordered', 'fmt.numbers')}${tb('data-cmd="quote"', 'text-quote', 'fmt.quote')}${tb('data-cmd="h2"', 'hash', 'fmt.heading')}${tb('data-panel="spacing"', 'pilcrow', 'fmt.spacing')}
            <span class="tb-sep"></span>
            ${tb('data-cmd="clear"', 'eraser', 'fmt.clear')}
          </span>
          <span class="tb-fill"></span>
          ${tb('data-cmd="kbd"', 'chevron-down', 'fmt.hideKeyboard', 'tb-kbd')}
        </div>
      </section>`;
    const bubble = document.createElement('div'); bubble.id = 'bubble'; bubble.setAttribute('role', 'toolbar');
    bubble.className = 'mini';
    bubble.innerHTML = `<button class="bb-open" data-bb="open" aria-expanded="false" aria-label="${esc(t('fmt.tools'))}"><span class="fg" aria-hidden="true">Aa</span>${icon('chevron-right', 'fc')}</button><span class="bb-full"><button data-mark="b">${icon('bold')}</button><button data-mark="u">${icon('underline')}</button><button data-mark="s">${icon('strikethrough')}</button><span class="sep"></span>` +
      ['red', 'orange', 'green', 'blue', 'violet'].map(c => `<button data-color="${c}" aria-label="${esc(t('color.' + c))}"><span class="dotc" style="--dc:var(--c-${c})"></span></button>`).join('') +
      `<span class="sep"></span><button data-hl="hl-yellow">${icon('highlighter')}</button><button data-cmd="clear">${icon('eraser')}</button></span>`;
    $('#bubble')?.remove(); document.body.appendChild(bubble);
    this.el = { root, panelEl: root.querySelector('.ed-panel'), title: $('#edTitle'), body: $('#edBody'), status: $('#edStatus'), type: $('#edType'), cat: $('#edCat'), share: $('#edShare'), tags: $('#edTags'), tagIn: $('#edTagIn'),
      fields: $('#edFields'), fav: $('#edFav'), pin: $('#edPin'), scroll: $('#edScroll'), bubble, trash: $('#edTrash'), dates: $('#edDates'), opt: $('#edOpt'), tools: $('#edTools'),
      drawer: $('#edDrawer'), optBtn: $('#edOptBtn'), optSum: $('#edOptSum'), optIc: $('#edOptIc'), dslot: $('#edDSlot') };
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
    this.paintLast();
    if (!this.bound) { this.bind(); this.bound = true; } else this.bindEls();
  },
  bind() {
    document.addEventListener('selectionchange', () => this.onSel());
    window.visualViewport?.addEventListener('resize', () => this.fitViewport());
    window.visualViewport?.addEventListener('scroll', () => this.fitViewport());
    addEventListener('popstate', ev => { if (this.e && !(ev.state && ev.state.editor)) this.close(true); });
    onChange(w => { if (w === 'sync') this.syncStatus(); if (w === 'categories' && this.e) this.renderMeta(); });
    this.bindEls();
  },
  bindEls() {
    const { root, title, body, tagIn, bubble, tools, opt } = this.el;
    if (!root._edBound) root.addEventListener('click', e => { // #editor survives re-init (language change): bind its click once
      const b = e.target.closest('[data-ed]'); if (!b) return; const a = b.dataset.ed;
      ({ drawer: () => this.toggleDrawer(), close: () => this.close(), cancel: () => this.cancel(), fav: () => this.toggle('favorite', b), pin: () => this.toggle('pinned', b), more: () => this.moreMenu(b), type: () => this.typeMenu(b), cat: () => this.catMenu(b), share: () => this.shareMenu(b),
         retry: () => { if (S.sync === 'error' || S.sync === 'offline') Sync.run(); } }[a])?.();
    });
    root._edBound = true;
    // keep the caret (and the on-screen keyboard) while tapping tools
    const keep = e => { if (e.target.closest('button') && !e.target.closest('input')) { e.preventDefault(); this.saveSel(); } };
    [tools, bubble, opt].forEach(n => { n.addEventListener('mousedown', keep); n.addEventListener('click', e => this.toolClick(e)); });
    title.addEventListener('input', () => { this.autosize(); this.changed(); });
    title.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.focusBody(false, true); } });
    title.addEventListener('focus', () => { this.closePanel(); this.el.root.classList.add('typing-title'); });
    title.addEventListener('blur', () => this.el.root.classList.remove('typing-title'));
    body.addEventListener('input', e => { if (!e.isComposing) this.afterTyping(e); this.changed(); this.histLater(); this.ensureCaret(); });
    body.addEventListener('compositionend', () => { this.afterTyping({}); this.changed(); });
    body.addEventListener('beforeinput', e => {
      const map = { formatBold: 'b', formatItalic: 'i', formatUnderline: 'u', formatStrikeThrough: 's' };
      if (map[e.inputType]) { e.preventDefault(); this.mark(map[e.inputType]); }
      else if (e.inputType === 'historyUndo') { e.preventDefault(); this.undo(); }
      else if (e.inputType === 'historyRedo') { e.preventDefault(); this.redo(); }
    });
    body.addEventListener('keydown', e => this.keys(e));
    body.addEventListener('paste', e => this.paste(e));
    body.addEventListener('focus', () => { this.ensureBlock(); root.classList.add('typing'); if (this.drawerOpen) this.toggleDrawer(false, true); if (this.panel && (this.panelMode === 'kb' || this.panel.startsWith('prop:'))) { this.closePanel(); this.updateToolState(); } });
    body.addEventListener('blur', () => { if (this.panelMode !== 'kb') this.saveSel(true); root.classList.remove('typing'); });
    body.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) { e.preventDefault(); toast(t('ed.noImages')); } });
    this.el.scroll.addEventListener('scroll', () => this.hideBubble(), { passive: true });
    this.el.scroll.addEventListener('mousedown', e => { if (e.target === this.el.scroll || e.target.classList?.contains('ed-inner')) { e.preventDefault(); if (this.ready()) { this.closePanel(); this.focusBody(true); this.ensureCaret(); } } });
    tagIn.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && tagIn.value.trim() && !e.isComposing) { e.preventDefault(); this.addTag(tagIn.value); tagIn.value = ''; }
      else if (e.key === 'Backspace' && !tagIn.value && this.e.tags.length) { this.e.tags.pop(); this.renderTags(); this.changed(); }
    });
    tagIn.addEventListener('change', () => { if (tagIn.value.trim()) { this.addTag(tagIn.value); tagIn.value = ''; } });
    tagIn.addEventListener('focus', () => this.closePanel());
    this.el.tags.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { this.e.tags.splice(+b.dataset.rm, 1); this.renderTags(); this.changed(); } });
    this.el.fields.addEventListener('click', e => {
      const b = e.target.closest('[data-prop],[data-tf]'); if (!b || !this.ready()) return;
      if (b.dataset.prop) { if (!this.drawerOpen) this.toggleDrawer(true); return this.togglePanel('prop:' + b.dataset.prop); }
      const k = b.dataset.tf; this.e.meta[k] = !this.e.meta[k];
      if (k === 'done') { this.e.meta.done_at = this.e.meta.done ? nowISO() : null; }
      if (this.e.meta[k]) { burst(b); haptic(12); }
      this.renderFields(); this.changed();
    });
    opt.addEventListener('input', e => this.propInput(e)); opt.addEventListener('change', e => this.propInput(e));
    opt.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input[data-k]') && !e.isComposing) { e.preventDefault(); this.closePanel(); this.renderFields(); } });
    $('#edTypeSel').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; e.preventDefault(); this.setType(b.dataset.t); haptic(5); });
    $('#edTypeSel').addEventListener('mousedown', e => e.preventDefault());
    this.bindDrag();
  },

  /* ---------- open / close ---------- */
  open(id, preset = {}, opts = {}) {
    if (this.e) this.commit.flush?.();
    this.skin = 'capture'; // one writing surface everywhere: the aurora composer
    this.drawerOpen = false;
    const ex = id && S.entries.get(id);
    this.isNew = !ex; this.touched = false;
    this.e = ex || newEntry(preset);
    this.snapshot = ex ? JSON.parse(JSON.stringify({ title: ex.title, content: ex.content, text: ex.text, type: ex.type, category_id: ex.category_id, folder_id: ex.folder_id || null, tags: ex.tags, favorite: ex.favorite, pinned: ex.pinned, meta: ex.meta })) : null;
    this._cancelled = false;
    this.dirty = false; this.pending = null; this.savedRange = null;
    const { root, title, body } = this.el;
    root.classList.remove('closing', 'saved', 'has-text', 'drawer-open'); this.el.drawer.setAttribute('aria-hidden', 'true'); this.el.drawer.inert = true; this.el.optBtn.setAttribute('aria-expanded', 'false'); root.classList.add('open'); this.el.panelEl.style.transform = '';
    root.classList.toggle('skin-capture', this.skin === 'capture'); this.el.panelEl.classList.toggle('aurora', this.skin === 'capture'); Aurora.apply(this.el.panelEl, Aurora.make(Aurora.card)); // each composer: a new light
    document.documentElement.classList.add('editor-open');
    this.fitViewport();
    applyI18n(root);
    title.value = this.e.title;
    body.innerHTML = sanitizeHTML(this.e.content) || '<p><br></p>'; hydrateIcons(body); Rich.normalizeTop(body);
    body.dataset.ph = t('ed.bodyPh');
    body.className = 'prose sp-' + entrySpacing(this.e, S.prefs);
    // read only: in the trash, or someone else's record in a folder where I can only view
    const ro = !!this.e.deleted_at || !Share.canEdit(this.e); this.ro = ro; body.contentEditable = String(!ro); title.readOnly = ro;
    root.classList.toggle('readonly', ro);
    this.el.trash.hidden = !ro;
    if (ro && !this.e.deleted_at) this.el.trash.innerHTML = `${icon('eye')}<span style="flex:1">${esc(t('share.readonly'))}${Share.authorOf(this.e) ? ' · ' + esc(t('share.by', { who: Share.authorOf(this.e) })) : ''}</span>`;
    else if (ro) this.el.trash.innerHTML = `${icon('trash-2')}<span style="flex:1">${esc(t('ed.inTrash'))}</span><button class="btn sm" data-act="restoreOne" data-id="${this.e.id}">${esc(t('trash.restore'))}</button>`;
    this.closePanel(); this.toggleTools(false); this.renderMeta(); this.renderFields(); this.renderSkin(); this.autosize();
    this.hist = [this.snap()]; this.hidx = 0;
    this.setStatus(this.isNew ? 'new' : (this.e._dirty && S.mode === 'cloud' ? (navigator.onLine ? 'saving' : 'offline') : (S.mode === 'cloud' ? 'synced' : 'saved')));
    if (!history.state?.editor) history.pushState({ editor: true }, '');
    this.el.scroll.scrollTop = 0;
    if (preset.__q && CSS.highlights) this.highlight(preset.__q); else CSS.highlights?.delete('search');
    // focus synchronously, inside the tap, so iOS raises the keyboard
    if (!ro && this.isNew) { if (['item', 'contact', 'todo', 'event'].includes(this.e.type)) title.focus({ preventScroll: true }); else this.focusBody(true); }
    else if (!ro && opts.focus) this.focusBody(true);
    this.updateToolState(); this.markEmpty();
  },
  /* cancel = leave without keeping anything typed in this session */
  async cancel() {
    if (!this.e) return;
    const had = this.touched;
    if (this.touched && !(await confirmDlg(t('ed.cancelTitle'), this.isNew ? t('ed.cancelNew') : t('ed.cancelEdit'), t('ed.discard'), true))) return;
    this.commit.cancel?.(); this.histLater.cancel?.(); this.dirty = false;
    const e = this.e;
    if (this.isNew) { if (S.entries.has(e.id)) await purgeEntries([e.id]); }
    else if (this.snapshot && this.touched) { Object.assign(e, JSON.parse(JSON.stringify(this.snapshot))); await saveEntry(e); }
    this._cancelled = true; this.touched = false;
    if (had) this.el.root.classList.add('discarding'); // the sheet falls away instead of a "discarded" toast
    this.close();
  },
  markEmpty() { const b = this.el.body; b.classList.toggle('is-empty', !b.textContent.replace(ZWRE, '').trim() && !b.querySelector('.ico,li')); },
  renderSkin() {
    const e = this.e;
    $('.ed-done .lbl', this.el.root).textContent = this.isNew ? t('common.save') : t('common.done');
    const pr = $('#edPrompt'); pr.innerHTML = this.isNew && !e.deleted_at ? `${icon('message-circle')}<span>${esc(Prompts.current())}</span>` : '';
    $('#edTypeSel').innerHTML = typeList().map(ty => `<button data-t="${ty.id}" role="radio" aria-checked="${ty.id === e.type}" class="${ty.id === e.type ? 'on' : ''}">${icon(ty.icon)}<span>${esc(ty.label)}</span></button>`).join('');
    const structured = ['todo', 'event', 'item', 'contact'].includes(e.type);
    this.el.root.classList.remove('no-title');
    this.el.root.classList.toggle('no-props', !this.propDefs(e.type).length);
    this.el.body.dataset.ph = !structured && this.isNew && ['note', 'idea', 'todo', 'event', 'item', 'contact'].includes(e.type) ? t('cap.ph.' + e.type) : t('ed.bodyPh');
    if (structured && this.isNew && document.activeElement === this.el.body && !this.el.body.textContent.trim()) this.el.title.focus({ preventScroll: true });
    this.renderSummary();
  },
  /* the options live in a drawer under the header: closed while you write, one tap away when you need them */
  toggleDrawer(force, fromTyping) {
    if (!this.e) return;
    const open = force ?? !this.drawerOpen; if (open === this.drawerOpen) return;
    this.drawerOpen = open;
    const { root, drawer, optBtn } = this.el;
    root.classList.toggle('drawer-open', open); drawer.setAttribute('aria-hidden', String(!open)); drawer.inert = !open; optBtn.setAttribute('aria-expanded', String(open));
    optBtn.title = t(open ? 'ed.optionsHide' : 'ed.options');
    haptic(5);
    if (open) {
      this.saveSel(); this.hideBubble();
      if (this.panel && !this.panel.startsWith('prop:')) this.closePanel();
      if (isTouch() && document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    } else {
      if (this.panel && this.panel.startsWith('prop:')) this.closePanel();
      this.renderFields();
      if (!fromTyping && this.ready()) { this.focusKeep(); this.ensureCaret(); }
    }
  },
  renderSummary() {
    const e = this.e; if (!e || !this.el.optSum) return;
    const ty = typeOf(e.type); const bits = [ty.label];
    const m = e.meta || {};
    if (e.type === 'event') { if (m.date) bits.push(fmtDate(parseDay(m.date), { month: 'short', day: 'numeric' }) + (m.time ? ' ' + fmtTime(m.time) : '')); if (m.repeat) bits.push(t('repeat.' + m.repeat)); }
    else if (e.type === 'todo') { if (m.due) bits.push(fmtDue(m.due, m.due_time)); }
    else if (e.type === 'item' && m.location) bits.push(m.location);
    const c = catOf(e.category_id); if (c) bits.push(c.name);
    const sf = Share.folder(e.folder_id); if (sf) bits.push(t('share.toFolder', { name: sf.name }));
    if (e.tags.length) bits.push('#' + e.tags[0] + (e.tags.length > 1 ? ' +' + (e.tags.length - 1) : ''));
    this.el.optIc.innerHTML = icon(ty.icon);
    this.el.optSum.textContent = bits.join(' · ');
    this.el.optBtn.classList.toggle('pinned', !!e.pinned); this.el.optBtn.classList.toggle('faved', !!e.favorite);
  },
  close(fromPop = false) {
    if (!this.e) return;
    if (this.skin === 'capture' && !this._savedAnim && !this._cancelled && this.touched && !isEmptyEntry({ ...this.e, title: this.el.title.value, text: this.el.body.textContent.replace(ZWRE, '') })) {
      this._savedAnim = true; document.activeElement?.blur?.(); this.commit.flush(); this.el.root.classList.add('saved'); haptic(15);
      setTimeout(() => { this.close(fromPop); this._savedAnim = false; }, 620); return;
    }
    document.activeElement?.blur?.();
    this.dropPending(); this.commit.flush();
    const e = this.e; const wasTouched = this.touched;
    if (isEmptyEntry(e) && S.entries.has(e.id) && this.isNew && !e.deleted_at) purgeEntries([e.id]);
    this.e = null; this.hideBubble(); this.closePanel(); CSS.highlights?.delete('search');
    const root = this.el.root; root.classList.add('closing');
    document.documentElement.classList.remove('editor-open', 'kb-open');
    setTimeout(() => { root.classList.remove('open', 'closing', 'typing', 'discarding'); this.el.panelEl.style.transform = ''; AuroraFX.kick(); }, 260);
    if (!fromPop && history.state?.editor) history.back();
    if (wasTouched && !this._cancelled && S.entries.has(e.id) && !isEmptyEntry(e)) {
      // saved: a small chip carries the record to where it now lives (its card, or Records), no toast
      UI.flash(e.id); const ty = typeOf(e.type);
      setTimeout(() => land(`${icon('check', 'mo-ck')}<span>${esc(t('mo.saved', { type: ty.label }))}</span>`, null, saveTarget(e.id)), 300);
    }
    root.classList.remove('saved'); this.skin = null;
    emit('entries');
  },
  onExternalChange(id) {
    if (!this.e || this.e.id !== id || this.dirty) return;
    const fresh = S.entries.get(id); if (!fresh || fresh === this.e) return;
    const sel = this.getSelOffsets(); this.e = fresh;
    this.el.title.value = fresh.title; this.el.body.innerHTML = sanitizeHTML(fresh.content) || '<p><br></p>'; hydrateIcons(this.el.body);
    this.renderMeta(); this.renderFields(); if (sel) this.setSelOffsets(sel);
  },
  fitViewport() {
    const vv = window.visualViewport; const r = this.el.root; if (!vv || !r) return;
    r.style.setProperty('--vvh', vv.height + 'px'); r.style.setProperty('--vvt', vv.offsetTop + 'px');
    document.documentElement.style.setProperty('--vvh', vv.height + 'px'); document.documentElement.style.setProperty('--vvt', vv.offsetTop + 'px');
    if (this.e && (window.scrollY || document.scrollingElement?.scrollTop)) window.scrollTo(0, 0);
    const kb = innerHeight - vv.height > 140; document.documentElement.classList.toggle('kb-open', kb);
    if (kb) this.kbH = innerHeight - vv.height;
    if (this.e) this.ensureCaret();
  },
  /* ---------- autosave ---------- */
  changed() {
    if (!this.e || this.e.deleted_at || this.ro) return;
    this.dirty = true; this.touched = true; this.setStatus('saving'); this.commit();
    this.el.root.classList.toggle('has-text', !!(this.el.title.value.trim() || this.el.body.textContent.replace(ZWRE, '').trim()));
    this.markEmpty();
  },
  commit: null, // assigned below (debounced)
  async doCommit() {
    const e = this.e; if (!e || !this.dirty) return;
    this.dirty = false;
    e.title = this.el.title.value.slice(0, 300);
    const clean = sanitizeHTML(this.el.body.innerHTML);
    e.content = clean; e.text = htmlToText(clean);
    if (this.isNew && isEmptyEntry(e) && !S.entries.has(e.id)) { this.setStatus('new'); return; }
    if (S.entries.size >= LIMITS.entries && !S.entries.has(e.id)) { this.setStatus('error'); toast(t('err.quota'), { error: true }); return; }
    try { await saveEntry(e); this.setStatus(S.mode === 'cloud' ? (navigator.onLine ? 'saving' : 'offline') : 'saved', true); }
    catch { this.setStatus('error'); }
    this.renderDates();
  },
  setStatus(s, flash) {
    const st = this.el.status; st.dataset.s = s;
    let label = { new: t('ed.st.new'), saving: t('ed.st.saving'), saved: t('ed.st.saved'), synced: t('ed.st.synced'), offline: t('ed.st.offline'), error: t('ed.st.error') }[s] || '';
    const n = this.e ? (this.e.title.length + (this.e.text || '').replace(/\s/g, '').length) : 0;
    if (n && !this.isNew && ['saved', 'synced', 'offline'].includes(s)) label += ' · ' + t('ed.chars', { n: fmtNum(n) });
    const txt = st.querySelector('.txt'); if (txt.textContent !== label) { txt.textContent = label; st.classList.remove('swap'); void st.offsetWidth; st.classList.add('swap'); }
    st.querySelector('.led').innerHTML = ['saved', 'synced'].includes(s) ? icon('check') : '';
    st.title = s === 'error' ? (Sync.lastError || t('ed.st.error')) : '';
    if (flash) { st.classList.remove('flash'); void st.offsetWidth; st.classList.add('flash'); }
  },
  syncStatus() {
    if (!this.e || this.dirty || S.mode !== 'cloud') return;
    const cur = S.entries.get(this.e.id); if (!cur) return;
    if (!cur._dirty) this.setStatus('synced'); else if (S.sync === 'offline') this.setStatus('offline'); else if (S.sync === 'error') this.setStatus('error');
  },

  /* ---------- meta ---------- */
  renderMeta() {
    const e = this.e, ty = typeOf(e.type), c = catOf(e.category_id);
    this.el.type.innerHTML = `${icon(ty.icon)}<span>${esc(ty.label)}</span>${icon('chevron-down')}`;
    this.el.cat.innerHTML = c ? `<span class="sw" style="background:${esc(c.color)}"></span><span>${esc(c.name)}</span>` : `${icon('folder')}<span>${esc(t('ed.noCategory'))}</span>`;
    this.renderShare();
    this.el.fav.classList.toggle('on', !!e.favorite); this.el.fav.setAttribute('aria-pressed', String(!!e.favorite));
    this.el.pin.classList.toggle('on', !!e.pinned); this.el.pin.setAttribute('aria-pressed', String(!!e.pinned));
    this.renderSummary();
    this.el.title.placeholder = t('ed.titlePh.' + (['item', 'contact', 'todo', 'event'].includes(e.type) ? e.type : 'default'));
    this.renderTags(); this.renderDates();
    const all = new Set(); live().forEach(x => x.tags.forEach(tg => all.add(tg)));
    $('#tagSuggest').innerHTML = [...all].slice(0, 300).map(x => `<option value="${esc(x)}">`).join('');
  },
  /* sharing: 'Only me' by default; a tap picks one of my shared folders. Someone else's record shows its folder and writer. */
  renderShare() {
    const e = this.e, b = this.el.share; const f = Share.folder(e.folder_id);
    b.hidden = !Share.available() && !f;
    const mine = Share.isMine(e); b.disabled = !mine; b.classList.toggle('on', !!f);
    b.innerHTML = f ? `${icon('users')}<span>${esc(f.name)}${mine ? '' : ' · ' + esc(t('share.by', { who: Share.authorOf(e) || '?' }))}</span>${mine ? icon('chevron-down') : ''}` : `${icon('lock')}<span>${esc(t('share.private'))}</span>${icon('chevron-down')}`;
  },
  shareMenu(b) {
    if (!Share.isMine(this.e)) return;
    const set = fid => { this.e.folder_id = fid; this.renderMeta(); this.changed(); pop(b, 'mo-pop'); haptic(8);
      const f = Share.folder(fid); b.setAttribute('aria-label', f ? t('share.moved', { name: f.name }) : t('share.movedPrivate')); };
    menu(b, [{ label: t('share.private'), icon: 'lock', checked: !this.e.folder_id, run: () => set(null) },
      ...(Share.writable().length ? ['-', ...Share.writable().map(f => ({ label: f.name, icon: 'users', checked: f.id === this.e.folder_id, run: () => set(f.id) }))] : []),
      '-', { label: t('share.new'), icon: 'plus', run: async () => { const id = await newFolder(); if (id && this.e) set(id); } }]);
  },
  renderDates() { if (this.e && S.entries.has(this.e.id)) this.el.dates.textContent = t('ed.edited', { t: fmtRel(this.e.updated_at) }); else this.el.dates.textContent = ''; },
  renderTags() { this.renderSummary(); this.el.tags.innerHTML = this.e.tags.map((g, i) => `<span class="tchip">#${esc(g)}<button data-rm="${i}" aria-label="${esc(t('common.remove'))}">${icon('x')}</button></span>`).join(''); },
  addTag(v) {
    v.split(',').map(s => s.trim().replace(/^#/, '').slice(0, LIMITS.tagLen)).filter(Boolean).forEach(tg => { if (!this.e.tags.includes(tg) && this.e.tags.length < LIMITS.tagsPerEntry) this.e.tags.push(tg); });
    this.renderTags(); this.changed();
  },
  toggle(k, btn) {
    if (!this.e) return; this.e[k] = !this.e[k]; this.renderMeta();
    // the chip itself answers (pop + sparkle when on, a soft shrink when off) instead of a toast
    if (btn && this.e[k]) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); burst(btn); haptic(10); }
    else if (btn) { pop(btn, 'mo-off'); haptic(5); }
    if (btn) btn.setAttribute('aria-label', k === 'pinned' ? (this.e.pinned ? t('ed.pinned') : t('ed.unpinned')) : (this.e.favorite ? t('ed.faved') : t('ed.unfaved')));
    pop(this.el.optBtn, 'mo-nudge');
    this.changed();
  },
  typeMenu(b) {
    menu(b, typeList().map(ty => ({ label: ty.label, icon: ty.icon, checked: ty.id === this.e.type, run: () => this.setType(ty.id) })));
  },
  catMenu(b) {
    const cats = [...S.categories.values()].sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name));
    menu(b, [{ label: t('ed.noCategory'), icon: 'inbox', checked: !this.e.category_id, run: () => { this.e.category_id = null; this.renderMeta(); this.changed(); } }, '-',
      ...cats.map(c => ({ label: c.name, sw: c.color, checked: c.id === this.e.category_id, run: () => { this.e.category_id = c.id; this.renderMeta(); this.changed(); } })),
      '-', { label: t('cat.new'), icon: 'plus', run: async () => { const c = await UI.createCategory(); if (c && this.e) { this.e.category_id = c.id; this.renderMeta(); this.changed(); } } }]);
  },
  moreMenu(b) {
    const e = this.e; const sp = entrySpacing(e, S.prefs);
    const items = [
      { label: t('ed.duplicate'), icon: 'copy', run: () => this.duplicate() },
      { label: t('ed.copyText'), icon: 'file-text', run: () => navigator.clipboard.writeText((e.title ? e.title + '\n\n' : '') + e.text).then(() => toast(t('common.copied'))) },
      { label: t('ed.exportMd'), icon: 'download', run: () => this.exportOne('md') },
      { label: t('ed.exportTxt'), icon: 'download', run: () => this.exportOne('txt') },
      { label: t('ed.exportJson'), icon: 'download', run: () => this.exportOne('json') },
      '-', { header: t('fmt.spacing') },
      ...SPACINGS.map(v => ({ label: t('spacing.' + v), checked: sp === v, run: () => this.setSpacing(v) })),
      '-',
      e.deleted_at ? { label: t('trash.restore'), icon: 'rotate-ccw', run: async () => { await restoreEntries([e.id]); this.open(e.id); toast(t('trash.restored')); } }
        : { label: t('ed.trash'), icon: 'trash-2', danger: true, run: async () => { this.commit.flush(); if (!S.entries.has(e.id)) { this.close(); return; } await trashEntries([e.id]); this.close(); toast(t('trash.moved'), { action: t('common.undo'), onAction: () => restoreEntries([e.id]) }); } }
    ];
    menu(b, items, { alignRight: true });
  },
  setSpacing(v) { this.e.meta.spacing = v; this.el.body.className = 'prose sp-' + v; this.changed(); },
  async duplicate() {
    this.commit.flush(); const src = this.e;
    const copy = newEntry({ ...structuredClone({ type: src.type, title: src.title, content: src.content, text: src.text, category_id: src.category_id, tags: src.tags, meta: src.meta }), title: (src.title || entryDisplayTitle(src)) + ' ' + t('ed.copySuffix') });
    copy.meta.done = false; await saveEntry(copy); this.open(copy.id); toast(t('ed.duplicated'));
  },
  exportOne(fmt) {
    this.commit.flush(); const e = this.e; const base = (entryDisplayTitle(e).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'record').slice(0, 60);
    if (fmt === 'md') download(base + '.md', (e.title ? `# ${e.title}\n\n` : '') + htmlToMarkdown(e.content), 'text/markdown');
    else if (fmt === 'txt') download(base + '.txt', (e.title ? e.title + '\n\n' : '') + e.text, 'text/plain');
    else download(base + '.json', JSON.stringify(Data.exportShape([e]), null, 2), 'application/json');
  },

  /* ---------- properties: one chip row under the title, values edited in a panel above the keyboard ---------- */
  propDefs(type) {
    return ({
      todo: ['due', 'priority', 'remind', 'important', 'done'],
      event: ['date', 'time', 'repeat', 'remind', 'desc'],
      item: ['location'],
      contact: ['phone', 'email', 'org', 'address']
    })[type] || [];
  },
  propLabel(k) {
    const m = this.e.meta;
    const remind = v => v === '' || v == null ? '' : v === '0' ? t('remind.at') : +v >= 1440 ? t('remind.d', { n: +v / 1440 }) : +v >= 60 ? t('remind.h', { n: +v / 60 }) : t('remind.m', { n: v });
    switch (k) {
      case 'due': return m.due ? fmtDue(m.due, m.due_time) : '';
      case 'date': return m.date ? fmtDue(m.date) : '';
      case 'time': return m.time ? fmtTime(m.time) + (m.end_time ? '–' + fmtTime(m.end_time) : '') : '';
      case 'priority': return m.priority ? 'P' + m.priority : '';
      case 'remind': return remind(m.remind);
      case 'repeat': return m.repeat ? repeatLabel(m, true) : '';
      default: return m[k] || '';
    }
  },
  renderFields() {
    const e = this.e, m = e.meta, f = this.el.fields;
    const IC = { repeat: 'repeat', due: 'calendar', date: 'calendar', time: 'clock', priority: 'flag', remind: 'bell', desc: 'text-quote', location: 'map-pin', phone: 'phone', email: 'mail', org: 'briefcase', address: 'home' };
    f.innerHTML = this.propDefs(e.type).map(k => {
      if (k === 'important') return `<button class="mchip prop ${m.important ? 'set star' : 'empty'}" data-tf="important" aria-pressed="${!!m.important}">${icon('star')}<span>${esc(t('f.important'))}</span></button>`;
      if (k === 'done') return `<button class="mchip prop ${m.done ? 'set ok' : 'empty'}" data-tf="done" aria-pressed="${!!m.done}">${icon(m.done ? 'circle-check' : 'circle')}<span>${esc(m.done ? t('task.done') : t('task.open'))}</span></button>`;
      if (k === 'desc' && !m.desc) return '';
      const v = this.propLabel(k); const cls = v ? 'set' + (k === 'location' ? ' accent' : '') + (k === 'due' && !m.done && m.due && m.due < todayKey() ? ' over' : '') : 'empty';
      return `<button class="mchip prop ${cls} ${this.panel === 'prop:' + k ? 'open' : ''}" data-prop="${k}">${icon(IC[k] || 'circle')}<span>${esc(v || t('prop.' + k))}</span></button>`;
    }).join('');
    this.renderSummary();
  },
  setType(ty) {
    this.e.type = ty; if (ty === 'event' && !this.e.meta.date) this.e.meta.date = V.selDay || todayKey(); if (ty === 'todo' && this.e.meta.done == null) this.e.meta.done = false;
    this.closePanel(); this.renderMeta(); this.renderFields(); this.renderSkin(); this.changed();
  },
  propPanel(k) {
    const m = this.e.meta; const d0 = new Date();
    const dayBtns = key => { const opts = [['date.today', dayKey(d0)], ['date.tomorrow', dayKey(addDays(d0, 1))], ['prop.weekend', dayKey(addDays(d0, (6 - d0.getDay() + 7) % 7 || 7))], ['prop.nextWeek', dayKey(addDays(startOfWeek(d0, 1), 7))]];
      return `<div class="pp-grid">${opts.map(([l, v]) => `<button class="pp-b ${m[key] === v ? 'on' : ''}" data-pset="${key}:${v}">${esc(t(l))}<small>${esc(fmtDate(parseDay(v), { month: 'numeric', day: 'numeric', weekday: 'short' }))}</small></button>`).join('')}</div>`; };
    const inp = (key, type, ph = '') => `<input class="input" type="${type}" data-k="${key}" value="${esc(m[key] || '')}" placeholder="${esc(ph)}" ${type === 'text' || type === 'tel' || type === 'email' ? 'enterkeyhint="done"' : ''} ${type === 'email' ? 'autocapitalize="off" inputmode="email"' : ''} ${type === 'tel' ? 'inputmode="tel"' : ''}>`;
    const field = (label, html) => `<label class="pp-f"><span>${esc(label)}</span>${html}</label>`;
    const remind = `<div class="pp-grid">${[['', 'remind.none'], ['0', 'remind.at'], ['15', null, 15, 'm'], ['60', null, 1, 'h'], ['1440', null, 1, 'd']].map(([v, l, n, u]) => `<button class="pp-b ${String(m.remind ?? '') === v ? 'on' : ''}" data-pset="remind:${v}">${esc(l ? t(l) : t('remind.' + u, { n }))}</button>`).join('')}</div>`;
    let body = '';
    switch (k) {
      case 'due': body = dayBtns('due') + `<div class="pp-2">${field(t('f.due'), inp('due', 'date'))}${field(t('f.time'), inp('due_time', 'time'))}</div>` + (m.due ? `<button class="pp-clear" data-pset="due:">${icon('x')}${esc(t('prop.clearDate'))}</button>` : ''); break;
      case 'date': body = dayBtns('date') + `<div class="pp-2">${field(t('f.date'), inp('date', 'date'))}</div>`; break;
      case 'time': body = `<div class="pp-grid">${[['', 'cal.allDay'], ['09:00'], ['12:00'], ['15:00'], ['19:00']].map(([v, l]) => `<button class="pp-b ${(m.time || '') === v ? 'on' : ''}" data-pset="time:${v}">${esc(l ? t(l) : fmtTime(v))}</button>`).join('')}</div><div class="pp-2">${field(t('f.start'), inp('time', 'time'))}${field(t('f.end'), inp('end_time', 'time'))}</div>`; break;
      case 'repeat': {
        const b = m.date ? parseDay(m.date) : new Date();
        const hint = { weekly: fmtDate(b, { weekday: 'short' }), monthly: t('repeat.dayN', { n: b.getDate() }), yearly: fmtDate(b, { month: 'short', day: 'numeric' }) };
        body = `<div class="pp-grid four">${REPEATS.map(v => `<button class="pp-b ${(m.repeat || '') === v ? 'on' : ''}" data-pset="repeat:${v}">${esc(t('repeat.' + (v || 'none')))}${v ? `<small>${esc(hint[v])}</small>` : ''}</button>`).join('')}</div>`
          + (m.repeat ? `<div class="pp-2">${field(t('repeat.until'), inp('repeat_until', 'date'))}</div><p class="pp-note">${esc(repeatLabel(m))}</p>` : '');
        break; }
      case 'priority': body = `<div class="pp-grid four">${[0, 1, 2, 3].map(p => `<button class="pp-b ${Number(m.priority || 0) === p ? 'on' : ''}" data-pset="priority:${p}">${esc(t('prio.' + p))}</button>`).join('')}</div>`; break;
      case 'remind': body = remind + (this.e.type === 'todo' && !m.due ? `<p class="pp-note">${esc(t('prop.remindNeedsDue'))}</p>` : ''); break;
      case 'desc': body = `<div class="pp-1">${field(t('f.desc'), inp('desc', 'text', t('f.descPh')))}</div>`; break;
      case 'location': body = `<div class="pp-1">${field(t('f.location'), inp('location', 'text', t('f.locationPh')))}</div>`; break;
      case 'phone': body = `<div class="pp-1">${field(t('f.phone'), inp('phone', 'tel'))}</div>`; break;
      case 'email': body = `<div class="pp-1">${field(t('f.email'), inp('email', 'email'))}</div>`; break;
      case 'org': body = `<div class="pp-1">${field(t('f.org'), inp('org', 'text'))}</div>`; break;
      case 'address': body = `<div class="pp-1">${field(t('f.address'), inp('address', 'text'))}</div>`; break;
    }
    return `<div class="pp"><div class="pp-h"><b>${esc(t('prop.' + k))}</b><button class="btn sm primary" data-pclose>${esc(t('common.done'))}</button></div>${body}</div>`;
  },
  propInput(ev) {
    const k = ev.target.dataset?.k; if (!k || !this.e) return;
    let v = ev.target.value; if (k === 'email') ev.target.setCustomValidity(v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? t('err.email') : '');
    this.e.meta[k] = v; this.renderFields(); this.changed();
    if (k === 'repeat_until' && this.panel === 'prop:repeat') { const n = $('.pp-note', this.el.opt); if (n) n.textContent = repeatLabel(this.e.meta); }
    if (ev.type === 'change' && ['due', 'date', 'time', 'end_time', 'due_time'].includes(k)) $$('[data-pset]', this.el.opt).forEach(b => b.classList.toggle('on', b.dataset.pset === k + ':' + v));
  },
  propSet(spec) {
    const i = spec.indexOf(':'); const k = spec.slice(0, i); let v = spec.slice(i + 1);
    if (k === 'priority') v = Number(v);
    this.e.meta[k] = v; if (k === 'due' && !v) { this.e.meta.due_time = ''; }
    if (k === 'time' && !v) this.e.meta.end_time = '';
    if (k === 'repeat' && !v) this.e.meta.repeat_until = '';
    haptic(5); this.renderFields(); this.changed();
    const one = ['priority', 'remind'].includes(k) || (k === 'time' && !v) || (k === 'repeat' && !v);
    if (one) { this.closePanel(); this.renderFields(); } else this.renderPanel();
  },

  /* ---------- selection helpers ---------- */
  inBody(node) { return !!node && this.el.body.contains(node.nodeType === 3 ? node.parentNode : node); },
  saveSel(force) { if (!force && document.activeElement !== this.el.body) return; const s = getSelection(); if (s.rangeCount && this.inBody(s.anchorNode)) this.savedRange = s.getRangeAt(0).cloneRange(); },
  focusKeep() {
    const b = this.el.body; const s = getSelection();
    if (document.activeElement === b && s.rangeCount && this.inBody(s.anchorNode)) return;
    const r = this.savedRange; b.focus({ preventScroll: true });
    if (r && this.inBody(r.startContainer) && r.startContainer.isConnected) { s.removeAllRanges(); s.addRange(r); }
    else if (!s.rangeCount || !this.inBody(s.anchorNode)) this.focusBody(true);
  },
  focusBody(end, start) {
    const b = this.el.body; this.ensureBlock(); b.focus({ preventScroll: true });
    const s = getSelection(); const r = document.createRange();
    if (start) { const C = b.querySelector('p,li,h2,h3,blockquote,div') || b; const p = Rich.offsetToPos(C, 0); r.setStart(p.node, p.offset); }
    else if (end) { const Cs = [...b.querySelectorAll('p,li,h2,h3,blockquote,div')].filter(c => Rich.isContainer(c)); const C = Cs[Cs.length - 1] || b; const p = Rich.offsetToPos(C, 1e9); r.setStart(p.node, p.offset); }
    else return;
    r.collapse(true); s.removeAllRanges(); s.addRange(r); this.savedRange = r.cloneRange();
  },
  ensureBlock() {
    const b = this.el.body;
    // browsers sometimes nest a list/quote inside a <p> — lift it out
    const bad = [...b.querySelectorAll('p,h2,h3')].filter(p => [...p.children].some(isBlockEl));
    if (bad.length) {
      const s = getSelection(); const a = s.rangeCount ? [s.anchorNode, s.anchorOffset] : null;
      bad.forEach(p => { const kids = [...p.childNodes]; p.replaceWith(...kids); });
      Rich.normalizeTop(b);
      if (a && a[0].isConnected) { const r = document.createRange(); try { r.setStart(a[0], a[1]); r.collapse(true); s.removeAllRanges(); s.addRange(r); } catch {} }
    }
    if (!b.textContent.replace(ZWRE, '').trim() && !b.querySelector('.ico,li') && !b.querySelector('p,h2,h3,blockquote,div')) { b.innerHTML = '<p><br></p>'; }
    else if ([...b.childNodes].some(n => !isBlockEl(n) && !(n.nodeType === 3 && !n.nodeValue.trim()))) { const sel = this.getSelOffsets(); Rich.normalizeTop(b); if (sel) this.setSelOffsets(sel); }
  },
  getSelOffsets() {
    const s = getSelection(); if (!s.rangeCount || !this.inBody(s.anchorNode)) return null;
    const r = s.getRangeAt(0), b = this.el.body;
    const off = (node, o) => { const pre = document.createRange(); pre.selectNodeContents(b); try { pre.setEnd(node, o); } catch { return 0; } return pre.toString().length; };
    return { start: off(r.startContainer, r.startOffset), end: off(r.endContainer, r.endOffset) };
  },
  setSelOffsets({ start, end }) {
    const b = this.el.body, w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let pos = 0, sN, sO, eN, eO, n;
    while ((n = w.nextNode())) { const L = n.nodeValue.length; if (sN == null && start <= pos + L) { sN = n; sO = start - pos; } if (eN == null && end <= pos + L) { eN = n; eO = end - pos; break; } pos += L; }
    const r = document.createRange();
    if (!sN) { r.selectNodeContents(b); r.collapse(false); } else { r.setStart(sN, sO); if (eN) r.setEnd(eN, eO); else r.collapse(true); }
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  },
  setRange(res) {
    const s = getSelection(); const r = document.createRange();
    if (res.caret) { r.setStart(res.caret.node, res.caret.offset); r.collapse(true); }
    else { r.setStart(res.start.node, res.start.offset); r.setEnd(res.end.node, res.end.offset); }
    s.removeAllRanges(); s.addRange(r); this.savedRange = r.cloneRange();
  },
  dropPending() { if (this.pending) { Rich.dropPending(this.pending, this.el.body); this.pending = null; } },
  ready() { return this.e && !this.e.deleted_at; },

  /* ---------- formatting ---------- */
  mark(key, val) {
    if (!this.ready()) return;
    this.focusKeep(); this.ensureBlock();
    const s = getSelection(); if (!s.rangeCount) return; let r = s.getRangeAt(0);
    if (!this.inBody(r.startContainer)) { this.focusBody(true); r = s.getRangeAt(0); }
    this.histNow();
    const st = Rich.stateOf(this.el.body, r);
    let fn;
    if (['b', 'i', 'u', 's'].includes(key)) { const on = val ?? !st[key]; fn = m => { m[key] = on || null; return m; }; }
    else if (key === 'clear') fn = () => ({});
    else fn = m => { m[key] = val || null; return m; };
    const prevPending = this.pending;
    const res = Rich.apply(this.el.body, r, fn); if (!res) return;
    if (prevPending && prevPending !== res.pending) Rich.dropPending(prevPending, this.el.body);
    this.pending = res.pending || null;
    this.setRange(res);
    if (['color', 'hl', 'size'].includes(key) && val) { this.last[key] = val; ls.set('kept.last', this.last); this.paintLast(); }
    haptic(5);
    this.afterFmt();
  },
  cmd(c) {
    if (c === 'undo') return this.undo();
    if (c === 'redo') return this.redo();
    if (c === 'kbd') { document.activeElement?.blur(); this.closePanel(); return; }
    if (c === 'fmt') return this.toggleTools();
    if (!this.ready()) return;
    if (c === 'clear') return this.mark('clear');
    this.focusKeep(); this.ensureBlock(); this.histNow();
    const blk = this.closestBlock();
    if (c === 'ul') document.execCommand('insertUnorderedList');
    else if (c === 'ol') document.execCommand('insertOrderedList');
    else if (c === 'quote') document.execCommand('formatBlock', false, blk?.closest('blockquote') ? 'p' : 'blockquote');
    else if (c === 'h2') document.execCommand('formatBlock', false, blk?.closest('h2') ? 'p' : 'h2');
    this.ensureBlock(); haptic(5); this.afterFmt();
  },
  toolClick(e) {
    const b = e.target.closest('[data-mark],[data-cmd],[data-panel],[data-color],[data-hl],[data-size],[data-sp],[data-v],[data-tab],[data-pset],[data-pclose],[data-bb],[data-tpl]'); if (!b) return;
    e.preventDefault();
    const d = b.dataset;
    if (d.bb) return this.expandBubble();
    if (d.tpl) return this.applyTemplate(d.tpl, b);
    if (d.mark) return this.mark(d.mark);
    if (d.cmd) return this.cmd(d.cmd);
    if (d.panel) return this.togglePanel(d.panel);
    if (d.color !== undefined) { this.mark('color', d.color || null); return this.backToText(); }
    if (d.hl !== undefined) { this.mark('hl', d.hl || null); return this.backToText(); }
    if (d.size !== undefined) { this.mark('size', d.size || null); return this.backToText(); }
    if (d.sp) { this.setSpacing(d.sp); return this.backToText(); }
    if (d.tab) { ls.set('kept.pick.' + this.panel, d.tab); this.renderPanel(); return; }
    if (d.pset !== undefined) return this.propSet(d.pset);
    if (d.pclose !== undefined) { this.closePanel(); this.renderFields(); return; }
    if (d.v) { this.panel === 'icon' ? this.insertIcon(d.v) : this.insertText(d.v); burst(b, 4); return this.backToText(); }
  },
  /* after choosing an icon, emoji, colour or size you are writing again — caret restored, keyboard back */
  backToText() {
    if (!this.ready() || !this.panel || this.panel.startsWith('prop:')) return;
    const r = this.savedRange && this.savedRange.startContainer.isConnected && this.inBody(this.savedRange.startContainer) ? this.savedRange.cloneRange() : null;
    this.closePanel();
    const b = this.el.body; b.focus({ preventScroll: true });
    const s = getSelection();
    if (r) { s.removeAllRanges(); s.addRange(r); this.savedRange = r.cloneRange(); }
    else if (!s.rangeCount || !this.inBody(s.anchorNode)) this.focusBody(true);
    this.updateToolState(); this.ensureCaret();
  },
  afterFmt() { this.touched = true; this.changed(); this.histNow(); this.updateToolState(); this.ensureCaret(); },
  closestBlock() { const s = getSelection(); if (!s.rangeCount) return null; let n = s.anchorNode; if (n?.nodeType === 3) n = n.parentNode; return n && this.inBody(n) ? n.closest('p,div,li,blockquote,h2,h3') : null; },
  paintLast() {
    const t = this.el.tools; if (!t) return;
    t.querySelector('[data-panel="color"]')?.style.setProperty('--lastc', `var(--c-${this.last.color})`);
    t.querySelector('[data-panel="hl"]')?.style.setProperty('--lasth', `var(--${this.last.hl.replace('bg-', 'hl-')})`);
  },
  updateToolState() {
    if (!this.e) return;
    const s = getSelection(); const inB = s.rangeCount && this.inBody(s.anchorNode);
    const st = inB ? Rich.stateOf(this.el.body, s.getRangeAt(0)) : {};
    this.state = st;
    ['b', 'i', 'u', 's'].forEach(k => $$(`[data-mark="${k}"]`).forEach(x => { x.classList.toggle('on', !!st[k]); x.setAttribute('aria-pressed', !!st[k]); }));
    const setOn = (sel, on) => $$(sel).forEach(x => x.classList.toggle('on', !!on));
    setOn('#edTools [data-panel="color"]', st.color && st.color !== '*' || this.panel === 'color');
    setOn('#edTools [data-panel="hl"]', st.hl && st.hl !== '*' || this.panel === 'hl');
    setOn('#edTools [data-panel="size"]', st.size && st.size !== '*' || this.panel === 'size');
    ['icon', 'emoji', 'spacing', 'tpl'].forEach(p => setOn(`#edTools [data-panel="${p}"]`, this.panel === p));
    if (st.color && st.color !== '*') this.el.tools.querySelector('[data-panel="color"]').style.setProperty('--lastc', `var(--c-${st.color})`); else this.paintLast();
    let ul = false, ol = false; try { ul = inB && document.queryCommandState('insertUnorderedList'); ol = inB && document.queryCommandState('insertOrderedList'); } catch {}
    setOn('[data-cmd="ul"]', ul); setOn('[data-cmd="ol"]', ol);
    const blk = inB ? this.closestBlock() : null;
    setOn('[data-cmd="quote"]', blk?.closest('blockquote')); setOn('[data-cmd="h2"]', blk?.closest('h2'));
    setOn('[data-cmd="undo"]', false); $$('[data-cmd="undo"]').forEach(x => x.disabled = this.hidx <= 0); $$('[data-cmd="redo"]').forEach(x => x.disabled = this.hidx >= this.hist.length - 1);
    if (this.el.opt && !this.el.opt.hidden && ['color', 'hl', 'size'].includes(this.panel)) {
      const cur = { color: st.color || '', hl: st.hl || '', size: st.size || '' }[this.panel];
      $$('[data-color],[data-hl],[data-size]', this.el.opt).forEach(x => { const v = x.dataset.color ?? x.dataset.hl ?? x.dataset.size; x.classList.toggle('on', v === cur); });
    }
  },
  onSel() {
    if (!this.e) return;
    const s = getSelection();
    if (!s.rangeCount || !this.inBody(s.anchorNode)) { if (!this.el.bubble.matches(':hover')) this.hideBubble(); return; }
    if (this.pending && s.anchorNode !== this.pending) { const p = this.pending; this.pending = null; if (p.isConnected && p.nodeValue.replace(ZWRE, '') === '') { const off = this.getSelOffsets(); Rich.dropPending(p, this.el.body); if (off) this.setSelOffsets(off); } }
    cancelAnimationFrame(this._selRaf); this._selRaf = requestAnimationFrame(() => this.updateToolState());
    // floating bubble only with a mouse — on touch devices it would cover the system copy/paste menu
    if (s.isCollapsed || this.e.deleted_at || !matchMedia('(hover: hover) and (pointer: fine)').matches) { this.hideBubble(); return; }
    this.el.bubble.classList.add('show'); this.placeBubble();
  },
  /* the selection "ticker" is one small icon; it opens into the full set when tapped */
  placeBubble() {
    const s = getSelection(); if (!s.rangeCount) return;
    const r = s.getRangeAt(0).getBoundingClientRect(); if (!r.width && !r.height) return;
    const bb = this.el.bubble; const w = bb.offsetWidth;
    let x = bb.classList.contains('mini') ? r.right - w / 2 : r.left + r.width / 2 - w / 2; x = clamp(x, 8, innerWidth - w - 8);
    let y = r.top - bb.offsetHeight - 10; if (y < 60) y = r.bottom + 10;
    bb.style.left = x + 'px'; bb.style.top = y + 'px';
  },
  expandBubble() {
    const bb = this.el.bubble; if (!bb.classList.contains('mini')) return;
    const before = bb.getBoundingClientRect();
    bb.classList.remove('mini'); bb.querySelector('.bb-open')?.setAttribute('aria-expanded', 'true'); this.placeBubble();
    const after = bb.getBoundingClientRect();
    bb.animate([{ clipPath: `inset(0 ${Math.max(0, after.width - before.width - (after.left - before.left))}px 0 ${Math.max(0, before.left - after.left)}px round 14px)`, opacity: .6 }, { clipPath: 'inset(0 0 0 0 round 14px)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    haptic(5); this.updateToolState();
  },
  hideBubble() { const bb = this.el.bubble; if (!bb) return; bb.classList.remove('show'); bb.classList.add('mini'); bb.querySelector('.bb-open')?.setAttribute('aria-expanded', 'false'); },
  /* the toolbar under the text: undo / redo, a format toggle and templates; everything else on request */
  toggleTools(force) {
    const tl = this.el.tools; if (!tl) return;
    const open = force ?? tl.classList.contains('collapsed');
    tl.classList.toggle('collapsed', !open); tl.classList.toggle('expanded', open);
    tl.querySelector('.tb-fmt')?.setAttribute('aria-expanded', String(open)); tl.querySelector('.tb-fmt')?.classList.toggle('on', open);
    if (!open && ['color', 'hl', 'size', 'icon', 'emoji', 'spacing'].includes(this.panel)) { this.closePanel(); this.focusKeep(); }
    if (open) tl.scrollTo?.({ left: 0 });
    haptic(5); this.updateToolState();
  },
  applyTemplate(id, btn) {
    const tpl = TEMPLATES.find(x => x.id === id); if (!tpl || !this.ready()) return;
    const html = sanitizeHTML(templateHTML(tpl, LANG));
    this.histNow();
    const body = this.el.body; const empty = !body.textContent.replace(ZWRE, '').trim() && !body.querySelector('.ico,li');
    const r = this.panelMode === 'over' && this.savedRange?.startContainer.isConnected && this.inBody(this.savedRange.startContainer) ? this.savedRange : null;
    this.closePanel();
    let added;
    if (empty) { body.innerHTML = html; added = [...body.children]; }
    else {
      // add after the block the caret is in (or at the end), never inside a sentence
      const host = document.createElement('div'); host.innerHTML = html; added = [...host.children];
      let blk = r ? (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement)?.closest('p,div,li,blockquote,h2,h3,ul,ol') : null;
      while (blk && blk.parentElement !== body) blk = blk.parentElement;
      const ref = blk ? blk.nextSibling : null; added.forEach(n => body.insertBefore(n, ref));
    }
    hydrateIcons(body); Rich.normalizeTop(body);
    if (!reduced()) added.forEach((n, i) => { n.classList.add('tpl-in'); n.style.setProperty('--i', i); n.addEventListener('animationend', () => { n.classList.remove('tpl-in'); n.style.removeProperty('--i'); if (!n.getAttribute('class')) n.removeAttribute('class'); if (!n.getAttribute('style')) n.removeAttribute('style'); }, { once: true }); });
    // caret into the first empty line of the template, so writing starts where it should
    const first = added.map(n => n.matches('li,p,blockquote') && !n.textContent.trim() ? n : n.querySelector?.('li:empty, li:has(> br:only-child), p:has(> br:only-child)')).find(Boolean) || added[added.length - 1];
    body.focus({ preventScroll: true });
    if (first) { const rr = document.createRange(); rr.selectNodeContents(first); rr.collapse(!first.textContent.trim()); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rr); first.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    burst(btn, 6); haptic(12); this.afterFmt(); this.markEmpty();
  },
  ensureCaret() {
    cancelAnimationFrame(this._cRaf);
    this._cRaf = requestAnimationFrame(() => {
      const s = getSelection(); if (!s.rangeCount || !this.inBody(s.anchorNode)) return;
      let rect = s.getRangeAt(0).getBoundingClientRect();
      if (!rect.height) { const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement; rect = n.getBoundingClientRect(); if (rect.height > 60) return; }
      const sc = this.el.scroll.getBoundingClientRect(); const ov = this.panelMode === 'over' ? this.el.opt.offsetHeight : 0; const lim = sc.bottom - ov - 28;
      if (rect.bottom > lim) this.el.scroll.scrollBy({ top: rect.bottom - lim + 36, behavior: 'smooth' });
      else if (rect.top < sc.top + 6) this.el.scroll.scrollBy({ top: rect.top - sc.top - 40, behavior: 'smooth' });
    });
  },

  /* ---------- inline option panels (no floating menus over the text) ---------- */
  togglePanel(p) {
    if (this.panel === p) { const wasKb = this.panelMode === 'kb'; this.closePanel(); if (wasKb) this.focusKeep(); this.updateToolState(); return; }
    if (this.panelMode === 'kb' && !['icon', 'emoji'].includes(p)) { this.closePanel(); this.focusKeep(); }
    // icon / emoji pickers on phones take the keyboard's place, so the text never moves
    if (['icon', 'emoji'].includes(p) && isTouch() && this.ready()) {
      this.saveSel(); const s = getSelection(); if (!this.savedRange && s.rangeCount && this.inBody(s.anchorNode)) this.savedRange = s.getRangeAt(0).cloneRange();
      if (!this.savedRange) { this.focusBody(true); }
      const h = Math.max(260, Math.min(this.kbH || 300, innerHeight * .5));
      this.panelMode = 'kb'; this.el.root.style.setProperty('--kbh', h + 'px');
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      this.panel = p; this.renderPanel(); this.updateToolState(); return;
    }
    if (p.startsWith('prop:')) { this.panelMode = 'prop'; this.panel = p; this.renderPanel(); this.renderFields(); const i = this.el.opt.querySelector('input[type=text],input[type=tel],input[type=email]'); if (i) i.focus({ preventScroll: true }); return; }
    this.panelMode = 'over';
    // one tap = apply the last used colour/marker/size right away, the panel lets you change it
    if (['color', 'hl', 'size'].includes(p) && this.ready()) {
      const st = this.state || {};
      if (st[p] !== this.last[p]) this.mark(p, this.last[p]);
    }
    this.panel = p; this.renderPanel(); this.updateToolState(); this.ensureCaret();
  },
  closePanel() {
    const wasProp = this.panel && this.panel.startsWith('prop:');
    this.panel = null; this.panelMode = null; this.el.scroll?.querySelector('.ghost-host')?.remove();
    if (this.el.opt) { this.el.opt.hidden = true; this.el.opt.innerHTML = ''; this.el.opt.className = 'ed-opt'; if (this.el.opt.parentNode !== this.el.panelEl && this.el.tools) this.el.panelEl.insertBefore(this.el.opt, this.el.tools); }
    this.el.root?.classList.remove('panel-open', 'panel-kb'); this.el.root?.style.setProperty('--opt-h', '0px');
    if (wasProp && this.e) this.renderFields();
  },
  renderPanel() {
    const o = this.el.opt, p = this.panel; if (!p) return this.closePanel();
    let h = '';
    if (p.startsWith('prop:')) h = this.propPanel(p.slice(5));
    if (p === 'color') h = `<div class="opt-row"><button class="sw none" data-color="" aria-label="${esc(t('color.default'))}">${icon('ban')}</button>${TEXT_COLORS.map(c => `<button class="sw" data-color="${c}" style="--sc:var(--c-${c})" aria-label="${esc(t('color.' + c))}"><b>A</b></button>`).join('')}</div>`;
    else if (p === 'hl') h = `<div class="opt-row"><button class="sw none" data-hl="" aria-label="${esc(t('fmt.none'))}">${icon('ban')}</button>${HL_COLORS.map(c => `<button class="sw" data-hl="hl-${c}" aria-label="${esc(t('fmt.marker') + ' ' + t('color.' + c))}"><mark class="hl-${c}">가</mark></button>`).join('')}</div>
      <div class="opt-row"><span class="opt-l">${esc(t('fmt.background'))}</span>${HL_COLORS.map(c => `<button class="sw" data-hl="bg-${c}" aria-label="${esc(t('fmt.background') + ' ' + t('color.' + c))}"><mark class="bg-${c}">가</mark></button>`).join('')}</div>`;
    else if (p === 'size') h = `<div class="opt-row sizes">${[['s', 's'], ['', 'm'], ['l', 'l'], ['xl', 'xl']].map(([v, k]) => `<button class="sz" data-size="${v}"><span class="fs-${k}">가</span><small>${esc(t('size.' + k))}</small></button>`).join('')}</div>`;
    else if (p === 'spacing') { const sp = entrySpacing(this.e, S.prefs); h = `<div class="opt-row sizes spacings">${SPACINGS.map(v => `<button class="sz ${sp === v ? 'on' : ''}" data-sp="${v}"><span class="sp-ic sp-ic-${v}" aria-hidden="true"><i></i><i></i><i></i></span><small>${esc(t('spacing.' + v))}</small></button>`).join('')}</div>`; }
    else if (p === 'tpl') h = `<div class="tpl-head"><b>${esc(t('tpl.title'))}</b><span>${esc(t('tpl.sub'))}</span></div><div class="tpl-grid">${TEMPLATES.map((x, i) => `<button class="tpl-card" data-tpl="${x.id}" style="--i:${i}"><span class="tpl-ic">${icon(x.icon)}</span><b>${esc(x.name[LANG] || x.name.en)}</b><small>${esc(x.desc[LANG] || x.desc.en)}</small></button>`).join('')}</div>`;
    else if (p === 'icon' || p === 'emoji') {
      const sets = p === 'icon' ? ICON_SETS : EMOJI_SETS; const keys = Object.keys(sets); let cur = ls.get('kept.pick.' + p, keys[0]); if (!sets[cur]) cur = keys[0];
      const list = k => p === 'icon' ? sets[k] : sets[k].split(' ');
      h = `<div class="opt-pick"><div class="ptabs">${this.panelMode === 'kb' ? `<button class="kb-back" data-panel="${p}" aria-label="${esc(t('fmt.backToKeyboard'))}">${icon('keyboard')}</button>` : ''}${keys.map(k => `<button data-tab="${k}" class="${k === cur ? 'on' : ''}">${esc(t('pick.' + k))}</button>`).join('')}${this.panelMode === 'kb' ? '' : `<input class="opt-q" data-q placeholder="${esc(t('common.search'))}" aria-label="${esc(t('common.search'))}">`}</div>
        <div class="pgrid ${p}">${list(cur).map(v => p === 'icon' ? `<button data-v="${v}" aria-label="${esc(v)}">${icon(v)}</button>` : `<button data-v="${v}">${v}</button>`).join('')}</div></div>`;
    }
    this.el.root.style.setProperty('--tools-h', this.el.tools.offsetHeight + 'px');
    const host = p.startsWith('prop:') ? this.el.dslot : this.el.panelEl;
    if (o.parentNode !== host) { if (host === this.el.dslot) host.appendChild(o); else host.insertBefore(o, this.el.tools); }
    o.innerHTML = h; o.hidden = false; o.className = 'ed-opt mode-' + this.panelMode + (p.startsWith('prop:') ? ' is-prop' : '');
    this.el.root.classList.add('panel-open'); this.el.root.classList.toggle('panel-kb', this.panelMode === 'kb');
    requestAnimationFrame(() => { if (this.panelMode === 'over') this.el.root.style.setProperty('--opt-h', o.offsetHeight + 'px'); else if (this.panelMode === 'prop') o.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); this.ensureCaret(); });
    const q = o.querySelector('[data-q]');
    if (q) q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase(); const sets = p === 'icon' ? ICON_SETS : EMOJI_SETS; const all = Object.keys(sets).flatMap(k => p === 'icon' ? sets[k] : sets[k].split(' '));
      const hit = !v ? null : (p === 'icon' ? all.filter(n => n.includes(v) || (ICON_KW[n] || '').includes(v)) : all.filter(x => (EMOJI_KW[x] || '').includes(v)));
      if (hit) o.querySelector('.pgrid').innerHTML = [...new Set(hit)].map(x => p === 'icon' ? `<button data-v="${x}">${icon(x)}</button>` : `<button data-v="${x}">${x}</button>`).join('') || `<div class="opt-l" style="grid-column:1/-1;padding:14px">${esc(t('common.noResults'))}</div>`;
    });
  },
  /* where to insert: live caret, or the remembered one while a picker replaces the keyboard */
  insertRange() {
    if (this.panelMode === 'kb') { let r = this.savedRange; if (!r || !r.startContainer.isConnected || !this.inBody(r.startContainer)) { this.ensureBlock(); const C = [...this.el.body.querySelectorAll('p,li,h2,h3,blockquote,div')].filter(c => Rich.isContainer(c)).pop() || this.el.body; const pp = Rich.offsetToPos(C, 1e9); r = document.createRange(); r.setStart(pp.node, pp.offset); } r = r.cloneRange(); r.collapse(false); return r; }
    this.focusKeep(); this.ensureBlock(); const s = getSelection(); if (!s.rangeCount) return null; if (!s.isCollapsed) s.collapseToEnd(); return s.getRangeAt(0);
  },
  placeCaret(res) {
    if (this.panelMode === 'kb') { const r = document.createRange(); r.setStart(res.caret.node, res.caret.offset); r.collapse(true); this.savedRange = r; this.showGhostCaret(); }
    else this.setRange(res);
  },
  showGhostCaret() { // a visible caret while the keyboard is replaced by a picker
    $$('.ghost-caret', this.el.body).forEach(n => n.remove()); const r = this.savedRange; if (!r) return;
    const rect = r.getBoundingClientRect(); const host = this.el.scroll; const hr = host.getBoundingClientRect(); if (!rect.height && !rect.left) return;
    const g = document.createElement('i'); g.className = 'ghost-caret'; g.style.cssText = `top:${rect.top - hr.top + host.scrollTop}px;left:${rect.left - hr.left}px;height:${rect.height || 20}px`;
    host.querySelector('.ghost-host')?.remove(); const box = document.createElement('div'); box.className = 'ghost-host'; box.appendChild(g); host.appendChild(box);
  },
  insertIcon(name) {
    if (!this.ready()) return;
    const r = this.insertRange(); if (!r) return; this.histNow();
    const res = Rich.insertIcon(this.el.body, r, name); if (res) this.placeCaret(res);
    haptic(5); this.afterFmt();
  },
  insertText(txt) {
    if (!this.ready()) return;
    if (this.panelMode !== 'kb') { this.focusKeep(); this.histNow(); document.execCommand('insertText', false, txt); haptic(5); this.afterFmt(); return; }
    const r = this.insertRange(); this.histNow(); let node = r.startContainer, off = r.startOffset;
    if (node.nodeType !== 3) { const tn = document.createTextNode(''); r.insertNode(tn); node = tn; off = 0; }
    node.insertData(off, txt); this.placeCaret({ caret: { node, offset: off + txt.length } }); haptic(5); this.afterFmt();
  },

  /* ---------- typing ---------- */
  afterTyping(e) {
    this.touched = true; this.el.scroll.querySelector('.ghost-host')?.remove();
    const s = getSelection();
    if (s.anchorNode && Rich.scrubZW(s.anchorNode) && this.pending === s.anchorNode) this.pending = null;
    if (this.pending && this.pending.isConnected && this.pending.nodeValue.replace(ZWRE, '')) this.pending = null;
    this.ensureBlock();
    this.mdShortcut(e);
  },
  keys(e) {
    const mod = e.metaKey || e.ctrlKey; const k = e.key.toLowerCase();
    if (mod && !e.shiftKey && k === 'z') { e.preventDefault(); return this.undo(); }
    if (mod && ((e.shiftKey && k === 'z') || k === 'y')) { e.preventDefault(); return this.redo(); }
    if (mod && !e.shiftKey && ['b', 'i', 'u'].includes(k)) { e.preventDefault(); return this.mark(k); }
    if (mod && e.shiftKey && k === 'x') { e.preventDefault(); return this.mark('s'); }
    if (mod && e.shiftKey && k === 'h') { e.preventDefault(); return this.mark('hl', this.state?.hl ? null : this.last.hl); }
    if (mod && e.shiftKey && e.code === 'Digit8') { e.preventDefault(); return this.cmd('ul'); }
    if (mod && e.shiftKey && e.code === 'Digit7') { e.preventDefault(); return this.cmd('ol'); }
    if (mod && e.shiftKey && e.code === 'Digit9') { e.preventDefault(); return this.cmd('quote'); }
    if (mod && e.shiftKey && k === 'e') { e.preventDefault(); return this.togglePanel('emoji'); }
    if (mod && e.shiftKey && k === 'i') { e.preventDefault(); return this.togglePanel('icon'); }
    if (mod && k === 's') { e.preventDefault(); this.commit.flush(); Sync.schedule(10); this.setStatus(this.el.status.dataset.s, true); }
    if (e.key === 'Tab') { const li = this.closestBlock()?.closest('li'); if (li) { e.preventDefault(); this.histNow(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); this.afterFmt(); } }
    if (e.key === 'Escape' && this.panel) { e.stopPropagation(); this.closePanel(); this.updateToolState(); }
    else if (e.key === 'Escape' && this.drawerOpen) { e.stopPropagation(); this.toggleDrawer(false); }
  },
  paste(e) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html'), txt = e.clipboardData.getData('text/plain');
    this.focusKeep(); this.histNow();
    if (html) { const clean = sanitizeHTML(html.replace(/<!--[\s\S]*?-->/g, '')); document.execCommand('insertHTML', false, clean); hydrateIcons(this.el.body); }
    else if (txt) document.execCommand('insertText', false, txt);
    if (!html && !txt && e.clipboardData.files?.length) toast(t('ed.noImages'));
    this.ensureBlock(); this.afterFmt();
  },
  mdShortcut(e) {
    if (e.inputType !== 'insertText' || e.data !== ' ') return;
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return;
    const n = s.anchorNode; if (!n || n.nodeType !== 3) return;
    const block = (n.parentNode.closest && n.parentNode.closest('p,div,li,blockquote,h2,h3')) || this.el.body;
    if (block === this.el.body || block.closest('li')) return;
    const lr = document.createRange(); lr.setStart(block, 0); lr.setEnd(n, s.anchorOffset);
    const pre = lr.toString().replace(/ /g, ' ').replace(ZWRE, '');
    const m = pre.match(/^(\s*)([-*•]|1\.|>|#{1,2}) $/); if (!m) return;
    const raw = n.nodeValue.slice(0, s.anchorOffset);
    if (raw.replace(ZWRE, '').replace(/ /g, ' ').length < pre.length) return;
    const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, s.anchorOffset); s.removeAllRanges(); s.addRange(r);
    document.execCommand('delete');
    const cmd = { '-': 'insertUnorderedList', '*': 'insertUnorderedList', '•': 'insertUnorderedList', '1.': 'insertOrderedList' }[m[2]];
    if (cmd) document.execCommand(cmd); else if (m[2] === '>') document.execCommand('formatBlock', false, 'blockquote'); else document.execCommand('formatBlock', false, m[2] === '#' ? 'h2' : 'h3');
    this.ensureBlock(); this.updateToolState();
  },

  /* ---------- history (own stack so formatting undoes cleanly) ---------- */
  snap() { return { html: this.el.body.innerHTML, sel: this.getSelOffsets() }; },
  histNow() {
    this.histLater.cancel?.();
    const s = this.snap(); const cur = this.hist[this.hidx];
    if (cur && cur.html === s.html) { cur.sel = s.sel || cur.sel; return; }
    this.hist = this.hist.slice(0, this.hidx + 1); this.hist.push(s); if (this.hist.length > 300) this.hist.shift(); this.hidx = this.hist.length - 1;
    this.updateUndo();
  },
  updateUndo() { $$('[data-cmd="undo"]').forEach(x => x.disabled = this.hidx <= 0); $$('[data-cmd="redo"]').forEach(x => x.disabled = this.hidx >= this.hist.length - 1); },
  histLater: null,
  apply(sn) { this.el.body.innerHTML = sn.html; hydrateIcons(this.el.body); this.focusKeep(); if (sn.sel) this.setSelOffsets(sn.sel); this.pending = null; this.touched = true; this.changed(); this.updateToolState(); this.updateUndo(); },
  undo() { this.histNow(); if (this.hidx > 0) { this.hidx--; this.apply(this.hist[this.hidx]); haptic(5); } },
  redo() { if (this.hidx < this.hist.length - 1) { this.hidx++; this.apply(this.hist[this.hidx]); haptic(5); } },

  /* ---------- swipe the sheet down to close (phones) ---------- */
  bindDrag() {
    const panel = this.el.panelEl; let y0 = null, dy = 0, t0 = 0;
    const start = e => { if (!isNarrow() || e.target.closest('button,input,textarea,select')) return; y0 = e.clientY; dy = 0; t0 = Date.now(); panel.style.transition = 'none'; };
    const move = e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; };
    const end = () => { if (y0 == null) return; panel.style.transition = ''; const fast = dy > 60 && Date.now() - t0 < 250; if (dy > 130 || fast) { panel.style.transform = `translateY(100%)`; this.close(); } else panel.style.transform = ''; y0 = null; };
    [panel.querySelector('.ed-grab'), panel.querySelector('.ed-top')].forEach(h => { h.addEventListener('pointerdown', start); });
    addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
  },
  highlight(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return;
    const ranges = []; const w = document.createTreeWalker(this.el.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const v = n.nodeValue.toLowerCase(); words.forEach(word => { let i = 0; while ((i = v.indexOf(word, i)) > -1) { const r = new Range(); r.setStart(n, i); r.setEnd(n, i + word.length); ranges.push(r); i += word.length; } }); }
    if (ranges.length) { CSS.highlights.set('search', new Highlight(...ranges)); setTimeout(() => ranges[0].startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }
  },
  autosize() { const t = this.el.title; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
};
Editor.commit = debounce(() => Editor.doCommit(), 450);
Editor.histLater = debounce(() => Editor.histNow(), 600);

export { Editor, ICON_SETS, haptic, isNarrow, isTouch };
