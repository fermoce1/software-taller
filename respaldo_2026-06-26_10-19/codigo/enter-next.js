/**
 * Enter = pasar al siguiente campo (no enviar el formulario).
 * Funciona en todos los formularios del sistema.
 * - En campos de texto (input), Enter mueve el foco al siguiente campo.
 * - En <textarea> NO interfiere (Enter sigue agregando salto de línea).
 */
(function () {
  var TIPOS_TEXTO = ['text', 'search', 'tel', 'email', 'number', 'password', 'url', 'date', 'datetime-local', 'month', 'time', 'week'];

  function esEnfocable(el) {
    return el &&
      !el.disabled &&
      !el.readOnly &&
      el.type !== 'hidden' &&
      el.offsetParent !== null; // visible
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey) return;

    var el = e.target;
    if (!el || el.tagName !== 'INPUT') return;

    var tipo = (el.type || 'text').toLowerCase();
    if (TIPOS_TEXTO.indexOf(tipo) < 0) return; // ignora botones, checkbox, etc.

    // Ámbito: el formulario o el contenedor (modal/panel) más cercano.
    var scope = el.closest('form') ||
      el.closest('.modal-box, .modal-cxp-box, .modal-fe-config-box, .modal-cobro-box, .panel-body, .detalle-contenido') ||
      document;

    var campos = Array.prototype.slice
      .call(scope.querySelectorAll('input, select, textarea'))
      .filter(esEnfocable);

    var idx = campos.indexOf(el);
    if (idx < 0) return;

    e.preventDefault(); // evita que se envíe el formulario

    var siguiente = campos[idx + 1];
    if (siguiente) {
      siguiente.focus();
      if (typeof siguiente.select === 'function' && siguiente.tagName === 'INPUT') {
        try { siguiente.select(); } catch (err) { /* ignore */ }
      }
    } else {
      el.blur(); // último campo: solo quita el foco
    }
  }, true);
})();
