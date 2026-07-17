/**
 * Formas de pago configurables (caja, cobros, FE).
 */
const { getConfig, setConfig } = require('../db/database');

const CONFIG_KEY = 'taller_metodos_pago';

const DEFAULT_METODOS = [
  { codigo: 'efectivo', nombre: 'Efectivo', icono: '💵', fe_medio: '01', activo: true },
  { codigo: 'tarjeta', nombre: 'Tarjeta (Datáfono)', icono: '💳', fe_medio: '02', activo: true },
  { codigo: 'sinpe', nombre: 'Transferencia / SINPE', icono: '📱', fe_medio: '04', activo: true },
  { codigo: 'otro', nombre: 'Otro', icono: '💰', fe_medio: '99', activo: false }
];

const FE_MEDIOS_VALIDOS = ['01', '02', '03', '04', '05', '99'];

function slugCodigo(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function normalizarItem(raw, idx) {
  const nombre = String(raw.nombre || '').trim();
  let codigo = slugCodigo(raw.codigo || nombre);
  if (!codigo) codigo = 'pago_' + (idx + 1);
  const fe = String(raw.fe_medio || '01');
  return {
    codigo: codigo,
    nombre: nombre || codigo,
    icono: String(raw.icono || '💳').trim() || '💳',
    fe_medio: FE_MEDIOS_VALIDOS.includes(fe) ? fe : '01',
    activo: raw.activo !== false
  };
}

function parseLista(json) {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.map(normalizarItem);
  } catch (e) {
    return null;
  }
}

function getTodosMetodos(db) {
  const guardado = parseLista(getConfig(db, CONFIG_KEY, ''));
  if (guardado && guardado.length) return guardado;
  return DEFAULT_METODOS.map(function (m) {
    return Object.assign({}, m);
  });
}

function getMetodosActivos(db) {
  return getTodosMetodos(db).filter(function (m) {
    return m.activo !== false;
  });
}

function codigoPermitido(db, codigo) {
  const c = slugCodigo(codigo);
  if (!c) return false;
  return getTodosMetodos(db).some(function (m) {
    return m.codigo === c && m.activo !== false;
  });
}

function normalizarMetodo(db, codigo) {
  const c = slugCodigo(codigo);
  const activos = getMetodosActivos(db);
  if (c && activos.some(function (m) { return m.codigo === c; })) return c;
  return activos[0] ? activos[0].codigo : 'efectivo';
}

function etiquetaMetodo(db, codigo) {
  const c = slugCodigo(codigo);
  const todos = getTodosMetodos(db);
  const hit = todos.find(function (m) { return m.codigo === c; });
  if (hit) return (hit.icono ? hit.icono + ' ' : '') + hit.nombre;
  if (codigo) return String(codigo);
  return '';
}

function feMedioParaMetodo(db, codigo) {
  const c = slugCodigo(codigo);
  const todos = getTodosMetodos(db);
  const hit = todos.find(function (m) { return m.codigo === c; });
  if (hit && hit.fe_medio) return hit.fe_medio;
  if (c === 'tarjeta') return '02';
  if (c === 'sinpe') return '04';
  return '01';
}

function guardarMetodos(db, lista) {
  if (!Array.isArray(lista) || !lista.length) {
    throw new Error('Debe haber al menos una forma de pago.');
  }
  const normalizados = [];
  const vistos = {};
  lista.forEach(function (item, idx) {
    const n = normalizarItem(item, idx);
    if (vistos[n.codigo]) {
      throw new Error('Código duplicado: ' + n.codigo);
    }
    vistos[n.codigo] = true;
    normalizados.push(n);
  });
  const activos = normalizados.filter(function (m) { return m.activo !== false; });
  if (!activos.length) {
    throw new Error('Debe quedar al menos una forma de pago activa.');
  }
  setConfig(db, CONFIG_KEY, JSON.stringify(normalizados));
  return normalizados;
}

module.exports = {
  CONFIG_KEY,
  DEFAULT_METODOS,
  getTodosMetodos,
  getMetodosActivos,
  codigoPermitido,
  normalizarMetodo,
  etiquetaMetodo,
  feMedioParaMetodo,
  guardarMetodos,
  slugCodigo
};
