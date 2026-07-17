/**
 * Factura electrónica Costa Rica — Sanmy Taller (órdenes de taller mecánico).
 * Modo simulacion: clave de prueba sin API externa.
 * Modo api: POST JSON a fe_api_url con Bearer token.
 */

const FE_CONFIG_KEYS = [
  'fe_modo',
  'fe_proveedor',
  'fe_sandbox',
  'fe_api_url',
  'fe_api_url_sandbox',
  'fe_api_token',
  'fe_emisor_cedula',
  'fe_emisor_nombre',
  'fe_emisor_email',
  'fe_actividad_economica',
  'fe_sucursal',
  'fe_terminal',
  'fe_consecutivo'
];

const DEFAULTS = {
  fe_modo: 'simulacion',
  fe_proveedor: 'pendiente',
  fe_sandbox: '0',
  fe_api_url: '',
  fe_api_url_sandbox: '',
  fe_api_token: '',
  fe_emisor_cedula: '',
  fe_emisor_nombre: '',
  fe_emisor_email: '',
  fe_actividad_economica: '452000',
  fe_sucursal: '001',
  fe_terminal: '001',
  fe_consecutivo: '0'
};

const CABYS_SERVICIO_TALLER = '4520001010100';
const CABYS_REPUESTO = '4010151010100';

const feProviders = require('./fe-providers');
const tallerService = require('./taller-service');
const metodosPagoService = require('./metodos-pago-service');

const TRIBU_URL = 'https://ovitribucr.hacienda.go.cr';

function getConfigValue(db, clave, def) {
  const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
  return row && row.valor != null && row.valor !== '' ? row.valor : def;
}

