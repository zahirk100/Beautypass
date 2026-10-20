(() => {
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('#mobile-menu');
  const form = document.querySelector('#invitation-form');
  const formView = document.querySelector('.invitation-form-view');
  const successView = document.querySelector('.invitation-success');
  const header = document.querySelector('.site-header');
  const mobileViewport = window.matchMedia('(max-width: 760px)');
  let scrollPending = false;

  function updateHeader() {
    header.classList.toggle('is-scrolled', window.scrollY > 32);
    header.classList.toggle('is-menu-open', !mobileMenu.hidden);
    scrollPending = false;
  }

  function setMenu(open) {
    menuToggle.setAttribute('aria-expanded', String(open));
    mobileMenu.hidden = !open;
    menuToggle.textContent = open ? 'Sluit' : 'Menu';
    updateHeader();
  }

  header.classList.add('is-fixed');
  updateHeader();
  window.addEventListener('scroll', () => {
    if (scrollPending) return;
    scrollPending = true;
    window.requestAnimationFrame(updateHeader);
  }, { passive: true });
  window.addEventListener('pageshow', updateHeader);
  mobileViewport.addEventListener('change', event => {
    if (!event.matches) setMenu(false);
  });

  menuToggle.addEventListener('click', () => {
    setMenu(mobileMenu.hidden);
  });
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    setMenu(false);
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobileMenu.hidden) {
      setMenu(false);
      menuToggle.focus();
    }
  });
})();