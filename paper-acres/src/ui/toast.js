/* Small notebook-style toasts. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.UI = PA.UI || {};
  let box = null;
  PA.UI.toast = function (msg, ms) {
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.getElementById('ui').appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms || 2400);
  };
})(typeof window !== 'undefined' ? window : globalThis);