function upsertConfig(db, clave, valor) {
  db.prepare(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, fecha_actualizacion = CURRENT_TIMESTAMP`
  ).run(clave, String(valor == null ? '' : valor));
}

function getConfig(db) {
  const cfg = {};
  FE_CONFIG_KEYS.forEach(function (key) {
    cfg[key] = getConfigValue(db, key, DEFAULTS[key] || '');
  });
  cfg.activo = cfg.fe_modo === 'api' ? !!cfg.fe_api_url : true;
  return cfg;
}

function saveConfig(db, data) {
  const incoming = data || {};
  FE_CONFIG_KEYS.forEach(function (key) {
    if (incoming[key] !== undefined) {
      upsertConfig(db, key, incoming[key]);
    }
  });
  return getConfig(db);
}

function nextConsecutivo(db) {
  const actual = parseInt(getConfigValue(db, 'fe_consecutivo', '0'), 10) || 0;
  const siguiente = actual + 1;
  upsertConfig(db, 'fe_consecutivo', String(siguiente));
  return siguiente;
}

function pad(num, len) {
  return String(num).padStart(len, '0');
}

function generarClaveSimulada(cfg, consecutivo) {
  const fecha = new Date();
  const y = fecha.getFullYear();
  const m = pad(fecha.getMonth() + 1, 2);
  const d = pad(fecha.getDate(), 2);
  const cedula = pad((cfg.fe_emisor_cedula || '000000000').replace(/\D/g, '').slice(-12), 12);
  const suc = pad(cfg.fe_sucursal || '1', 3);
  const term = pad(cfg.fe_terminal || '1', 5);
  const tipo = '01';
  const estado = '1';
  const cons = pad(consecutivo, 10);
  const situacion = '1';
  const codigo = pad(Math.floor(Math.random() * 99999999), 8);
  return '' + suc + term + tipo + cedula + estado + cons + situacion + codigo + y + m + d;
}

function mapMedioPago(metodo, db) {
  if (db) {
    return metodosPagoService.feMedioParaMetodo(db, metodo);
  }
  const m = String(metodo || 'efectivo').toLowerCase();
  if (m === 'tarjeta') return '02';
  if (m === 'sinpe') return '04';
  return '01';
}

function cabysPorTipoLinea(tipo) {
  if (tipo === 'repuesto') return CABYS_REPUESTO;
  return CABYS_SERVICIO_TALLER;
}

// Mapea un porcentaje de IVA al código de tarifa de Hacienda (v4.4).
function tarifaCodeFromIva(pct) {
  const p = Number(pct);
  if (isNaN(p) || p === 13) return '08';
  if (p === 0) return '01';
  if (p === 1) return '02';
  if (p === 2) return '03';
  if (p === 4) return '04';
  if (p === 8) return '07';
  return '08';
}

function labelTipoLinea(tipo) {
  if (tipo === 'mano_obra') return '[MO] ';
  if (tipo === 'repuesto') return '[REP] ';
  return '';
}

function validarLineasParaFe(db, ordenId) {
  const rows = db
    .prepare(
      `SELECT l.descripcion, l.tipo, i.nombre AS producto, i.cabys AS inv_cabys
       FROM taller_orden_lineas l
       LEFT JOIN taller_inventario i ON i.id = l.inventario_id
       WHERE l.orden_id = ? ORDER BY l.id`
    )
    .all(ordenId);
  if (!rows.length) {
    throw new Error('La orden no tiene líneas para facturar');
  }
  const faltantes = [];
  rows.forEach(function (row) {
    if (row.inv_cabys) return;
    if (row.tipo === 'repuesto' && row.producto) {
      faltantes.push('Repuesto «' + row.producto + '» sin CABYS en inventario');
    }
  });
  if (faltantes.length) {
    throw new Error(
      'Complete el CABYS en inventario antes de facturar electrónicamente:\n• ' + faltantes.join('\n• ')
    );
  }
  return true;
}

function buildLineasDesdeOrden(db, ordenId) {
  const rows = db
    .prepare(
      `SELECT l.tipo, l.descripcion, l.cantidad, l.precio_unitario, l.subtotal,
              i.cabys AS inv_cabys, i.unidad_medida AS inv_unidad, i.iva AS inv_iva
       FROM taller_orden_lineas l
       LEFT JOIN taller_inventario i ON i.id = l.inventario_id
       WHERE l.orden_id = ? ORDER BY l.id`
    )
    .all(ordenId);
  const ivaRateDefault = parseFloat(getConfigValue(db, 'impuesto_iva', '0.13')) || 0.13;

  return rows.map(function (row, idx) {
    const subtotal = parseFloat(row.subtotal) || 0;
    // Si la línea viene de un producto del inventario, usamos sus datos de Hacienda.
    const cabys = row.inv_cabys ? String(row.inv_cabys) : cabysPorTipoLinea(row.tipo);
    const unidad = row.inv_unidad ? String(row.inv_unidad) : 'Unid';
    const ivaPct = row.inv_iva != null && row.inv_iva !== '' ? Number(row.inv_iva) : ivaRateDefault * 100;
    const ivaRate = ivaPct / 100;
    const tarifa = tarifaCodeFromIva(ivaPct);
    const impuesto = Math.round(subtotal * ivaRate * 100) / 100;
    return {
      numero_linea: idx + 1,
      codigo: String(idx + 1),
      codigo_cabys: cabys,
      descripcion: labelTipoLinea(row.tipo) + row.descripcion,
      cantidad: row.cantidad,
      unidad_medida: unidad,
      precio_unitario: parseFloat(row.precio_unitario) || 0,
      subtotal: subtotal,
      impuesto: impuesto,
      tarifa_iva: tarifa,
      total_linea: Math.round((subtotal + impuesto) * 100) / 100
    };
  });
}

function buildLineaMontoParcial(db, monto, descripcion) {
  const ivaRate = parseFloat(getConfigValue(db, 'impuesto_iva', '0.13')) || 0.13;
  const total = Math.round(parseFloat(monto) * 100) / 100;
  const subtotal = Math.round((total / (1 + ivaRate)) * 100) / 100;
  const impuesto = Math.round((total - subtotal) * 100) / 100;
  return [
    {
      numero_linea: 1,
      codigo: '1',
      codigo_cabys: CABYS_SERVICIO_TALLER,
      descripcion: descripcion,
      cantidad: 1,
      unidad_medida: 'Unid',
      precio_unitario: subtotal,
      subtotal: subtotal,
      impuesto: impuesto,
      tarifa_iva: '08',
      total_linea: total
    }
  ];
}

function prorratearLineas(lineasOrden, monto) {
  const totalLineas = lineasOrden.reduce(function (s, l) {
    return s + l.total_linea;
  }, 0);
  if (totalLineas <= 0) return lineasOrden;
  const ratio = monto / totalLineas;
  const prorrateadas = lineasOrden.map(function (l) {
    const cant = parseFloat(l.cantidad) || 1;
    const subtotal = Math.round(l.subtotal * ratio * 100) / 100;
    const impuesto = Math.round(l.impuesto * ratio * 100) / 100;
    const totalLinea = Math.round((subtotal + impuesto) * 100) / 100;
    return Object.assign({}, l, {
      subtotal: subtotal,
      impuesto: impuesto,
      total_linea: totalLinea,
      precio_unitario: Math.round((subtotal / cant) * 100) / 100
    });
  });
  const sumPr = prorrateadas.reduce(function (s, l) {
    return s + l.total_linea;
  }, 0);
  const diff = Math.round((monto - sumPr) * 100) / 100;
  if (Math.abs(diff) >= 0.01 && prorrateadas.length) {
    const ult = prorrateadas[prorrateadas.length - 1];
    ult.total_linea = Math.round((ult.total_linea + diff) * 100) / 100;
    ult.impuesto = Math.round((ult.impuesto + diff / (1 + ult.subtotal ? ult.impuesto / ult.subtotal : 0.13)) * 100) / 100;
    if (ult.impuesto < 0) ult.impuesto = 0;
    ult.subtotal = Math.round((ult.total_linea - ult.impuesto) * 100) / 100;
  }
  return prorrateadas;
}

function buildLineas(db, opts) {
  const monto = Math.round(parseFloat(opts.monto) * 100) / 100;
  const ordenTotal = Math.round(parseFloat(opts.ordenTotal) * 100) / 100;
  const lineasOrden = buildLineasDesdeOrden(db, opts.ordenId);

  if (!lineasOrden.length) {
    throw new Error('La orden no tiene líneas para facturar');
  }

  const totalLineas = lineasOrden.reduce(function (s, l) {
    return s + l.total_linea;
  }, 0);

  if (monto >= ordenTotal - 0.01 || Math.abs(totalLineas - monto) < 0.02) {
    return lineasOrden;
  }

  if (monto > 0 && monto < ordenTotal - 0.01 && totalLineas > 0) {
    return prorratearLineas(lineasOrden, monto);
  }

  const desc =
    opts.descripcionParcial ||
    'Cobro taller orden #' + (opts.ordenNumero || opts.ordenId);
  return buildLineaMontoParcial(db, monto, desc);
}

function buildPayload(db, opts) {
  const cfg = getConfig(db);
  const consecutivo = nextConsecutivo(db);
  const lineas = buildLineas(db, opts);
  if (!lineas.length) {
    throw new Error('La orden no tiene líneas para facturar');
  }
  const subtotal = lineas.reduce(function (s, l) {
    return s + l.subtotal;
  }, 0);
  const impuesto = lineas.reduce(function (s, l) {
    return s + l.impuesto;
  }, 0);
  const total = Math.round((subtotal + impuesto) * 100) / 100;
  const receptor = opts.receptor || {};

  return {
    tipo_documento: 'FE',
    condicion_venta: '01',
    medio_pago: mapMedioPago(opts.metodo_pago, db),
    consecutivo: consecutivo,
    referencia_interna:
      'SANMY-T' + opts.ordenId + '-A' + (opts.abonoId || '0'),
    emisor: {
      tipo_identificacion: '02',
      identificacion: cfg.fe_emisor_cedula,
      nombre: cfg.fe_emisor_nombre,
      email: cfg.fe_emisor_email,
      actividad_economica: cfg.fe_actividad_economica,
      sucursal: cfg.fe_sucursal,
      terminal: cfg.fe_terminal
    },
    receptor: {
      tipo_identificacion: receptor.tipo_identificacion || '01',
      identificacion: receptor.identificacion || '',
      nombre: receptor.nombre || '',
      email: receptor.email || ''
    },
    lineas: lineas,
    totales: {
      subtotal: Math.round(subtotal * 100) / 100,
      impuesto: Math.round(impuesto * 100) / 100,
      total: total
    },
    orden_id: opts.ordenId,
    abono_id: opts.abonoId || null,
    taller: true
  };
}

function guardarFactura(db, payload, respuesta, estado) {
  const info = db
    .prepare(
      `INSERT INTO facturas_electronicas
       (orden_id, abono_id, clave, consecutivo, estado,
        receptor_identificacion, receptor_nombre, receptor_email,
        total, json_envio, json_respuesta, pdf_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.orden_id,
      payload.abono_id,
      respuesta.clave || '',
      String(payload.consecutivo),
      estado,
      payload.receptor.identificacion,
      payload.receptor.nombre,
      payload.receptor.email,
      payload.totales.total,
      JSON.stringify(payload),
      JSON.stringify(respuesta),
      respuesta.pdf_url || null
    );
  return info.lastInsertRowid;
}

async function enviarApiExterna(cfg, payload) {
  const url = feProviders.resolveApiUrl(cfg);
  if (!url) {
    throw new Error('Configure la URL de la API de factura electrónica');
  }

  const body = feProviders.adaptPayload(cfg, payload);
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (cfg.fe_api_token) {
    headers.Authorization = 'Bearer ' + cfg.fe_api_token;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data.error ||
      data.message ||
      data.mensaje ||
      (data.errors && data.errors[0] && (data.errors[0].message || data.errors[0].detail)) ||
      'Error HTTP ' + res.status;
    throw new Error(msg);
  }

  return normalizarRespuestaProveedor(data, payload);
}

function normalizarEstadoFe(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'accepted' || s === 'aceptado' || s === 'aceptada' || s === 'approved') {
    return 'aceptado';
  }
  if (s === 'rejected' || s === 'rechazado' || s === 'rechazada' || s === 'failed') {
    return 'rechazado';
  }
  if (s === 'pending' || s === 'pendiente' || s === 'processing') {
    return 'pendiente';
  }
  return raw ? String(raw) : 'enviado';
}

