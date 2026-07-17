/**
 * Diseño de ticket configurable — estilo SolverMedia / Hostelería.
 * Cabecera, pie, campos visibles, caracteres por línea, líneas en blanco al final.
 */

const { getConfig, setConfig } = require('../db/database');
const empresaService = require('./empresa-service');
const logoService = require('./logo-service');

const TICKET_KEYS = [
  'ticket_cabecera',
  'ticket_pie',
  'ticket_caracteres_linea',
  'ticket_lineas_blanco_final',
  'ticket_separador',
  'ticket_formato_defecto',
  'ticket_mostrar_cliente',
  'ticket_mostrar_identificacion',
  'ticket_mostrar_telefono',
  'ticket_mostrar_placa',
  'ticket_mostrar_vehiculo',
  'ticket_mostrar_color',
  'ticket_mostrar_km',
  'ticket_mostrar_diagnostico',
  'ticket_mostrar_empleado',
  'ticket_mostrar_metodo_pago',
  'ticket_mostrar_fe',
  'ticket_mostrar_subtotal_iva'
];

const DEFAULTS = {
  ticket_cabecera: '',
  ticket_pie: 'Gracias por su preferencia',
  ticket_caracteres_linea: '48',
  ticket_lineas_blanco_final: '3',
  ticket_separador: '-',
  ticket_formato_defecto: '80',
  ticket_mostrar_cliente: '1',
  ticket_mostrar_identificacion: '1',
  ticket_mostrar_telefono: '1',
  ticket_mostrar_placa: '1',
  ticket_mostrar_vehiculo: '1',
  ticket_mostrar_color: '0',
  ticket_mostrar_km: '1',
  ticket_mostrar_diagnostico: '0',
  ticket_mostrar_empleado: '1',
  ticket_mostrar_metodo_pago: '1',
  ticket_mostrar_fe: '1',
  ticket_mostrar_subtotal_iva: '1'
};

function boolCfg(val, def) {
  if (val === undefined || val === null || val === '') return def;
  return val === '1' || val === true || val === 1;
}

function getTicketConfig(db) {
  const nombre = getConfig(db, 'nombre_negocio', 'Sanmy Taller Mecánico');
  const cfg = { nombre_negocio: nombre };
  TICKET_KEYS.forEach(function (key) {
    cfg[key] = getConfig(db, key, DEFAULTS[key] || '');
  });
  const activaId = empresaService.getEmpresaActivaId(db);
  return {
    nombre_negocio: nombre,
    logo_url: activaId ? logoService.urlLogo(activaId) : null,
    cabecera: cfg.ticket_cabecera || '',
    pie: cfg.ticket_pie || DEFAULTS.ticket_pie,
    caracteres_linea: parseInt(cfg.ticket_caracteres_linea, 10) || 48,
    lineas_blanco_final: parseInt(cfg.ticket_lineas_blanco_final, 10) || 3,
    separador: (cfg.ticket_separador || '-').charAt(0),
    formato_defecto: cfg.ticket_formato_defecto === 'carta' ? 'carta' : '80',
    mostrar_cliente: boolCfg(cfg.ticket_mostrar_cliente, true),
    mostrar_identificacion: boolCfg(cfg.ticket_mostrar_identificacion, true),
    mostrar_telefono: boolCfg(cfg.ticket_mostrar_telefono, true),
    mostrar_placa: boolCfg(cfg.ticket_mostrar_placa, true),
    mostrar_vehiculo: boolCfg(cfg.ticket_mostrar_vehiculo, true),
    mostrar_color: boolCfg(cfg.ticket_mostrar_color, false),
    mostrar_km: boolCfg(cfg.ticket_mostrar_km, true),
    mostrar_diagnostico: boolCfg(cfg.ticket_mostrar_diagnostico, false),
    mostrar_empleado: boolCfg(cfg.ticket_mostrar_empleado, true),
    mostrar_metodo_pago: boolCfg(cfg.ticket_mostrar_metodo_pago, true),
    mostrar_fe: boolCfg(cfg.ticket_mostrar_fe, true),
    mostrar_subtotal_iva: boolCfg(cfg.ticket_mostrar_subtotal_iva, true)
  };
}

