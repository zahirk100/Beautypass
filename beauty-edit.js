(() => {
  const section = document.querySelector('.beauty-edit');
  if (!section) return;

  const page = document.documentElement;
  const canOpenDialog = typeof HTMLDialogElement !== 'undefined' &&
    typeof HTMLDialogElement.prototype.showModal === 'function';
  if (canOpenDialog) {
    section.querySelectorAll('[data-edit-open]').forEach(button => {
      button.disabled = false;
      button.addEventListener('click', () => {
        // The shared mobile action follows the currently visible category.
        const dialog = document.getElementById(button.dataset.editOpen);
        if (!dialog || !section.contains(dialog) || dialog.open) return;
        dialog.showModal();
        page.classList.add('bp-edit-dialog-open');
      });
    });
    section.querySelectorAll('.edit-dialog').forEach(dialog => {
      dialog.querySelector('[data-edit-close]').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => page.classList.remove('bp-edit-dialog-open'));
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
      });
      dialog.querySelectorAll('a[href="#invitation"]').forEach(link => {
        link.addEventListener('click', () => dialog.close());
      });
    });
  }

  const gallery = section.querySelector('.edit-gallery');
  const scenes = [...section.querySelectorAll('.edit-scene')];
  const links = [...section.querySelectorAll('.edit-index-nav a')];
  const controls = section.querySelector('.edit-lookbook-controls');
  const action = controls?.querySelector('[data-edit-open]');
  if (!gallery || !scenes.length || !controls || !action) return;

  const count = controls.querySelector('.edit-count');
  const status = controls.querySelector('.edit-status');
  const mobile = matchMedia('(max-width: 900px), (orientation: portrait)');
  let active = Math.max(0, scenes.findIndex(scene => `#${scene.id}` === location.hash));
  let scrollFrame = 0;
  let selecting = false;
  let settleTimer;

  function readPosition() {
    const nearest = scenes.reduce((best, scene, index) =>
      Math.abs(scene.offsetLeft - gallery.scrollLeft) < Math.abs(scenes[best].offsetLeft - gallery.scrollLeft) ? index : best, 0);
    if (active !== nearest) { active = nearest; update(true); }
  }
  function settle() {
    clearTimeout(settleTimer);
    selecting = false;
    if (mobile.matches) readPosition();
  }

  function update(announce = false) {
    scenes.forEach((scene, index) => {
      const hidden = mobile.matches && index !== active;
      if (hidden && scene.contains(document.activeElement)) gallery.focus({preventScroll: true});
      scene.inert = hidden;
      if (mobile.matches) scene.setAttribute('aria-roledescription', 'slide');
      else scene.removeAttribute('aria-roledescription');
    });
    links.forEach((link, index) => {
      if (mobile.matches && index === active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    const category = scenes[active].querySelector('[data-edit-open]');
    action.dataset.editOpen = category.dataset.editOpen;
    action.setAttribute('aria-controls', category.dataset.editOpen);
    action.setAttribute('aria-label', category.getAttribute('aria-label'));
    count.textContent = `${String(active + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
    controls.style.setProperty('--edit-active', active);
    if (announce && mobile.matches) status.textContent = `${active + 1} of ${scenes.length}: ${category.textContent.trim()}`;
  }

  function select(index, animate = true) {
    active = Math.max(0, Math.min(index, scenes.length - 1));
    update(animate);
    if (!mobile.matches) return;
    selecting = true;
    clearTimeout(settleTimer);
    // Direct category choices switch immediately; native swipes retain their
    // own momentum. This also keeps a rapid treatment-button tap deterministic.
    gallery.scrollTo({left: scenes[active].offsetLeft, behavior: 'instant'});
    // Also settle when the target was already aligned and no scroll event fires.
    settleTimer = setTimeout(settle, 100);
  }

  function configure() {
    section.toggleAttribute('data-edit-lookbook', mobile.matches);
    links.forEach(link => {
      const full = link.querySelector('.edit-index-full').textContent.trim();
      const short = link.querySelector('.edit-index-short').textContent.trim();
      link.setAttribute('aria-label', mobile.matches && short !== full ? `${short}: ${full}` : full);
    });
    section.querySelector('.edit-swipe-hint').hidden = !mobile.matches;
    controls.hidden = !mobile.matches || !canOpenDialog;
    if (mobile.matches) {
      gallery.tabIndex = 0;
      gallery.setAttribute('role', 'region');
      gallery.setAttribute('aria-roledescription', 'carousel');
      gallery.setAttribute('aria-label', 'Beauty treatments. Swipe or use the left and right arrow keys to explore five categories.');
      select(active, false);
    } else {
      gallery.removeAttribute('tabindex');
      gallery.removeAttribute('role');
      gallery.removeAttribute('aria-label');
      gallery.removeAttribute('aria-roledescription');
      update();
    }
  }

  links.forEach((link, index) => link.addEventListener('click', event => {
    if (!mobile.matches) return;
    event.preventDefault();
    select(index);
  }));
  gallery.addEventListener('keydown', event => {
    if (!mobile.matches || event.target !== gallery) return;
    const next = {ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: scenes.length - 1}[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  });
  gallery.addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 120);
    if (!mobile.matches || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!selecting) readPosition();
    });
  }, {passive: true});
  gallery.addEventListener('scrollend', settle);
  ['pointerdown', 'touchstart', 'wheel'].forEach(type => {
    gallery.addEventListener(type, () => { selecting = false; }, {passive: true});
  });
  window.addEventListener('hashchange', () => {
    const index = scenes.findIndex(scene => `#${scene.id}` === location.hash);
    if (index >= 0 && mobile.matches) select(index, false);
  });
  mobile.addEventListener('change', configure);
  configure();
  if (typeof ResizeObserver !== 'undefined') {
    let width = gallery.clientWidth;
    new ResizeObserver(() => {
      if (gallery.clientWidth === width) return;
      width = gallery.clientWidth;
      if (mobile.matches) select(active, false);
    }).observe(gallery);
  }
})();
