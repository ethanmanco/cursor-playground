import type { Effect, Values } from '../engine/types';

export const SITE_URL = 'https://ethanmanco.github.io/cursor-playground/';

const NOTES: Record<string, string> = {
  repel: ' * It moves the letters of the heading marked data-repel, or your first <h1>.\n',
};

/** A standalone script for one effect, with the current settings filled in. */
export async function snippetFor(fx: Effect, values: Values): Promise<string> {
  const { default: code } = await import('virtual:snippets');
  const body = code[fx.id];
  if (!body) throw new Error(`No snippet for ${fx.id}`);
  return (
    `/* Cursor Playground: ${fx.name}\n` +
    ` * ${SITE_URL}\n` +
    ` * Paste this inside a <script> tag at the end of your page's <body>.\n` +
    ` * It draws on a see-through layer that never blocks clicks, and it\n` +
    ` * stays off for visitors who prefer reduced motion.\n` +
    (NOTES[fx.id] ?? '') +
    ` */\n` +
    `(function (CPV) {\n${body}\n})(${JSON.stringify(values)});\n`
  );
}

/**
 * When the clipboard is blocked, show the text in a dialog so people can
 * still select and copy it themselves.
 */
export function showManualCopy(title: string, text: string): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'copy-dialog';
  dialog.setAttribute('aria-labelledby', 'copy-dialog-title');
  const heading = document.createElement('h2');
  heading.id = 'copy-dialog-title';
  heading.textContent = title;
  const hint = document.createElement('p');
  hint.textContent = 'Your browser blocked automatic copying. The text below is selected, so press Ctrl+C (or Cmd+C) to copy it.';
  const area = document.createElement('textarea');
  area.value = text;
  area.readOnly = true;
  area.rows = Math.min(12, text.split('\n').length + 1);
  area.setAttribute('aria-label', title);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'action';
  close.textContent = 'Done';
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  dialog.append(heading, hint, area, close);
  document.body.append(dialog);
  dialog.showModal();
  area.focus();
  area.select();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    // Some browsers leave the request hanging instead of refusing it.
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
    ]);
    return true;
  } catch {
    // Older browsers, or a page without clipboard permission.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