function saveTicketConfig(db, data) {
  const incoming = data || {};
  if (incoming.nombre_negocio !== undefined) {
    setConfig(db, 'nombre_negocio', String(incoming.nombre_negocio || ''));
  }
  const map = {
    cabecera: 'ticket_cabecera',
    pie: 'ticket_pie',
    caracteres_linea: 'ticket_caracteres_linea',
    lineas_blanco_final: 'ticket_lineas_blanco_final',
    separador: 'ticket_separador',
    formato_defecto: 'ticket_formato_defecto',
    mostrar_cliente: 'ticket_mostrar_cliente',
    mostrar_identificacion: 'ticket_mostrar_identificacion',
    mostrar_telefono: 'ticket_mostrar_telefono',
    mostrar_placa: 'ticket_mostrar_placa',
    mostrar_vehiculo: 'ticket_mostrar_vehiculo',
    mostrar_color: 'ticket_mostrar_color',
    mostrar_km: 'ticket_mostrar_km',
    mostrar_diagnostico: 'ticket_mostrar_diagnostico',
    mostrar_empleado: 'ticket_mostrar_empleado',
    mostrar_metodo_pago: 'ticket_mostrar_metodo_pago',
    mostrar_fe: 'ticket_mostrar_fe',
    mostrar_subtotal_iva: 'ticket_mostrar_subtotal_iva'
  };
  Object.keys(map).forEach(function (field) {
    if (incoming[field] === undefined) return;
    let val = incoming[field];
    if (typeof val === 'boolean') val = val ? '1' : '0';
    setConfig(db, map[field], String(val));
  });
  if (incoming.pie !== undefined) {
    setConfig(db, 'impresion_pie_ticket', String(incoming.pie || ''));
  }
  return getTicketConfig(db);
}

function formatearColones(valor) {
  return (
    '₡' +
    Number(valor || 0).toLocaleString('es-CR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  );
}

function tituloDocumento(tipo) {
  if (tipo === 'presupuesto') return 'PRESUPUESTO';
  if (tipo === 'factura') return 'FACTURA';
  if (tipo === 'taller' || tipo === 'orden') return 'ORDEN DE TALLER';
  return 'RECIBO';
}

function centrar(texto, width) {
  const t = String(texto || '').trim();
  if (t.length >= width) return t.substring(0, width);
  const pad = Math.floor((width - t.length) / 2);
  return ' '.repeat(Math.max(0, pad)) + t;
}

function lineaDosColumnas(izq, der, width) {
  const right = String(der || '');
  const maxLeft = Math.max(1, width - right.length - 1);
  let left = String(izq || '');
  if (left.length > maxLeft) left = left.substring(0, maxLeft - 1) + '.';
  const spaces = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, spaces)) + right;
}

function repetir(char, width) {
  return String(char || '-').charAt(0).repeat(width);
}

function wrapText(text, width) {
  const lines = [];
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (paragraph) {
      let p = paragraph.trim();
      if (!p) {
        lines.push('');
        return;
      }
      while (p.length > 0) {
        lines.push(p.substring(0, width));
        p = p.substring(width);
      }
    });
  return lines;
}

