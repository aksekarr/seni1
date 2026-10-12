// The creator writing shares the scene, without starting/stopping live audio.
// Its layout clock owns only framing and UI; expression clocks stay untouched.
export function createLandingInterface({ flow, face, reduce = false, host = window, doc = document }) {
  const byId = id => doc.getElementById(id);
  const toggle = byId('creator-toggle'), region = byId('creator-scene');
  const title = byId('creator-title'), closeButton = byId('creator-close');
  const emailButton = byId('creator-email'), emailStatus = byId('creator-email-status');
  const arrival = byId('arrival'), explore = byId('explore-menu');
  let open = false, fromArrival = false, timer = null, progress = 0, velocity = 0;
  let disposed = false, copying = false, copyAttempt = 0;
  const framing = { x: 0, y: 0, zoom: 1 };
  const point = { x: 0, y: 0 };
  let chunk = 0;
  for (const block of region.querySelectorAll('[data-reveal]')) {
    const text = block.textContent.trim(), words = text.split(/\s+/);
    const spoken = doc.createElement('span');
    spoken.className = 'sr-only'; spoken.textContent = text;
    block.replaceChildren(spoken);
    for (let i = 0; i < words.length; i += 3) {
      const span = doc.createElement('span');
      span.className = 'reveal-chunk';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--reveal-delay', `${chunk++ * 100}ms`);
      span.textContent = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
      block.appendChild(span);
    }
    chunk++;
  }
  region.style.setProperty('--links-delay', `${chunk * 100}ms`);

  function resetEmailCopy() {
    copyAttempt++;
    copying = false;
    emailStatus.textContent = '';
    emailButton.removeAttribute('aria-busy');
  }
  function showEmailStatus(message) {
    emailStatus.textContent = message;
    emailStatus.scrollIntoView?.({ block: 'nearest' });
  }
  async function copyEmail() {
    if (disposed || !open || copying) return;
    const attempt = ++copyAttempt, address = emailButton.dataset.email;
    copying = true;
    emailStatus.textContent = '';
    emailButton.setAttribute('aria-busy', 'true');
    try {
      const clipboard = host.navigator?.clipboard;
      if (typeof clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable');
      await clipboard.writeText(address);
      if (!disposed && open && attempt === copyAttempt) showEmailStatus('Email copied');
    } catch {
      if (!disposed && open && attempt === copyAttempt) showEmailStatus(`Couldn’t copy. Email: ${address}`);
    } finally {
      if (attempt === copyAttempt) {
        copying = false;
        emailButton.removeAttribute('aria-busy');
      }
    }
  }

  function close({ restore = true, focus = true } = {}) {
    resetEmailCopy();
    if (!open) return;
    open = false;
    if (timer !== null) host.clearTimeout(timer);
    toggle.setAttribute('aria-expanded', 'false');
    doc.body.dataset.creator = 'closing';
    region.inert = true;
    region.setAttribute('aria-hidden', 'true');
    arrival.inert = false;
    if (restore && fromArrival) flow.returnToNebula();
    fromArrival = false;
    face.setSceneAttention?.(null);
    timer = host.setTimeout(() => {
      timer = null;
      if (!open) { region.hidden = true; delete doc.body.dataset.creator; }
    }, reduce ? 0 : 200);
    render(flow.state);
    if (focus && !toggle.disabled) toggle.focus({ preventScroll: true });
  }
  function show() {
    if (disposed || toggle.disabled) return;
    if (open) { close(); return; }
    if (timer !== null) { host.clearTimeout(timer); timer = null; }
    resetEmailCopy();
    fromArrival = flow.state.form === 'nebula' && flow.state.phase === 'arrival';
    open = true;
    explore.open = false;
    region.hidden = false; region.inert = false; region.scrollTop = 0;
    region.removeAttribute('aria-hidden');
    toggle.setAttribute('aria-expanded', 'true');
    arrival.inert = true;
    doc.body.dataset.creator = 'open';
    title.focus({ preventScroll: true });
    flow.showCreator();
  }
  const dismiss = () => close();
  const exploreChanged = () => { if (explore.open) close({ restore: false, focus: false }); };
  const keydown = event => {
    if (event.key !== 'Escape') return;
    if (open) { event.preventDefault(); close(); }
    else if (explore.open) { explore.open = false; byId('explore-toggle').focus(); }
  };
  const outside = event => {
    if (explore.open && !explore.contains(event.target)) explore.open = false;
  };
  toggle.addEventListener('click', show);
  closeButton.addEventListener('click', dismiss);
  emailButton.addEventListener('click', copyEmail);
  explore.addEventListener('toggle', exploreChanged);
  doc.addEventListener('keydown', keydown);
  doc.addEventListener('pointerdown', outside);

  function render(view) {
    toggle.disabled = !open && ['booting', 'error', 'forming', 'loading', 'greeting', 'connecting', 'changing-form'].includes(view.phase);
    explore.hidden = ['arrival', 'error'].includes(view.phase);
    if (explore.hidden) explore.open = false;
  }
  render(flow.state);
  return { framing, close, render, get open() { return open; }, update(dt) {
    if (disposed) return;
    const target = open ? 1 : 0;
    if (reduce) { progress = target; velocity = 0; }
    else if (Number.isFinite(dt) && dt > 0) {
      const frequency = 7, decay = Math.exp(-frequency * dt);
      const offset = progress - target, tangent = velocity + frequency * offset;
      progress = target + (offset + tangent * dt) * decay;
      velocity = (velocity - frequency * tangent * dt) * decay;
      if (Math.abs(progress - target) < 1e-6 && Math.abs(velocity) < 1e-5) { progress = target; velocity = 0; }
    }
    const wide = host.innerWidth >= 760 && host.innerWidth / host.innerHeight > 1.25;
    framing.x = wide ? progress * .19 : 0;
    framing.y = wide ? 0 : progress * .22;
    framing.zoom = 1 - progress * (wide ? .14 : .38);
    point.x = wide ? .95 : .08;
    point.y = wide ? -.08 : -.85;
    face.setSceneAttention?.(open && flow.state.form === 'face' ? point : null);
  }, dispose() {
    if (disposed) return;
    disposed = true;
    close({ restore: false, focus: false });
    if (timer !== null) host.clearTimeout(timer);
    region.hidden = true;
    delete doc.body.dataset.creator;
    toggle.removeEventListener('click', show);
    closeButton.removeEventListener('click', dismiss);
    emailButton.removeEventListener('click', copyEmail);
    explore.removeEventListener('toggle', exploreChanged);
    doc.removeEventListener('keydown', keydown);
    doc.removeEventListener('pointerdown', outside);
  } };
}