function normalizarRespuestaProveedor(data, payload) {
  const anidado = data.data || data.voucher || data.result || data.response || {};
  const src = Object.keys(anidado).length ? anidado : data;
  const estadoRaw =
    src.estado ||
    src.Estado ||
    src.status ||
    src.state ||
    data.estado ||
    data.status;
  return {
    clave:
      src.clave ||
      src.Clave ||
      src.key ||
      src.voucher_key ||
      src.document_key ||
      data.clave ||
      data.key ||
      '',
    consecutivo:
      src.consecutivo ||
      src.Consecutivo ||
      src.consecutive ||
      data.consecutivo ||
      String(payload.consecutivo),
    estado: normalizarEstadoFe(estadoRaw),
    pdf_url:
      src.pdf_url ||
      src.pdf ||
      src.url_pdf ||
      src.pdfUrl ||
      data.pdf_url ||
      data.pdf ||
      null,
    proveedor: data
  };
}

async function emitirDesdeCobro(db, opts) {
  const cfg = getConfig(db);
  const receptor = opts.receptor || {};

  if (!receptor.identificacion || !receptor.nombre) {
    throw new Error(
      'Identificación y nombre del cliente son obligatorios para factura electrónica'
    );
  }

  if (cfg.fe_modo === 'api') {
    if (!cfg.fe_emisor_cedula || !cfg.fe_emisor_nombre) {
      throw new Error('Configure los datos del emisor en Configuración → Factura electrónica');
    }
    if (!feProviders.resolveApiUrl(cfg)) {
      throw new Error('Configure la URL de la API o seleccione un proveedor en Facturación → Configuración');
    }
    if ((cfg.fe_proveedor || 'pendiente') === 'pendiente') {
      throw new Error(
        'Seleccione su proveedor de facturación en Facturación → Configuración (mientras tanto use modo Simulación)'
      );
    }
    if (!cfg.fe_api_token) {
      throw new Error('Configure el token de API del proveedor en Facturación → Configuración');
    }
  }

  validarLineasParaFe(db, opts.ordenId);

  const orden = db
    .prepare('SELECT id, numero, total FROM taller_ordenes WHERE id = ?')
    .get(opts.ordenId);
  if (!orden) {
    throw new Error('Orden no encontrada');
  }

  const payloadOpts = {
    ordenId: opts.ordenId,
    ordenNumero: orden.numero,
    ordenTotal: orden.total,
    abonoId: opts.abonoId,
    monto: opts.monto,
    metodo_pago: opts.metodo_pago,
    descripcionParcial: opts.descripcionParcial,
    receptor: receptor
  };

  const payload = buildPayload(db, payloadOpts);

  if (cfg.fe_modo === 'simulacion') {
    const clave = generarClaveSimulada(cfg, payload.consecutivo);
    const respuesta = {
      clave: clave,
      consecutivo: String(payload.consecutivo),
      estado: 'simulado',
      mensaje: 'Factura generada en modo simulación (sin envío a Hacienda)'
    };
    const id = guardarFactura(db, payload, respuesta, 'simulado');
    return {
      ok: true,
      modo: 'simulacion',
      id: id,
      clave: clave,
      consecutivo: respuesta.consecutivo,
      total: payload.totales.total,
      estado: 'simulado',
      mensaje: respuesta.mensaje
    };
  }

  const respuesta = await enviarApiExterna(cfg, payload);
  const id = guardarFactura(db, payload, respuesta, respuesta.estado || 'enviado');
  return {
    ok: true,
    modo: 'api',
    id: id,
    clave: respuesta.clave,
    consecutivo: respuesta.consecutivo,
    total: payload.totales.total,
    estado: respuesta.estado,
    pdf_url: respuesta.pdf_url || null
  };
}

