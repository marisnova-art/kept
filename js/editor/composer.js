/* Kept — Quick capture */
import { Editor } from './editor.js';
import { todayKey } from '../lib/utils.js';
import { V } from '../ui/router.js';

/* ---------- Quick capture = the editor in its aurora "capture" skin, same tools everywhere ---------- */
const Composer = {
  open(type) {
    const ty = type || V.capType || 'note'; const preset = { type: ty };
    if (ty === 'event') preset.meta = { date: V.selDay || todayKey(), time: '' };
    if (ty === 'todo') preset.meta = { due: V.selDay && V.selDay !== todayKey() ? V.selDay : '', done: false, priority: 0 };
    Editor.open(null, preset, { skin: 'capture' });
  }
};

export { Composer };
