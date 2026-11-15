/**
 * Wrap each letter of a heading in its own span so effects can move it.
 * Screen readers still get the whole text from aria-label.
 */
export function splitHeading(heading: HTMLElement): void {
  if (heading.querySelector('.char')) return;
  const text = (heading.textContent ?? '').trim().replace(/\s+/g, ' ');
  heading.setAttribute('aria-label', text);
  heading.textContent = '';
  for (const word of text.split(' ')) {
    const w = document.createElement('span');
    w.className = 'word';
    w.setAttribute('aria-hidden', 'true');
    w.style.display = 'inline-block';
    w.style.whiteSpace = 'nowrap';
    for (const ch of word) {
      const c = document.createElement('span');
      c.className = 'char';
      c.style.display = 'inline-block';
      c.textContent = ch;
      w.append(c);
    }
    heading.append(w, ' ');
  }
}