async function enviarAHacienda(db, facturaId) {
  const cfg = getConfig(db);
  const factura = db
    .prepare('SELECT * FROM facturas_electronicas WHERE id = ?')
    .get(facturaId);
  if (!factura) throw new Error('Factura no encontrada');

  const estadoActual = String(factura.estado || '').toLowerCase();
  if (estadoActual === 'aceptado' || estadoActual === 'aceptada') {
    return {
      ok: true,
      yaEnviada: true,
      id: factura.id,
      estado: factura.estado,
      clave: factura.clave,
      mensaje: 'Esta factura ya fue aceptada por Hacienda.'
    };
  }

  if (cfg.fe_modo !== 'api') {
    throw new Error(
      'Para enviar a Hacienda active el modo "API / Hacienda" en Configuración e indique la URL y el token de su proveedor de facturación.'
    );
  }
  if (!feProviders.resolveApiUrl(cfg)) {
    throw new Error('Configure la URL de la API o seleccione un proveedor en Facturación → Configuración.');
  }
  if (!cfg.fe_api_token) {
    throw new Error('Configure el token de API del proveedor en Facturación → Configuración.');
  }

  let payload;
  try {
    payload = JSON.parse(factura.json_envio || '{}');
  } catch (e) {
    payload = {};
  }
  if (!payload || !payload.lineas || !payload.lineas.length) {
    throw new Error('La factura no tiene datos para enviar.');
  }

  const respuesta = await enviarApiExterna(cfg, payload);
  db.prepare(
    `UPDATE facturas_electronicas
     SET estado = ?, clave = ?, consecutivo = ?, json_respuesta = ?, pdf_url = ?
     WHERE id = ?`
  ).run(
    respuesta.estado || 'enviado',
    respuesta.clave || factura.clave || '',
    respuesta.consecutivo || factura.consecutivo || '',
    JSON.stringify(respuesta),
    respuesta.pdf_url || factura.pdf_url || null,
    facturaId
  );

  return {
    ok: true,
    id: facturaId,
    estado: respuesta.estado || 'enviado',
    clave: respuesta.clave || factura.clave || '',
    consecutivo: respuesta.consecutivo || factura.consecutivo || '',
    pdf_url: respuesta.pdf_url || null,
    mensaje: 'Factura enviada al proveedor / Hacienda.'
  };
}

function getFacturaByAbono(db, abonoId) {
  return db
    .prepare('SELECT * FROM facturas_electronicas WHERE abono_id = ? ORDER BY id DESC LIMIT 1')
    .get(abonoId);
}

function listarFacturasOrden(db, ordenId) {
  return db
    .prepare(
      `SELECT id, orden_id, abono_id, clave, consecutivo, estado,
              receptor_nombre, total, fecha_emision, pdf_url
       FROM facturas_electronicas WHERE orden_id = ? ORDER BY id DESC`
    )
    .all(ordenId);
}

function parseListOpts(limitOrOpts, q) {
  if (limitOrOpts && typeof limitOrOpts === 'object') {
    return limitOrOpts;
  }
  return { limit: limitOrOpts, q: q };
}

