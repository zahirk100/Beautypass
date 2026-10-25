(() => {
  const section = document.querySelector('.beauty-edit');
  if (!section || typeof HTMLDialogElement === 'undefined' ||
      typeof HTMLDialogElement.prototype.showModal !== 'function') return;

  const page = document.documentElement;
  section.querySelectorAll('[data-edit-open]').forEach(button => {
    const dialog = document.getElementById(button.dataset.editOpen);
    if (!dialog || !section.contains(dialog)) return;
    button.hidden = false;
    button.addEventListener('click', () => {
      if (dialog.open) return;
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
})();
