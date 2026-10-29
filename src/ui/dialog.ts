export function activityDialog(id: string, title: string, content: string, docked=false) {
  const dialog = document.createElement('dialog');
  dialog.id = id;
  dialog.className = 'activity-dialog';
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  // Callers supply authored markup only. User content is always assigned with textContent/value.
  dialog.innerHTML = `<header><span class="eyebrow">LITTLE ELSEWHERE</span><button class="plain-close" data-close aria-label="Close ${title}" autofocus>×</button></header><h2 id="${id}-title">${title}</h2>${content}<button class="wander-button" data-close>Back to the world</button>`;
  document.querySelector('#app')!.append(dialog);
  let returnFocus: HTMLElement | null = null;
  dialog.querySelectorAll<HTMLElement>('[data-close]').forEach(button => button.onclick = () => dialog.close());
  dialog.addEventListener('close', () => {
    if(docked){document.body.classList.remove('activity-docked');window.dispatchEvent(new Event('resize'));}
    returnFocus?.focus();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close(); }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll<HTMLElement>('button,input,textarea,select,summary,a[href]')]
      .filter(control => control.getClientRects().length && !control.hasAttribute('disabled'));
    const first = controls[0], last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  return { dialog, open: (trigger: HTMLElement) => {
    returnFocus = trigger;
    if(docked){document.body.classList.add('activity-docked');window.dispatchEvent(new Event('resize'));}
    dialog.showModal();
  } };
}

export function localStorageOrUnavailable(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