function buildPlainTextTicket(tipo, datos, ticketCfg, opciones) {
  opciones = opciones || {};
  const cfg = ticketCfg || {};
  const ancho = opciones.anchoMm
    ? opciones.anchoMm <= 58
      ? 32
      : 48
    : cfg.caracteres_linea || 48;
  const sep = cfg.separador || '-';
  const negocio = cfg.nombre_negocio || 'Sanmy Taller Mecánico';
  const pie = cfg.pie || 'Gracias por su preferencia';
  const titulo = tituloDocumento(tipo);
  const lines = [];

  if (opciones.prueba) {
    lines.push(centrar('*** PRUEBA DE IMPRESION ***', ancho));
    lines.push('');
  }

  lines.push(centrar(negocio, ancho));
  wrapText(cfg.cabecera, ancho).forEach(function (l) {
    if (l) lines.push(centrar(l, ancho));
  });
  lines.push(centrar(titulo, ancho));
  lines.push(centrar(String(datos.fecha || ''), ancho));
  lines.push('');

  if (datos.numero) lines.push('Orden #: ' + datos.numero);
  if (cfg.mostrar_placa && datos.placa) lines.push('Placa: ' + datos.placa);
  if (cfg.mostrar_vehiculo && datos.vehiculo) lines.push('Vehiculo: ' + datos.vehiculo);
  if (cfg.mostrar_color && datos.color) lines.push('Color: ' + datos.color);
  if (cfg.mostrar_km && datos.kilometraje) lines.push('Km: ' + datos.kilometraje);
  if (cfg.mostrar_cliente) lines.push('Cliente: ' + (datos.cliente || '-'));
  if (cfg.mostrar_identificacion && datos.identificacion) {
    lines.push('Cedula: ' + datos.identificacion);
  }
  if (cfg.mostrar_telefono && datos.telefono) lines.push('Tel: ' + datos.telefono);
  if (cfg.mostrar_empleado && datos.empleado) lines.push('Atendio: ' + datos.empleado);

  if (cfg.mostrar_diagnostico && datos.diagnostico) {
    lines.push(repetir(sep, ancho));
    lines.push('Diagnostico:');
    wrapText(datos.diagnostico, ancho).forEach(function (l) {
      lines.push(l);
    });
  }

  lines.push(repetir(sep, ancho));
  (datos.items || []).forEach(function (it) {
    lines.push(
      lineaDosColumnas(
        String(it.cantidad || 1) + ' x ' + (it.nombre || ''),
        formatearColones(it.total),
        ancho
      )
    );
  });
  lines.push(repetir(sep, ancho));

  if (cfg.mostrar_subtotal_iva) {
    lines.push(lineaDosColumnas('Subtotal', formatearColones(datos.subtotal), ancho));
    lines.push(lineaDosColumnas('IVA', formatearColones(datos.iva), ancho));
  }
  lines.push(lineaDosColumnas('TOTAL', formatearColones(datos.total), ancho));

  if (cfg.mostrar_metodo_pago && datos.metodo) {
    lines.push('Metodo pago: ' + datos.metodo);
    if (datos.montoPagado) {
      lines.push('Cobrado: ' + formatearColones(datos.montoPagado));
    }
  }
  if (datos.estado) lines.push('Estado: ' + datos.estado);

  if (tipo === 'factura' && cfg.mostrar_fe && opciones.facturaFe) {
    lines.push(repetir(sep, ancho));
    lines.push('Factura electronica CR');
    if (opciones.facturaFe.consecutivo) {
      lines.push('Consec: ' + opciones.facturaFe.consecutivo);
    }
    if (opciones.facturaFe.clave) {
      wrapText('Clave: ' + opciones.facturaFe.clave, ancho).forEach(function (l) {
        lines.push(l);
      });
    }
    if (opciones.facturaFe.estado) lines.push('Estado: ' + opciones.facturaFe.estado);
  }

  lines.push('');
  wrapText(pie, ancho).forEach(function (l) {
    lines.push(centrar(l || '', ancho));
  });
  const blancos = cfg.lineas_blanco_final || 3;
  for (let i = 0; i < blancos; i++) lines.push('');

  return lines.join('\n');
}

function datosPruebaTicket() {
  return {
    numero: 1001,
    placa: 'ABC-123',
    vehiculo: 'Toyota Corolla 2018',
    color: 'Blanco',
    kilometraje: '85000',
    cliente: 'Juan Perez',
    identificacion: '1-2345-6789',
    telefono: '8888-8888',
    empleado: 'Tecnico Taller',
    diagnostico: 'Cambio de aceite y revision de frenos.',
    subtotal: 50000,
    iva: 6500,
    total: 56500,
    metodo: 'Efectivo',
    montoPagado: 56500,
    estado: 'entregado',
    fecha: new Date().toLocaleString('es-CR'),
    items: [
      { cantidad: 1, nombre: 'Cambio de aceite', total: 25000 },
      { cantidad: 2, nombre: 'Filtro de aceite', total: 15000 },
      { cantidad: 1, nombre: 'Mano de obra revision', total: 10000 }
    ]
  };
}

module.exports = {
  getTicketConfig,
  saveTicketConfig,
  buildPlainTextTicket,
  datosPruebaTicket,
  formatearColones,
  tituloDocumento
};