function sqlFiltroFacturas(opts) {
  const empresaService = require('./empresa-service');
  const empresaId = empresaService.getEmpresaActivaId(opts.db);
  const where = [];
  const params = [];

  if (empresaId) {
    where.push('(fe.orden_id IS NULL OR o.empresa_id = ?)');
    params.push(empresaId);
  }

  const busqueda = String(opts.q || '').trim().toLowerCase();
  if (busqueda) {
    const like = '%' + busqueda + '%';
    where.push(
      `(LOWER(IFNULL(fe.receptor_nombre, '')) LIKE ?
        OR LOWER(IFNULL(fe.consecutivo, '')) LIKE ?
        OR LOWER(IFNULL(fe.clave, '')) LIKE ?
        OR LOWER(IFNULL(l.descripcion, '')) LIKE ?
        OR LOWER(IFNULL(i.codigo, '')) LIKE ?
        OR LOWER(IFNULL(i.nombre, '')) LIKE ?
        OR LOWER(IFNULL(i.cabys, '')) LIKE ?
        OR LOWER(IFNULL(fe.json_envio, '')) LIKE ?)`
    );
    params.push(like, like, like, like, like, like, like, like);
  }

  const estado = String(opts.estado || '').trim().toLowerCase();
  if (estado === 'aceptada') {
    where.push("LOWER(IFNULL(fe.estado, '')) IN ('aceptado', 'aceptada', 'enviado')");
  } else if (estado === 'rechazada') {
    where.push("LOWER(IFNULL(fe.estado, '')) IN ('rechazado', 'rechazada', 'error')");
  } else if (estado === 'pendiente') {
    where.push(
      "LOWER(IFNULL(fe.estado, '')) NOT IN ('aceptado', 'aceptada', 'enviado', 'tiquete', 'simulado', 'simulada', 'tico_manual')"
    );
  } else if (estado === 'tiquete') {
    where.push("LOWER(IFNULL(fe.estado, '')) = 'tiquete'");
  } else if (estado === 'simulada') {
    where.push("LOWER(IFNULL(fe.estado, '')) IN ('simulado', 'simulada')");
  } else if (estado === 'tico') {
    where.push("LOWER(IFNULL(fe.estado, '')) = 'tico_manual'");
  }

  const tipo = String(opts.tipo || '').trim().toLowerCase();
  if (tipo === 'fe') {
    where.push("LOWER(IFNULL(fe.estado, '')) NOT IN ('tiquete')");
  } else if (tipo === 'tiquete') {
    where.push("LOWER(IFNULL(fe.estado, '')) = 'tiquete'");
  }

  if (opts.desde) {
    where.push('date(fe.fecha_emision) >= date(?)');
    params.push(String(opts.desde).slice(0, 10));
  }
  if (opts.hasta) {
    where.push('date(fe.fecha_emision) <= date(?)');
    params.push(String(opts.hasta).slice(0, 10));
  }

  return {
    empresaId: empresaId,
    whereSql: where.length ? ' WHERE ' + where.join(' AND ') : '',
    params: params,
    joinBusqueda: busqueda
      ? `
       LEFT JOIN taller_orden_lineas l ON l.orden_id = fe.orden_id
       LEFT JOIN taller_inventario i ON i.id = l.inventario_id`
      : ''
  };
}

function listarFacturas(db, limitOrOpts, q) {
  const opts = parseListOpts(limitOrOpts, q);
  opts.db = db;
  const lim = Math.min(parseInt(opts.limit, 10) || 20, 500);
  const filtro = sqlFiltroFacturas(opts);
  const params = filtro.params.slice();
  params.push(lim);
  return db
    .prepare(
      `SELECT DISTINCT fe.id, fe.orden_id, fe.abono_id, fe.clave, fe.consecutivo, fe.estado,
              fe.receptor_nombre, fe.total, fe.fecha_emision, fe.pdf_url
       FROM facturas_electronicas fe
       LEFT JOIN taller_ordenes o ON o.id = fe.orden_id` +
        filtro.joinBusqueda +
        filtro.whereSql +
        `
       ORDER BY fe.id DESC
       LIMIT ?`
    )
    .all(...params);
}

function contarAlertasFacturas(db) {
  const filtro = sqlFiltroFacturas({ db: db });
  const baseFrom =
    ' FROM facturas_electronicas fe LEFT JOIN taller_ordenes o ON o.id = fe.orden_id';
  const pendWhere =
    filtro.whereSql
      ? filtro.whereSql + " AND LOWER(IFNULL(fe.estado, '')) NOT IN ('aceptado', 'aceptada', 'enviado', 'tiquete', 'simulado', 'simulada', 'tico_manual')"
      : " WHERE LOWER(IFNULL(fe.estado, '')) NOT IN ('aceptado', 'aceptada', 'enviado', 'tiquete', 'simulado', 'simulada', 'tico_manual')" +
        (filtro.empresaId ? ' AND (fe.orden_id IS NULL OR o.empresa_id = ?)' : '');
  const rechWhere =
    filtro.whereSql
      ? filtro.whereSql + " AND LOWER(IFNULL(fe.estado, '')) IN ('rechazado', 'rechazada', 'error')"
      : " WHERE LOWER(IFNULL(fe.estado, '')) IN ('rechazado', 'rechazada', 'error')" +
        (filtro.empresaId ? ' AND (fe.orden_id IS NULL OR o.empresa_id = ?)' : '');

  const pParams = filtro.empresaId ? filtro.params : [];
  const pendientes = db.prepare('SELECT COUNT(DISTINCT fe.id) AS c' + baseFrom + pendWhere).get(...pParams).c || 0;
  const rechazadas = db.prepare('SELECT COUNT(DISTINCT fe.id) AS c' + baseFrom + rechWhere).get(...pParams).c || 0;
  return { pendientes: pendientes, rechazadas: rechazadas };
}

