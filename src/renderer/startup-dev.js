(() => {
  const shell = document.getElementById('startup');
  if (!shell) {
    return;
  }
  if (window.api) {
    shell.remove();
    return;
  }
  document.getElementById('startup-progress').removeAttribute('value');
  document.getElementById('startup-percentage').textContent = '';
  shell.hidden = false;
})();
