// Executes the Slides app code stored in the HTML as text/plain.
// This makes the page work in environments that block inline JS.
(function() {
  'use strict';

  const codeEl = document.getElementById('slides-code');
  if (!codeEl) {
    console.error('Slides runner: #slides-code not found.');
    return;
  }

  try {
    // Indirect eval executes in the global scope.
    (0, eval)(codeEl.textContent || '');
  } catch (err) {
    console.error('Slides runner error:', err);
    try {
      alert('Slides runner error: ' + (err && err.message ? err.message : String(err)));
    } catch (_) {}
  }
})();