function resumenFacturas(db, opts) {
  opts = opts || {};
  opts.db = db;
  const filtro = sqlFiltroFacturas(opts);
  const rows = db
    .prepare(
      `SELECT fe.estado, fe.total, fe.json_envio
       FROM facturas_electronicas fe
       LEFT JOIN taller_ordenes o ON o.id = fe.orden_id` +
        filtro.whereSql
    )
    .all(...filtro.params);

  let totalFacturado = 0;
  let ivaEstimado = 0;
  let aceptadas = 0;
  let tiquetes = 0;
  let simuladas = 0;

  rows.forEach(function (row) {
    const total = parseFloat(row.total) || 0;
    totalFacturado += total;
    const est = String(row.estado || '').toLowerCase();
    if (est === 'aceptado' || est === 'aceptada' || est === 'enviado') aceptadas += 1;
    if (est === 'tiquete') tiquetes += 1;
    if (est === 'simulado' || est === 'simulada') simuladas += 1;
    let imp = 0;
    try {
      const payload = JSON.parse(row.json_envio || '{}');
      if (payload.totales && payload.totales.impuesto != null) {
        imp = parseFloat(payload.totales.impuesto) || 0;
      }
    } catch (e) {
      imp = Math.round((total - total / 1.13) * 100) / 100;
    }
    ivaEstimado += imp;
  });

  return {
    cantidad: rows.length,
    total_facturado: Math.round(totalFacturado * 100) / 100,
    iva_estimado: Math.round(ivaEstimado * 100) / 100,
    aceptadas: aceptadas,
    tiquetes: tiquetes,
    simuladas: simuladas
  };
}

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportarFacturasCsv(db, opts) {
  opts = opts || {};
  opts.db = db;
  opts.limit = 5000;
  const filas = listarFacturas(db, opts);
  const header = [
    'Consecutivo',
    'Clave',
    'Cliente',
    'Orden',
    'Total',
    'Estado',
    'Fecha',
    'PDF'
  ];
  const lines = [header.join(',')];
  filas.forEach(function (f) {
    lines.push(
      [
        csvEscape(f.consecutivo),
        csvEscape(f.clave),
        csvEscape(f.receptor_nombre),
        csvEscape(f.orden_id),
        csvEscape(f.total),
        csvEscape(f.estado),
        csvEscape(f.fecha_emision),
        csvEscape(f.pdf_url)
      ].join(',')
    );
  });
  return lines.join('\r\n');
}

function getFacturaDetalle(db, id) {
  const row = db.prepare('SELECT * FROM facturas_electronicas WHERE id = ?').get(id);
  if (!row) return null;
  let payload = {};
  let respuesta = {};
  try {
    payload = JSON.parse(row.json_envio || '{}');
  } catch (e) {
    payload = {};
  }
  try {
    respuesta = JSON.parse(row.json_respuesta || '{}');
  } catch (e2) {
    respuesta = {};
  }
  return {
    id: row.id,
    orden_id: row.orden_id,
    abono_id: row.abono_id,
    clave: row.clave,
    consecutivo: row.consecutivo,
    estado: row.estado,
    receptor_identificacion: row.receptor_identificacion,
    receptor_nombre: row.receptor_nombre,
    receptor_email: row.receptor_email,
    total: row.total,
    fecha_emision: row.fecha_emision,
    pdf_url: row.pdf_url,
    lineas: payload.lineas || [],
    totales: payload.totales || {},
    respuesta: respuesta
  };
}

