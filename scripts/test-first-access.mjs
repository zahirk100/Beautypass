import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../beautypass-sections.js', import.meta.url), 'utf8');

// Minimal DOM boundary for exercising the async signup flow without sending mail.
class Element {
  hidden = false;
  disabled = false;
  readOnly = false;
  value = '';
  textContent = '';
  dataset = {};
  attributes = new Map();
  listeners = new Map();
  children = new Map();
  valid = true;
  focused = false;
  querySelector(selector) { return this.children.get(selector) || null; }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  checkValidity() { return this.valid; }
  focus() { this.focused = true; }
  async fire(name) {
    await Promise.all([...this.listeners.get(name) || []].map(callback => callback({ preventDefault() {} })));
  }
}

function setup(options = {}, { receipt = true } = {}) {
  const root = new Element();
  const form = new Element();
  const input = new Element();
  const button = new Element();
  const buttonText = new Element();
  const status = new Element();
  const confirmation = new Element();
  const title = new Element();
  const copy = new Element();
  const hint = new Element();
  const edit = new Element();
  buttonText.textContent = 'Ontvang je uitnodiging';
  status.hidden = true;
  confirmation.hidden = true;
  input.value = 'member@example.test';
  root.children.set('[data-bp-form]', form);
  for (const [selector, element] of [
    ['input[name=email]', input], ['[data-bp-submit]', button],
    ['[data-bp-button-text]', buttonText], ['[data-bp-status]', status],
  ]) form.children.set(selector, element);
  if (receipt) {
    for (const [selector, element] of [
      ['[data-bp-confirmation]', confirmation], ['[data-bp-confirmation-title]', title],
      ['[data-bp-confirmation-copy]', copy], ['[data-bp-confirmation-hint]', hint],
      ['[data-bp-edit-email]', edit],
    ]) root.children.set(selector, element);
  }
  const media = new Element();
  media.matches = false;
  const context = vm.createContext({ window: { matchMedia: () => media }, document: { querySelector: () => null } });
  vm.runInContext(source, context);
  const controller = context.window.BeautyPassSections.mount(root, {
    mode: 'live', submitFirstAccess: async () => ({ ok: true }), ...options,
  });
  return { root, form, input, button, buttonText, status, confirmation, title, copy, hint, edit, controller };
}

test('invalid email stays editable and never reaches the provider', async () => {
  let requests = 0;
  const ui = setup({ submitFirstAccess: async () => { requests++; } });
  ui.input.valid = false;
  await ui.form.fire('submit');
  assert.equal(requests, 0);
  assert.equal(ui.form.hidden, false);
  assert.equal(ui.input.attributes.get('aria-invalid'), 'true');
  assert.equal(ui.input.focused, true);
  assert.equal(ui.status.dataset.kind, 'error');
});

test('pending request locks the address and prevents duplicate submission', async () => {
  let resolve;
  let requests = 0;
  let sentEmail;
  const ui = setup({ submitFirstAccess: ({ email }) => {
    requests++;
    sentEmail = email;
    return new Promise(done => { resolve = done; });
  } });
  ui.input.value = '  member@example.test  ';
  const submission = ui.form.fire('submit');
  assert.equal(ui.input.readOnly, true);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.form.attributes.get('aria-busy'), 'true');
  await ui.form.fire('submit');
  assert.equal(requests, 1);
  assert.equal(sentEmail, 'member@example.test');
  resolve({ ok: true });
  await submission;
  assert.equal(ui.form.attributes.has('aria-busy'), false);
  assert.equal(ui.form.hidden, true);
  assert.equal(ui.confirmation.hidden, false);
  assert.equal(ui.confirmation.dataset.state, 'sent');
  assert.equal(ui.title.textContent, 'Nog één stap.');
  assert.equal(ui.title.focused, true);
  assert.match(ui.copy.textContent, /Bevestig je e-mailadres/);
  assert.equal(ui.edit.hidden, false);
});

test('editing a submitted address restores the form and permits another request', async () => {
  const addresses = [];
  const ui = setup({ submitFirstAccess: async ({ email }) => {
    addresses.push(email);
    return { ok: true };
  } });
  await ui.form.fire('submit');
  await ui.edit.fire('click');
  assert.equal(ui.form.hidden, false);
  assert.equal(ui.confirmation.hidden, true);
  assert.equal(ui.input.value, 'member@example.test');
  assert.equal(ui.input.readOnly, false);
  assert.equal(ui.input.focused, true);
  assert.equal(ui.button.disabled, false);
  ui.input.value = 'corrected@example.test';
  await ui.form.fire('submit');
  assert.deepEqual(addresses, ['member@example.test', 'corrected@example.test']);
});

test('provider rejection and unsuccessful responses allow retry without claiming success', async () => {
  for (const outcome of [async () => { throw new Error('Network failed'); }, async () => ({ ok: false }), async () => undefined]) {
    const ui = setup({ submitFirstAccess: outcome });
    await ui.form.fire('submit');
    assert.equal(ui.form.hidden, false);
    assert.equal(ui.confirmation.hidden, true);
    assert.equal(ui.input.readOnly, false);
    assert.equal(ui.button.disabled, false);
    assert.equal(ui.status.dataset.kind, 'error');
    assert.equal(ui.form.attributes.has('aria-busy'), false);
  }
});

test('provider confirmation return shows the final receipt without submitting again', () => {
  let requests = 0;
  const ui = setup({ confirmed: true, submitFirstAccess: async () => { requests++; } });
  assert.equal(requests, 0);
  assert.equal(ui.form.hidden, true);
  assert.equal(ui.confirmation.hidden, false);
  assert.equal(ui.confirmation.dataset.state, 'confirmed');
  assert.equal(ui.title.textContent, 'Je staat op de lijst.');
  assert.equal(ui.edit.hidden, true);
  assert.equal(ui.hint.hidden, true);
});

test('preview mode remains local even with the confirmation option', async () => {
  let requests = 0;
  const ui = setup({ mode: 'preview', confirmed: true, submitFirstAccess: async () => { requests++; } });
  await ui.form.fire('submit');
  assert.equal(requests, 0);
  assert.equal(ui.form.hidden, false);
  assert.equal(ui.confirmation.hidden, true);
  assert.equal(ui.status.dataset.kind, 'preview');
});

test('older markup without a receipt panel keeps accessible success feedback', async () => {
  const ui = setup({}, { receipt: false });
  await ui.form.fire('submit');
  assert.equal(ui.form.hidden, false);
  assert.equal(ui.status.hidden, false);
  assert.equal(ui.status.dataset.kind, 'success');
  assert.match(ui.status.textContent, /Bevestig je e-mailadres/);
});
