import { CATEGORY_LABELS, CATEGORY_ORDER, type Effect, type SettingDef } from '../engine/types';
import type { App } from '../state/app';
import { PRESETS, randomSetup } from '../state/presets';
import { decodeSetup, encodeSetup, type Setup } from '../state/setup';
import { copyText, showManualCopy, snippetFor } from './copy';

export interface PanelOptions {
  root: HTMLElement;
  app: App;
  reducedMotion: boolean;
  /** Returns the full share link for the current setup. */
  shareLink(): string;
  /** Saves a PNG of the scene. Resolves false if it could not. */
  savePicture(): Promise<boolean>;
  /** Whether autopilot may run when the page sits idle. */
  autopilot: { get(): boolean; set(on: boolean): void };
}

export interface Panel {
  /** Show (or clear) the "this link has effects, turn them on" notice. */
  showPending(setup: Setup | null): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

const fmt = (def: SettingDef, v: number | string) =>
  def.kind === 'range' ? `${v}${def.unit ?? ''}` : String(v).toUpperCase();

export function buildPanel(opts: PanelOptions): Panel {
  const { root, app } = opts;
  const effects = app.effects;
  const narrow = matchMedia('(max-width: 720px)');
  const syncers: (() => void)[] = [];

  // Screen reader announcements ("Link copied", and so on).
  const live = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const announce = (msg: string) => {
    live.textContent = '';
    window.setTimeout(() => (live.textContent = msg), 50);
  };

  /** Briefly swap a button's label to confirm an action. */
  const flash = (btn: HTMLButtonElement, msg: string) => {
    const label = btn.dataset.label ?? btn.textContent ?? '';
    btn.dataset.label = label;
    btn.textContent = msg;
    btn.classList.add('done');
    clearTimeout(Number(btn.dataset.timer));
    btn.dataset.timer = String(
      window.setTimeout(() => {
        btn.textContent = label;
        btn.classList.remove('done');
      }, 1600),
    );
    announce(msg);
  };

  // ----- Header -----
  const count = el('span', { class: 'count' });
  const toggle = el(
    'button',
    { class: 'panel-toggle', type: 'button', 'aria-controls': 'panel-body' },
    el('span', { class: 'panel-title' }, 'Effects'),
    count,
    el('span', { class: 'chevron', 'aria-hidden': 'true' }),
  );
  const body = el('div', { class: 'panel-body', id: 'panel-body' });
  const setOpen = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    root.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  setOpen(!narrow.matches);
  narrow.addEventListener('change', (e) => setOpen(!e.matches));
  root.append(el('div', { class: 'panel-head' }, toggle), body, live);

  // ----- Notices -----
  if (opts.reducedMotion) {
    body.append(
      el(
        'p',
        { class: 'notice' },
        el('strong', {}, 'Motion is off for now. '),
        'Your device asks for less motion, so every effect starts switched off. Turn on any effect below when you are ready.',
      ),
    );
  }
  const pendingBox = el('div', { class: 'notice pending', hidden: '' });
  body.append(pendingBox);

  // ----- Quick start: presets, randomize, share -----
  const presetRow = el('div', { class: 'chips' });
  for (const preset of PRESETS) {
    const b = el('button', { type: 'button', class: 'chip' }, preset.name);
    b.addEventListener('click', () => {
      app.apply(preset.setup);
      announce(`${preset.name} preset on`);
    });
    presetRow.append(b);
  }
  const random = el('button', { type: 'button', class: 'chip chip-random' }, 'Randomize');
  random.addEventListener('click', () => {
    app.apply(randomSetup(effects));
    const names = effects.filter((fx) => app.get(fx).on).map((fx) => fx.name);
    announce(`Random mix: ${names.join(', ')}`);
  });
  presetRow.append(random);

  const share = el('button', { type: 'button', class: 'action action-primary' }, 'Copy share link');
  share.addEventListener('click', async () => {
    const link = opts.shareLink();
    if (await copyText(link)) flash(share, 'Link copied!');
    else showManualCopy('Your share link', link);
  });
  const save = el('button', { type: 'button', class: 'action' }, 'Save picture');
  save.addEventListener('click', async () => {
    flash(save, (await opts.savePicture()) ? 'Saved!' : 'Could not save');
  });

  const pilot = el('input', { type: 'checkbox', role: 'switch', id: 'autopilot', class: 'switch' });
  pilot.checked = opts.autopilot.get();
  pilot.addEventListener('change', () => opts.autopilot.set(pilot.checked));
  const pilotRow = el(
    'div',
    { class: 'option-row' },
    el(
      'label',
      { for: 'autopilot', class: 'fx-label' },
      el('span', { class: 'fx-name' }, 'Autopilot'),
      el('span', { class: 'fx-blurb' }, 'When nobody moves for a few seconds, a ghost cursor plays.'),
    ),
    pilot,
  );

  const allOff = el('button', { type: 'button', class: 'action' }, 'Turn all off');
  allOff.addEventListener('click', () => {
    app.apply({});
    announce('All effects off');
  });

  // Zen mode hides the panel for a clean view. Escape or the small
  // "Show panel" button brings it back.
  const hide = el('button', { type: 'button', class: 'action' }, 'Hide panel');
  const zenExit = el('button', { type: 'button', class: 'zen-exit', 'data-cp-keep-cursor': '' }, 'Show panel');
  document.body.append(zenExit);
  const setZen = (on: boolean) => {
    document.body.classList.toggle('zen', on);
    if (on) zenExit.focus();
    else hide.focus();
    announce(on ? 'Panel hidden. Press Escape to show it again.' : 'Panel shown');
  };
  hide.addEventListener('click', () => setZen(true));
  zenExit.addEventListener('click', () => setZen(false));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('zen')) setZen(false);
  });

  // My mixes: setups saved in this browser only.
  const MIX_KEY = 'cursor-playground:mixes';
  type Mix = { name: string; code: string };
  const loadMixes = (): Mix[] => {
    try {
      const v: unknown = JSON.parse(localStorage.getItem(MIX_KEY) ?? '[]');
      return Array.isArray(v)
        ? v.filter((m): m is Mix => !!m && typeof m.name === 'string' && typeof m.code === 'string').slice(0, 12)
        : [];
    } catch {
      return [];
    }
  };
  const storeMixes = (mixes: Mix[]) => {
    try {
      localStorage.setItem(MIX_KEY, JSON.stringify(mixes));
      return true;
    } catch {
      return false;
    }
  };
  const mixList = el('ul', { class: 'mix-list' });
  const renderMixes = () => {
    mixList.replaceChildren();
    const mixes = loadMixes();
    if (!mixes.length) {
      mixList.append(el('li', { class: 'mix-empty' }, 'Mixes you save show up here.'));
      return;
    }
    for (const m of mixes) {
      const use = el('button', { type: 'button', class: 'chip' }, m.name);
      use.addEventListener('click', () => {
        const setup = decodeSetup('#' + m.code, effects);
        if (setup) {
          app.apply(setup);
          announce(`${m.name} on`);
        }
      });
      const remove = el('button', { type: 'button', class: 'mix-remove', 'aria-label': `Remove ${m.name}` }, '×');
      remove.addEventListener('click', () => {
        storeMixes(loadMixes().filter((x) => x.code !== m.code));
        renderMixes();
        announce(`Removed ${m.name}`);
      });
      mixList.append(el('li', { class: 'mix' }, use, remove));
    }
  };
  const saveMix = el('button', { type: 'button', class: 'action' }, 'Save this mix');
  saveMix.addEventListener('click', () => {
    const on = effects.filter((fx) => app.get(fx).on);
    if (!on.length) return;
    const code = encodeSetup(app.current(), effects);
    const mixes = loadMixes();
    if (mixes.some((m) => m.code === code)) {
      flash(saveMix, 'Already saved');
      return;
    }
    const name = on.length <= 2 ? on.map((fx) => fx.name).join(' + ') : `${on[0].name} + ${on.length - 1} more`;
    const ok = storeMixes([{ name, code }, ...mixes].slice(0, 12));
    renderMixes();
    flash(saveMix, ok ? 'Saved!' : 'Could not save');
  });
  renderMixes();

  body.append(
    el(
      'section',
      { class: 'quick', 'aria-labelledby': 'presets-title' },
      el('h2', { id: 'presets-title', class: 'section-title' }, 'Try a preset'),
      presetRow,
      el('div', { class: 'actions' }, share, save),
      el('div', { class: 'actions' }, allOff, hide),
      pilotRow,
    ),
    el(
      'section',
      { class: 'quick mixes', 'aria-labelledby': 'mixes-title' },
      el('h2', { id: 'mixes-title', class: 'section-title' }, 'My mixes'),
      mixList,
      el('div', { class: 'actions' }, saveMix),
    ),
  );

  // ----- Effects by category -----
  for (const cat of CATEGORY_ORDER) {
    const list = effects.filter((e) => e.category === cat);
    if (!list.length) continue;
    const group = el('fieldset', { class: `group cat-${cat}` }, el('legend', {}, CATEGORY_LABELS[cat]));
    for (const fx of list) group.append(effectCard(fx));
    body.append(group);
  }

  function effectCard(fx: Effect): HTMLElement {
    const st = app.get(fx);
    const switchId = `fx-${fx.id}`;
    const settingsId = `fx-${fx.id}-settings`;
    const sw = el('input', {
      type: 'checkbox',
      role: 'switch',
      id: switchId,
      class: 'switch',
      'aria-describedby': `${switchId}-blurb`,
      'aria-controls': settingsId,
    });
    const settings = el('div', { class: 'settings', id: settingsId });
    const card = el(
      'div',
      { class: 'fx' },
      el(
        'div',
        { class: 'fx-row' },
        el(
          'label',
          { for: switchId, class: 'fx-label' },
          el('span', { class: 'fx-name' }, fx.name),
          el('span', { class: 'fx-blurb', id: `${switchId}-blurb` }, fx.blurb),
        ),
        sw,
      ),
      settings,
    );

    for (const def of fx.settings) {
      const id = `${switchId}-${def.key}`;
      if (def.kind === 'choice') {
        // A row of chips backed by real radio buttons (arrow keys work).
        const row = el('div', { class: 'choice-row' });
        const radios = def.options.map((o) => {
          const rid = `${id}-${o.value}`;
          const radio = el('input', { type: 'radio', name: id, id: rid, value: o.value, class: 'choice-input' });
          radio.addEventListener('change', () => {
            if (radio.checked) app.setValue(fx, def.key, o.value);
          });
          row.append(radio, el('label', { for: rid, class: 'choice-chip' }, o.label));
          return radio;
        });
        settings.append(el('fieldset', { class: 'setting setting-choice' }, el('legend', {}, def.label), row));
        syncers.push(() => {
          for (const r of radios) r.checked = r.value === st.values[def.key];
        });
        continue;
      }
      const out = el('output', { for: id, class: 'value' });
      const input =
        def.kind === 'range'
          ? el('input', { type: 'range', id, min: String(def.min), max: String(def.max), step: String(def.step) })
          : el('input', { type: 'color', id });
      input.addEventListener('input', () => {
        const v = def.kind === 'range' ? Number(input.value) : input.value;
        out.textContent = fmt(def, v);
        app.setValue(fx, def.key, v);
      });
      settings.append(
        el(
          'div',
          { class: `setting setting-${def.kind}` },
          el('div', { class: 'setting-head' }, el('label', { for: id }, def.label), out),
          input,
        ),
      );
      syncers.push(() => {
        const v = st.values[def.key];
        input.value = String(v);
        out.textContent = fmt(def, v);
      });
    }

    const copy = el('button', { type: 'button', class: 'copy-code' }, 'Copy code');
    copy.setAttribute('aria-label', `Copy code for ${fx.name}`);
    copy.addEventListener('click', async () => {
      let code: string;
      try {
        code = await snippetFor(fx, { ...st.values });
      } catch {
        flash(copy, 'Could not load code');
        return;
      }
      if (await copyText(code)) flash(copy, 'Code copied!');
      else showManualCopy(`Code for ${fx.name}`, code);
    });
    settings.append(copy);

    sw.addEventListener('change', () => app.setOn(fx, sw.checked));

    syncers.push(() => {
      sw.checked = st.on;
      card.classList.toggle('is-on', st.on);
      settings.hidden = !st.on;
    });
    return card;
  }

  function refresh() {
    for (const s of syncers) s();
    const n = app.onCount();
    count.textContent = n ? `${n} on` : 'all off';
    allOff.disabled = n === 0;
    saveMix.disabled = n === 0;
  }

  app.onChange((kind) => {
    if (kind === 'structure') refresh();
  });
  refresh();

  return {
    showPending(setup) {
      pendingBox.replaceChildren();
      const ids = setup ? Object.keys(setup) : [];
      pendingBox.hidden = ids.length === 0;
      if (!setup || !ids.length) return;
      const names = effects.filter((fx) => ids.includes(fx.id)).map((fx) => fx.name);
      const on = el('button', { type: 'button', class: 'action action-primary' }, 'Turn them on');
      on.addEventListener('click', () => {
        app.apply(setup);
        pendingBox.hidden = true;
        announce(`${names.length} effects on`);
      });
      pendingBox.append(
        el('p', {}, el('strong', {}, 'This link shares a setup: '), `${names.join(', ')}.`),
        on,
      );
    },
  };
}