function validarOrdenParaFe(db, ordenId) {
  const errors = [];
  const warnings = [];

  try {
    validarLineasParaFe(db, ordenId);
  } catch (e) {
    errors.push(String(e.message || e).replace(/\n• /g, '; '));
  }

  const orden = db
    .prepare(
      `SELECT o.id, o.numero, c.nombre AS cliente_nombre, c.identificacion AS cliente_cedula, c.email AS cliente_email
       FROM taller_ordenes o
       LEFT JOIN taller_clientes c ON c.id = o.cliente_id
       WHERE o.id = ?`
    )
    .get(ordenId);

  if (!orden) {
    errors.push('Orden no encontrada');
    return { ok: false, errors: errors, warnings: warnings };
  }

  if (!orden.cliente_cedula) {
    warnings.push('Cliente sin cédula en ficha — indíquela al cobrar con factura electrónica.');
  }
  if (!orden.cliente_nombre) {
    warnings.push('Cliente sin nombre completo en ficha.');
  }

  const cfg = getConfig(db);
  if (cfg.fe_modo === 'api') {
    if (!cfg.fe_emisor_cedula || !cfg.fe_emisor_nombre) {
      errors.push('Configure cédula y nombre del emisor en Configuración → Factura electrónica.');
    }
    if ((cfg.fe_proveedor || 'pendiente') === 'pendiente') {
      errors.push('Seleccione proveedor FE en Configuración o use modo Simulación.');
    }
    if (!cfg.fe_api_token) {
      errors.push('Falta token del proveedor FE en Configuración.');
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    cliente: {
      nombre: orden.cliente_nombre || '',
      identificacion: orden.cliente_cedula || '',
      email: orden.cliente_email || ''
    }
  };
}

function registrarFacturaTicoManual(db, opts) {
  const ordenId = parseInt(opts.ordenId, 10);
  const clave = String(opts.clave || '').trim();
  const consecutivo = String(opts.consecutivo || '').trim();
  if (!ordenId) throw new Error('Indique la orden');
  if (!clave) throw new Error('Indique la clave de Hacienda');

  const orden = db
    .prepare('SELECT id, numero, total FROM taller_ordenes WHERE id = ?')
    .get(ordenId);
  if (!orden) throw new Error('Orden no encontrada');

  const existente = db
    .prepare(
      "SELECT id FROM facturas_electronicas WHERE orden_id = ? AND estado = 'tico_manual' AND clave = ? LIMIT 1"
    )
    .get(ordenId, clave);
  if (existente) {
    return { ok: true, ya_registrada: true, id: existente.id, clave: clave, consecutivo: consecutivo };
  }

  const receptor = opts.receptor || {};
  const total =
    opts.total != null ? Math.round(parseFloat(opts.total) * 100) / 100 : parseFloat(orden.total) || 0;
  const payload = {
    tipo: 'tico_manual',
    orden_id: ordenId,
    clave: clave,
    consecutivo: consecutivo,
    receptor: receptor,
    totales: { total: total },
    mensaje: 'Registrada manualmente desde TicoFactura / TRIBU-CR'
  };

  const id = db
    .prepare(
      `INSERT INTO facturas_electronicas
       (orden_id, abono_id, clave, consecutivo, estado,
        receptor_identificacion, receptor_nombre, receptor_email,
        total, json_envio, json_respuesta, pdf_url)
       VALUES (?, NULL, ?, ?, 'tico_manual', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ordenId,
      clave,
      consecutivo || '',
      receptor.identificacion || '',
      receptor.nombre || '',
      receptor.email || '',
      total,
      JSON.stringify(payload),
      JSON.stringify({ origen: 'tico_manual', registrado: new Date().toISOString() }),
      opts.pdf_url || null
    ).lastInsertRowid;

  return { ok: true, id: id, clave: clave, consecutivo: consecutivo, total: total, estado: 'tico_manual' };
}

function nextConsecutivoTiquete(db) {
  const key = 'factura_tiquete_consecutivo';
  const actual = parseInt(getConfigValue(db, key, '0'), 10) || 0;
  const siguiente = actual + 1;
  upsertConfig(db, key, String(siguiente));
  return 'T-' + pad(siguiente, 6);
}

function mapFacturaExistente(row) {
  if (!row) return null;
  return {
    ok: true,
    ya_emitida: true,
    tipo: row.estado === 'tiquete' ? 'tiquete' : 'electronica',
    id: row.id,
    clave: row.clave || '',
    consecutivo: row.consecutivo || '',
    estado: row.estado,
    total: row.total
  };
}

function registrarFacturaTiquete(db, opts) {
  const existente = getFacturaByAbono(db, opts.abonoId);
  if (existente) {
    return mapFacturaExistente(existente);
  }

  const orden = db
    .prepare('SELECT id, numero, total FROM taller_ordenes WHERE id = ?')
    .get(opts.ordenId);
  if (!orden) {
    throw new Error('Orden no encontrada');
  }

  const receptor = opts.receptor || {};
  const consecutivo = nextConsecutivoTiquete(db);
  const total = Math.round(parseFloat(opts.monto != null ? opts.monto : orden.total) * 100) / 100;
  const payload = {
    tipo: 'tiquete',
    taller: true,
    orden_id: opts.ordenId,
    abono_id: opts.abonoId,
    consecutivo: consecutivo,
    receptor: {
      identificacion: receptor.identificacion || '',
      nombre: receptor.nombre || '',
      email: receptor.email || ''
    },
    totales: { total: total }
  };

  const id = db
    .prepare(
      `INSERT INTO facturas_electronicas
       (orden_id, abono_id, clave, consecutivo, estado,
        receptor_identificacion, receptor_nombre, receptor_email,
        total, json_envio, json_respuesta, pdf_url)
       VALUES (?, ?, '', ?, 'tiquete', ?, ?, ?, ?, ?, ?, NULL)`
    )
    .run(
      opts.ordenId,
      opts.abonoId,
      consecutivo,
      payload.receptor.identificacion,
      payload.receptor.nombre,
      payload.receptor.email,
      total,
      JSON.stringify(payload),
      JSON.stringify({ mensaje: 'Factura de tiquete (no electrónica)' })
    ).lastInsertRowid;

  return {
    ok: true,
    tipo: 'tiquete',
    id: id,
    consecutivo: consecutivo,
    clave: '',
    total: total,
    estado: 'tiquete',
    mensaje: 'Factura de tiquete registrada (sin envío a Hacienda)'
  };
}

async function probarConexion(db) {
  const cfg = getConfig(db);
  if (cfg.fe_modo === 'simulacion') {
    return {
      ok: true,
      modo: 'simulacion',
      mensaje: 'Modo simulación activo — no se requiere API externa'
    };
  }
  if (!cfg.fe_api_url) {
    throw new Error('Indique la URL de la API');
  }

  const url = cfg.fe_api_url.replace(/\/$/, '');
  const pingUrl = url + (url.endsWith('/health') ? '' : '/health');
  const headers = { Accept: 'application/json' };
  if (cfg.fe_api_token) {
    headers.Authorization = 'Bearer ' + cfg.fe_api_token;
  }

  try {
    const res = await fetch(pingUrl, { method: 'GET', headers: headers });
    if (res.ok) {
      return { ok: true, modo: 'api', mensaje: 'Conexión correcta con ' + pingUrl };
    }
  } catch (e) {
    /* intentar POST de prueba mínimo */
  }

  return {
    ok: true,
    modo: 'api',
    mensaje: 'URL configurada. La prueba completa se hará al emitir la primera factura.'
  };
}

function fmtColonesGuia(n) {
  return '₡' + (Math.round(Number(n) || 0)).toLocaleString('es-CR');
}

function guiaTicoFactura(db, ordenId) {
  const pack = tallerService.obtenerOrden(db, ordenId);
  if (!pack || !pack.orden) {
    throw new Error('Orden no encontrada');
  }
  const o = pack.orden;
  const cfg = getConfig(db);
  const lineas = buildLineasDesdeOrden(db, ordenId);
  if (!lineas.length) {
    throw new Error('La orden no tiene líneas para facturar. Agregue repuestos o mano de obra primero.');
  }

  const subtotal = lineas.reduce(function (s, l) { return s + (Number(l.subtotal) || 0); }, 0);
  const impuesto = lineas.reduce(function (s, l) { return s + (Number(l.impuesto) || 0); }, 0);
  const total = lineas.reduce(function (s, l) { return s + (Number(l.total_linea) || 0); }, 0);

  const clienteNombre = o.cliente_nombre || 'Consumidor final';
  const clienteId = String(o.cliente_identificacion || '').trim();
  const advertencias = [];
  if (!cfg.fe_emisor_cedula) {
    advertencias.push('Configure la cédula del emisor en Configuración FE.');
  }
  if (!clienteId) {
    advertencias.push('La orden no tiene cédula del cliente; en TicoFactura puede usar Consumidor final.');
  }
  lineas.forEach(function (l) {
    if (!l.codigo_cabys || String(l.codigo_cabys).length < 13) {
      advertencias.push('Revise CABYS en la línea: ' + l.descripcion);
    }
  });

  const pasos = [
    'Entre a TRIBU-CR (enlace abajo) con usuario y contraseña de Hacienda.',
    'Abra TicoFactura → Comprobantes electrónicos → Nueva factura.',
    'Complete receptor: nombre, identificación y correo si aplica.',
    'Agregue cada línea: CABYS, descripción, cantidad, precio unitario e IVA 13%.',
    'Verifique totales, firme y envíe a Hacienda. Descargue PDF y XML.'
  ];

  let texto = '=== SANMY → TICOFACTURA — Orden #' + o.numero + ' ===\n';
  texto += 'Vehículo: ' + (o.placa || '') + ' · ' + (o.marca || '') + ' ' + (o.modelo || '') + '\n\n';
  texto += '--- RECEPTOR ---\n';
  texto += 'Nombre: ' + clienteNombre + '\n';
  texto += 'Identificación: ' + (clienteId || '(Consumidor final)') + '\n';
  if (o.cliente_email) texto += 'Correo: ' + o.cliente_email + '\n';
  if (o.cliente_telefono) texto += 'Teléfono: ' + o.cliente_telefono + '\n';
  texto += '\n--- EMISOR (su taller) ---\n';
  texto += 'Cédula: ' + (cfg.fe_emisor_cedula || '(pendiente en Config FE)') + '\n';
  texto += 'Nombre: ' + (cfg.fe_emisor_nombre || 'Sanmy Taller Mecánico') + '\n';
  texto += 'Actividad: ' + (cfg.fe_actividad_economica || '452000') + '\n';
  texto += '\n--- LÍNEAS ---\n';
  lineas.forEach(function (l) {
    texto += '\n' + l.numero_linea + '. ' + l.descripcion + '\n';
    texto += '   CABYS: ' + l.codigo_cabys + '\n';
    texto += '   Cant: ' + l.cantidad + ' ' + l.unidad_medida + ' × ' + fmtColonesGuia(l.precio_unitario) + '\n';
    texto += '   Subtotal: ' + fmtColonesGuia(l.subtotal) + ' | IVA: ' + fmtColonesGuia(l.impuesto) + ' | Total: ' + fmtColonesGuia(l.total_linea) + '\n';
  });
  texto += '\n--- TOTALES ---\n';
  texto += 'Subtotal: ' + fmtColonesGuia(subtotal) + '\n';
  texto += 'IVA: ' + fmtColonesGuia(impuesto) + '\n';
  texto += 'TOTAL: ' + fmtColonesGuia(total) + '\n';
  texto += '\nPortal TRIBU-CR: ' + TRIBU_URL + '\n';

  return {
    ok: true,
    url_tribu: TRIBU_URL,
    orden_id: ordenId,
    orden_numero: o.numero,
    placa: o.placa || '',
    receptor: {
      nombre: clienteNombre,
      identificacion: clienteId,
      email: o.cliente_email || '',
      telefono: o.cliente_telefono || ''
    },
    emisor: {
      cedula: cfg.fe_emisor_cedula || '',
      nombre: cfg.fe_emisor_nombre || '',
      actividad: cfg.fe_actividad_economica || '452000'
    },
    lineas: lineas,
    subtotal: subtotal,
    impuesto: impuesto,
    total: total,
    pasos: pasos,
    texto_copiar: texto,
    advertencias: advertencias
  };
}

module.exports = {
  getConfig,
  saveConfig,
  emitirDesdeCobro,
  registrarFacturaTiquete,
  enviarAHacienda,
  getFacturaByAbono,
  listarFacturasOrden,
  listarFacturas,
  contarAlertasFacturas,
  resumenFacturas,
  exportarFacturasCsv,
  getFacturaDetalle,
  validarOrdenParaFe,
  registrarFacturaTicoManual,
  probarConexion,
  validarLineasParaFe,
  getProveedores: function () {
    return feProviders.PROVEEDORES;
  },
  guiaTicoFactura: guiaTicoFactura
};
