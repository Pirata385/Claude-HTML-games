/* Touch overlay: outline-only joystick (left) and action buttons (right). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const Touch = PA.Touch = {
    isTouch: () => ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer: coarse)').matches),
    init() {
      const ui = document.getElementById('ui');
      const el = document.createElement('div');
      el.id = 'touch';
      el.innerHTML = `
        <div class="stick" aria-label="move"><div class="knob"></div></div>
        <div class="tbtns">
          <button data-a="draw" class="tb small">draw</button>
          <button data-a="interact" class="tb">act</button>
          <button data-a="use" class="tb">use</button>
          <button data-a="jump" class="tb big">jump</button>
        </div>
        <button data-a="menu" class="tb corner">[=]</button>`;
      ui.appendChild(el);
      this.el = el;
      const stick = el.querySelector('.stick'), knob = el.querySelector('.knob');
      let sid = null, sx = 0, sy = 0, armedUp = true, armedDown = true;
      const R = () => stick.clientWidth * 0.42;
      const end = () => { sid = null; knob.style.transform = ''; PA.Input.virt.moveX = 0; PA.Input.virt.up = PA.Input.virt.down = false; PA.Input.virt.run = false; armedUp = armedDown = true; };
      stick.addEventListener('pointerdown', (e) => { e.preventDefault(); sid = e.pointerId; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); });
      const move = (e) => {
        if (e.pointerId !== sid) return;
        let dx = e.clientX - sx, dy = e.clientY - sy;
        const d = Math.hypot(dx, dy), r = R();
        if (d > r) { dx *= r / d; dy *= r / d; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const nx = dx / r, ny = dy / r, V = PA.Input.virt;
        V.moveX = Math.abs(nx) > 0.22 ? Math.sign(nx) * Math.min(1, (Math.abs(nx) - 0.12) / 0.7) : 0;
        V.run = Math.hypot(nx, ny) > 0.93 && Math.abs(nx) > 0.8;
        V.up = ny < -0.5; V.down = ny > 0.5;
        if (ny < -0.62 && armedUp) { armedUp = false; PA.Input.vpress('up'); setTimeout(() => PA.Input.vrelease('up'), 60); }
        if (ny > 0.62 && armedDown) { armedDown = false; PA.Input.vpress('down'); setTimeout(() => PA.Input.vrelease('down'), 60); }
        if (ny > -0.3) armedUp = true;
        if (ny < 0.3) armedDown = true;
      };
      stick.addEventListener('pointermove', move);
      stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
      for (const b of el.querySelectorAll('.tb')) {
        const a = b.dataset.a;
        let bx = 0, by = 0, pid = null;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); pid = e.pointerId; b.setPointerCapture(pid); bx = e.clientX; by = e.clientY; b.classList.add('on'); PA.Input.virt.aim = null; PA.Input.vpress(a); });
        b.addEventListener('pointermove', (e) => { if (e.pointerId !== pid || a !== 'use') return; const dx = e.clientX - bx, dy = e.clientY - by; if (Math.hypot(dx, dy) > 18) PA.Input.virt.aim = Math.atan2(dy, dx); });
        const up = () => { pid = null; b.classList.remove('on'); PA.Input.vrelease(a); setTimeout(() => { PA.Input.virt.aim = null; }, 120); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      }
      this.refresh();
    },
    refresh() {
      const s = PA.settings || {};
      const show = s.touch === 'on' || (s.touch !== 'off' && this.isTouch());
      this.el.classList.toggle('hidden', !show);
      this.el.classList.toggle('lefty', !!s.leftHanded);
      this.el.style.setProperty('--tb', String(s.touchSize || 1));
      document.body.classList.toggle('touchmode', show);
    },
    setVisible(v) { if (this.el) this.el.style.visibility = v ? '' : 'hidden'; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
