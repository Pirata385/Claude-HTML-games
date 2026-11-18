/* Modal notebook dialogs: confirm / choose / message. Returns a Promise. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.UI = PA.UI || {};
  PA.UI.confirm = function (text, options) {
    return new Promise((resolve) => {
      const opts = options || ['Yes', 'No'];
      const el = document.createElement('div');
      el.className = 'modal';
      el.innerHTML = `<div class="card"><p>${PA.U.esc(text)}</p><div class="row">${opts.map((o, i) => `<button data-i="${i}">${PA.U.esc(o)}</button>`).join('')}</div></div>`;
      document.getElementById('ui').appendChild(el);
      PA.Input.blocked = true;
      const done = (i) => { el.remove(); PA.Input.blocked = false; PA.Input.clearAll(); window.removeEventListener('keydown', key, true); resolve(i); };
      const key = (e) => {
        if (e.code === 'Escape') { e.stopPropagation(); done(opts.length - 1); }
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.stopPropagation(); e.preventDefault(); done(0); }
      };
      window.addEventListener('keydown', key, true);
      for (const b of el.querySelectorAll('button')) b.onclick = () => done(+b.dataset.i);
      el.querySelector('button').focus();
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
