/* Framework-independent progressive enhancement. No endpoint is invented.
 * Integrate by passing the existing signup handler to mount(...).
 */
(function (global) {
  'use strict';
  function mount(root, options = {}) {
    if (!root) throw new Error('BeautyPass section root is required.');
    if (root.dataset.bpEnhanced) throw new Error('BeautyPass sections already mounted.');
    const mode = options.mode || 'preview';
    if (mode !== 'preview' && mode !== 'live') throw new Error('Unsupported signup mode.');
    if (mode === 'live' && typeof options.submitFirstAccess !== 'function') {
      throw new Error('Connect the existing First access signup handler before enabling live mode.');
    }
    const tabs = [...root.querySelectorAll('[data-bp-tab]')];
    const panels = [...root.querySelectorAll('[data-bp-panel]')];
    const tablist = root.querySelector('[data-bp-tabs]');
    const media = global.matchMedia('(max-width: 760px)');
    let selected = tabs.some(t => t.dataset.bpTab === options.initialTopic) ? options.initialTopic : 'membership';
    const disposers = [];
    const listen = (el, event, fn) => { el.addEventListener(event, fn); disposers.push(() => el.removeEventListener(event, fn)); };
    function sync() {
      // The campaign now uses a static experience section. Retain tab support
      // for older previews without coupling signup to the presence of tabs.
      if (!tablist) return;
      if (media.matches) tablist.setAttribute('role', 'tablist');
      else tablist.removeAttribute('role');
      tabs.forEach(tab => {
        const active = tab.dataset.bpTab === selected;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', 'bp-panel-' + tab.dataset.bpTab);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      panels.forEach(panel => {
        const key = panel.dataset.bpPanel;
        panel.hidden = media.matches && key !== selected;
        panel.setAttribute('aria-labelledby', (media.matches ? 'bp-tab-' : 'bp-topic-') + key);
        if (media.matches) { panel.setAttribute('role', 'tabpanel'); panel.tabIndex = 0; }
        else { panel.removeAttribute('role'); panel.removeAttribute('tabindex'); }
      });
    }
    function select(key, focus) {
      selected = key;
      sync();
      if (focus) tabs.find(tab => tab.dataset.bpTab === key).focus();
    }
    tabs.forEach((tab, index) => {
      listen(tab, 'click', () => select(tab.dataset.bpTab, false));
      listen(tab, 'keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault(); select(tabs[next].dataset.bpTab, true);
      });
    });
    if (media.addEventListener) listen(media, 'change', sync);
    else { media.addListener(sync); disposers.push(() => media.removeListener(sync)); }

    const form = root.querySelector('[data-bp-form]');
    const input = form.querySelector('input[name=email]');
    const button = form.querySelector('[data-bp-submit]');
    const buttonText = form.querySelector('[data-bp-button-text]');
    const status = form.querySelector('[data-bp-status]');
    const idleText = buttonText.textContent;
    let pending = false;
    let complete = false;
    button.type = 'submit';
    const announce = (message, kind) => {
      status.hidden = false; status.textContent = message; status.dataset.kind = kind;
    };
    listen(input, 'input', () => {
      input.removeAttribute('aria-invalid');
      if (!complete && !pending) { status.hidden = true; status.textContent = ''; }
    });
    listen(form, 'submit', async event => {
      event.preventDefault();
      if (pending || complete) return;
      input.value = input.value.trim();
      if (!input.checkValidity()) {
        input.setAttribute('aria-invalid', 'true');
        announce('Vul een geldig e-mailadres in.', 'error'); input.focus(); return;
      }
      input.removeAttribute('aria-invalid');
      if (mode === 'preview') {
        announce('Dit is een ontwerpvoorbeeld. Je e-mailadres is niet verstuurd of opgeslagen.', 'preview');
        return;
      }
      pending = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
      buttonText.textContent = 'Even geduld…';
      announce('Je aanvraag wordt verstuurd.', 'pending');
      try {
        const result = await options.submitFirstAccess({ email: input.value });
        // A resolved promise alone is not evidence of a successful signup.
        if (!result || result.ok !== true) throw new Error('Signup was not confirmed.');
        complete = true; input.readOnly = true;
        buttonText.textContent = 'Check je e-mail';
        announce('Bevestig je aanmelding via de link in je e-mail.', 'success');
      } catch (_) {
        buttonText.textContent = idleText; button.disabled = false;
        announce('Aanmelden is nog niet gelukt. Probeer het opnieuw.', 'error');
      } finally {
        pending = false; form.removeAttribute('aria-busy');
      }
    });
    root.dataset.bpEnhanced = 'true'; sync();
    return {
      selectTopic(key) { if (tabs.some(t => t.dataset.bpTab === key)) select(key, false); },
      destroy() {
        disposers.forEach(fn => fn()); delete root.dataset.bpEnhanced;
        panels.forEach(panel => { panel.hidden = false; panel.removeAttribute('role'); panel.removeAttribute('tabindex'); panel.setAttribute('aria-labelledby', 'bp-topic-' + panel.dataset.bpPanel); });
        button.type = 'button';
      }
    };
  }
  global.BeautyPassSections = Object.freeze({ mount });
})(window);

const signupRoot = document.querySelector('[data-bp-sections]');
const signupForm = signupRoot.querySelector('[data-bp-form]');
const trapLabel = document.createElement('label');
trapLabel.hidden = true;
trapLabel.textContent = 'Laat dit veld leeg';
const trap = document.createElement('input');
trap.name = 'website';
trap.tabIndex = -1;
trap.autocomplete = 'off';
trapLabel.appendChild(trap);
signupForm.appendChild(trapLabel);
BeautyPassSections.mount(signupRoot, {
  mode: 'live',
  async submitFirstAccess({ email }) {
    const response = await fetch('/api/first-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, website: trap.value }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('Signup request failed');
    return response.json();
  }
});
