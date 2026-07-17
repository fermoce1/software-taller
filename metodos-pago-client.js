/**
 * UI compartida — formas de pago configurables.
 */
const MetodosPagoUI = (function () {
  'use strict';

  var cacheActivos = [];
  var cacheTodos = [];
  var seleccionado = '';

  function activos() {
    return cacheActivos.slice();
  }

  function etiqueta(codigo) {
    var c = String(codigo || '');
    var hit = cacheTodos.find(function (m) { return m.codigo === c; });
    if (hit) return (hit.icono ? hit.icono + ' ' : '') + hit.nombre;
    return c;
  }

  function primerCodigo() {
    return cacheActivos[0] ? cacheActivos[0].codigo : 'efectivo';
  }

  function getSeleccionado() {
    return seleccionado || primerCodigo();
  }

  function setSeleccionado(codigo) {
    seleccionado = codigo;
  }

  async function cargar() {
    var data = await TallerAPI.getMetodosPago(true);
    cacheTodos = data.todos || data.metodos || [];
    cacheActivos = cacheTodos.filter(function (m) {
      return m.activo !== false;
    });
    if (!seleccionado || !cacheActivos.some(function (m) { return m.codigo === seleccionado; })) {
      seleccionado = primerCodigo();
    }
    return cacheActivos;
  }

  function renderRadios(containerId, name) {
    var el = document.getElementById(containerId);
    if (!el) return;
    name = name || 'metodo';
    var list = activos();
    if (!list.length) {
      el.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Sin formas de pago activas.</p>';
      return;
    }
    el.innerHTML = list.map(function (m, i) {
      var checked = m.codigo === getSeleccionado() || (i === 0 && !getSeleccionado());
      var icono = m.icono || (m.codigo === 'tarjeta' ? '💳' : (m.codigo.indexOf('sinpe') >= 0 || m.codigo.indexOf('transfer') >= 0 ? '📱' : '💵'));
      return '<label class="pago-opt"><input type="radio" name="' + name + '" value="' + m.codigo + '"' +
        (checked ? ' checked' : '') + '>' +
        '<span class="ico-pago">' + icono + '</span>' +
        '<span>' + m.nombre + '</span></label>';
    }).join('');
    var inp = el.querySelector('input[name="' + name + '"]:checked');
    if (inp) seleccionado = inp.value;
  }

  function renderBotones(containerId, onClickAttr) {
    var el = document.getElementById(containerId);
    if (!el) return;
    onClickAttr = onClickAttr || 'seleccionarMetodoCobro(this)';
    var list = activos();
    var sel = getSeleccionado();
    el.innerHTML = list.map(function (m) {
      var cls = 'modal-cobro-metodo' + (m.codigo === sel ? ' seleccionado' : '');
      return '<button type="button" class="' + cls + '" data-metodo="' + m.codigo + '" onclick="' + onClickAttr + '">' +
        (m.icono ? m.icono + ' ' : '') + m.nombre + '</button>';
    }).join('');
  }

  function renderSelect(selectId, valorActual) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var list = activos();
    sel.innerHTML = list.map(function (m) {
      return '<option value="' + m.codigo + '">' + (m.icono ? m.icono + ' ' : '') + m.nombre + '</option>';
    }).join('');
    if (valorActual && list.some(function (m) { return m.codigo === valorActual; })) {
      sel.value = valorActual;
    }
  }

  function leerRadio(name) {
    name = name || 'metodo';
    var r = document.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : getSeleccionado();
  }

  return {
    cargar: cargar,
    activos: activos,
    etiqueta: etiqueta,
    primerCodigo: primerCodigo,
    getSeleccionado: getSeleccionado,
    setSeleccionado: setSeleccionado,
    renderRadios: renderRadios,
    renderBotones: renderBotones,
    renderSelect: renderSelect,
    leerRadio: leerRadio
  };
})();
