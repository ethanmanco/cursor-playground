import { CATEGORY_LABELS, CATEGORY_ORDER, type Effect, type SettingDef, type Values } from '../engine/types';

export interface EffectState {
  on: boolean;
  values: Values;
}

export interface PanelOptions {
  root: HTMLElement;
  effects: Effect[];
  state: Map<string, EffectState>;
  reducedMotion: boolean;
  onToggle(effect: Effect, on: boolean): void;
  onChange(effect: Effect, key: string, value: number | string): void;
}

export interface Panel {
  /** Re-sync every control with the current state (after presets or links). */
  refresh(): void;
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
  const { root, effects, state } = opts;
  const narrow = matchMedia('(max-width: 720px)');
  const syncers: (() => void)[] = [];

  // Header: title, live count, and the collapse button (always shown on phones).
  const count = el('span', { class: 'count' });
  const toggle = el(
    'button',
    { class: 'panel-toggle', type: 'button', 'aria-controls': 'panel-body' },
    el('span', { class: 'panel-title' }, 'Effects'),
    count,
    el('span', { class: 'chevron', 'aria-hidden': 'true' }),
  );
  const allOff = el('button', { class: 'ghost', type: 'button' }, 'Turn all off');
  const body = el('div', { class: 'panel-body', id: 'panel-body' });

  const setOpen = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    root.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  setOpen(!narrow.matches);
  narrow.addEventListener('change', (e) => setOpen(!e.matches));

  root.append(el('div', { class: 'panel-head' }, toggle), body);

  if (opts.reducedMotion) {
    body.append(
      el(
        'p',
        { class: 'notice', role: 'status' },
        el('strong', {}, 'Motion is off for now. '),
        'Your device asks for less motion, so every effect starts switched off. Turn on any effect below when you are ready.',
      ),
    );
  }

  const tools = el('div', { class: 'tools' }, allOff);
  body.append(tools);

  allOff.addEventListener('click', () => {
    for (const fx of effects) {
      const st = state.get(fx.id)!;
      if (st.on) {
        st.on = false;
        opts.onToggle(fx, false);
      }
    }
    refresh();
  });

  for (const cat of CATEGORY_ORDER) {
    const list = effects.filter((e) => e.category === cat);
    if (!list.length) continue;
    const group = el('fieldset', { class: `group cat-${cat}` }, el('legend', {}, CATEGORY_LABELS[cat]));
    for (const fx of list) group.append(effectCard(fx));
    body.append(group);
  }

  function effectCard(fx: Effect): HTMLElement {
    const st = state.get(fx.id)!;
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
      const out = el('output', { for: id, class: 'value' });
      const input =
        def.kind === 'range'
          ? el('input', {
              type: 'range',
              id,
              min: String(def.min),
              max: String(def.max),
              step: String(def.step),
            })
          : el('input', { type: 'color', id });
      input.addEventListener('input', () => {
        const v = def.kind === 'range' ? Number(input.value) : input.value;
        st.values[def.key] = v;
        out.textContent = fmt(def, v);
        opts.onChange(fx, def.key, v);
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

    sw.addEventListener('change', () => {
      st.on = sw.checked;
      opts.onToggle(fx, sw.checked);
      sync();
      updateCount();
    });

    const sync = () => {
      sw.checked = st.on;
      card.classList.toggle('is-on', st.on);
      settings.hidden = !st.on;
    };
    syncers.push(sync);
    return card;
  }

  function updateCount() {
    const n = effects.filter((e) => state.get(e.id)!.on).length;
    count.textContent = n ? `${n} on` : 'all off';
    allOff.disabled = n === 0;
  }

  function refresh() {
    for (const s of syncers) s();
    updateCount();
  }

  refresh();
  return { refresh };
}
