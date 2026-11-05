export const finishStartup = () => {
  document.getElementById('startup')?.remove();
  window.dispatchEvent(new Event('aiderdesk:ready'));
};
