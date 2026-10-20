(() => {
  const tour = document.querySelector('.store-tour');
  if (!tour) return;
  const track = tour.querySelector('.tour-track');
  const scenes = [...tour.querySelectorAll('.tour-scene')];
  const chapters = [...tour.querySelectorAll('.tour-chapters a')];
  const previous = tour.querySelector('[data-tour-previous]');
  const next = tour.querySelector('[data-tour-next]');
  const status = tour.querySelector('.tour-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let pendingFrame = false;
  let settleTimer;
  let target = null;
  let width = track.clientWidth;

  const clamp = index => Math.max(0, Math.min(scenes.length - 1, index));
  function setActive(index, announce = false) {
    active = clamp(index);
    chapters.forEach((chapter, i) => {
      if (i === active) chapter.setAttribute('aria-current', 'true');
      else chapter.removeAttribute('aria-current');
      scenes[i].inert = i !== active;
    });
    previous.disabled = active === 0;
    next.disabled = active === scenes.length - 1;
    const announcement = `${active + 1} van ${scenes.length} — ${scenes[active].dataset.tourName}`;
    if (announce && status.textContent !== announcement) status.textContent = announcement;
  }
  function sync() {
    const nearest = clamp(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
    setActive(nearest, true);
    pendingFrame = false;
  }
  function goTo(index) {
    target = clamp(index);
    track.scrollTo({left: scenes[target].offsetLeft, behavior: reducedMotion.matches ? 'auto' : 'smooth'});
    // A request for the current panel need not fire a scroll event.
    if (Math.abs(track.scrollLeft - scenes[target].offsetLeft) < 2) {
      setActive(target, true);
      target = null;
    }
  }

  chapters.forEach((chapter, index) => chapter.addEventListener('click', event => {
    event.preventDefault();
    goTo(index);
  }));
  previous.addEventListener('click', () => goTo((target ?? active) - 1));
  next.addEventListener('click', () => goTo((target ?? active) + 1));
  track.addEventListener('pointerdown', () => {target = null;}, {passive: true});
  track.addEventListener('scroll', () => {
    if (!pendingFrame) {
      pendingFrame = true;
      window.requestAnimationFrame(sync);
    }
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {target = null; sync();}, 160);
  }, {passive: true});
  tour.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('.tour-copy')) return;
    const keys = {ArrowLeft: (target ?? active) - 1, ArrowRight: (target ?? active) + 1, Home: 0, End: scenes.length - 1};
    if (!(event.key in keys)) return;
    event.preventDefault();
    goTo(keys[event.key]);
  });
  const preservePanelOnResize = () => {
    if (track.clientWidth === width) return;
    width = track.clientWidth;
    target = null;
    track.scrollTo({left: scenes[active].offsetLeft, behavior: 'auto'});
  };
  if ('ResizeObserver' in window) new ResizeObserver(preservePanelOnResize).observe(track);
  else window.addEventListener('resize', preservePanelOnResize);
  tour.querySelector('.tour-direction').hidden = false;
  setActive(0);
  window.addEventListener('pageshow', sync);
})();
