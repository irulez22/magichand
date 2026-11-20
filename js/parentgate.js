/* Magic Hand Play - grown-up check before the parent settings open.
   A simple arithmetic question with an on-screen keypad: quick for an adult,
   not something a 3-4 year old can stumble through. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';

  var ui = {
    root: null,
    question: null,
    display: null,
    error: null,
    onPass: null,
    a: 0,
    b: 0,
    answer: '',
    built: false,
    open: false
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function build() {
    if (ui.built) return;
    ui.built = true;

    var digits = '';
    for (var d = 1; d <= 9; d++) {
      digits += '<button type="button" data-gate-digit="' + d + '">' + d + '</button>';
    }

    var root = document.createElement('div');
    root.id = 'parent-gate';
    root.className = 'gate-overlay';
    root.hidden = true;
    root.innerHTML =
      '<div class="gate-card" role="dialog" aria-modal="true" aria-labelledby="gate-title" tabindex="-1">' +
        '<h2 id="gate-title">Grown-ups only</h2>' +
        '<p class="gate-lead">Solve this to open the settings. Cancel to keep playing.</p>' +
        '<div class="gate-question" id="gate-question"></div>' +
        '<div class="gate-display" id="gate-display" aria-live="polite"></div>' +
        '<div class="gate-keys">' + digits +
          '<button type="button" data-gate="clear">Clear</button>' +
          '<button type="button" data-gate-digit="0">0</button>' +
          '<button type="button" class="primary" data-gate="enter">Enter</button>' +
        '</div>' +
        '<div class="gate-error" id="gate-error" aria-live="polite"></div>' +
        '<button type="button" class="btn ghost gate-cancel" data-gate="cancel">Cancel</button>' +
      '</div>';

    document.body.appendChild(root);
    ui.root = root;
    ui.question = root.querySelector('#gate-question');
    ui.display = root.querySelector('#gate-display');
    ui.error = root.querySelector('#gate-error');

    root.addEventListener('click', function (e) {
      var digit = e.target.closest('[data-gate-digit]');
      if (digit) { press(digit.dataset.gateDigit); return; }
      var act = e.target.closest('[data-gate]');
      if (!act) return;
      if (act.dataset.gate === 'clear') clear();
      else if (act.dataset.gate === 'enter') submit();
      else if (act.dataset.gate === 'cancel') close();
    });

    document.addEventListener('keydown', function (e) {
      if (!ui.open) return;
      if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'Backspace') { back(); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'Enter') { submit(); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'Escape') { close(); e.preventDefault(); e.stopPropagation(); }
    });
  }

  function render() {
    if (!ui.display) return;
    ui.question.textContent = ui.a + ' + ' + ui.b + ' = ?';
    ui.display.textContent = ui.answer || ' ';
    ui.error.textContent = '';
  }

  function press(d) {
    if (ui.answer.length >= 4) return;
    if (ui.answer === '0') ui.answer = '';
    ui.answer += String(d);
    ui.display.textContent = ui.answer;
    ui.error.textContent = '';
  }

  function back() {
    ui.answer = ui.answer.slice(0, -1);
    ui.display.textContent = ui.answer || ' ';
  }

  function clear() {
    ui.answer = '';
    ui.display.textContent = ' ';
    ui.error.textContent = '';
  }

  function submit() {
    if (!ui.answer) return;
    if (Number(ui.answer) === ui.a + ui.b) {
      var cb = ui.onPass;
      close();
      if (cb) cb();
    } else {
      ui.error.textContent = 'Not quite — try again.';
      ui.answer = '';
      ui.display.textContent = ' ';
    }
  }

  function close() {
    ui.open = false;
    ui.answer = '';
    ui.onPass = null;
    if (ui.root) ui.root.hidden = true;
  }

  MG.ParentGate = {
    ask: function (onPass) {
      build();
      ui.open = true;
      ui.onPass = onPass || null;
      ui.a = 11 + Math.floor(Math.random() * 19);
      ui.b = 4 + Math.floor(Math.random() * 6);
      ui.answer = '';
      render();
      ui.root.hidden = false;
      var card = ui.root.querySelector('.gate-card');
      if (card) card.focus();
    },
    close: close,
    isOpen: function () { return ui.open; }
  };
})(window.MG);
