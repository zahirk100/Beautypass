/* Isolated design preview: deliberately no endpoint, storage or analytics. */
(() => {
  const form = document.querySelector('#access-form');
  if (!form) return;
  const input = form.querySelector('input');
  const status = document.querySelector('#access-status');
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    status.hidden = true;
    status.textContent = '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    input.value = input.value.trim();
    status.hidden = false;
    if (!input.checkValidity()) {
      input.setAttribute('aria-invalid', 'true');
      status.dataset.kind = 'error';
      status.textContent = 'Please enter a valid email address.';
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    status.dataset.kind = 'preview';
    status.textContent = 'Design preview — your email address has not been sent or saved.';
  });
})();
