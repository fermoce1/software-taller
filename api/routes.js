const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');
const { getDb, DB_PATH, getConfig, setConfig, closeDb, reopenDb } = require('../db/database');
const { imprimirTicket, imprimirPrueba } = require('./print-service');
const tallerService = require('./taller-service');
const feService = require('./fe-service');
const pdfService = require('./pdf-service');
const whatsappService = require('./whatsapp-service');
const ticketService = require('./ticket-service');
const usuarioService = require('./usuario-service');
const empresaService = require('./empresa-service');
const licenciaService = require('./licencia-service');
const metodosPagoService = require('./metodos-pago-service');
const logoService = require('./logo-service');
const backupService = require('./backup-service');

const router = express.Router();
const APP_ROOT = path.join(__dirname, '..');

const TIPOS_DOC_WHATSAPP = ['orden', 'presupuesto', 'factura'];

function normalizarTipoDoc(tipo) {
  var t = String(tipo || 'orden').toLowerCase();
  return TIPOS_DOC_WHATSAPP.indexOf(t) >= 0 ? t : 'orden';
}

function publicBaseUrl(req) {
  return req.protocol + '://' + req.get('host');
}

function obtenerFacturaFeOrden(db, ordenId) {
  var facturas = feService.listarFacturasOrden(db, ordenId);
  return facturas && facturas.length ? facturas[0] : null;
}

async function procesarDocumentoFactura(db, body, ordenId, data) {
  const feReq = body.factura_electronica || {};
  const emitirFe = feReq.emitir === true;

  if (!data.abono_id) {
    return emitirFe
      ? { ok: false, error: 'No se registr? el cobro para vincular la factura' }
      : null;
  }

  const existente = feService.getFacturaByAbono(db, data.abono_id);
  if (existente) {
    return {
      ok: true,
      ya_emitida: true,
      tipo: existente.estado === 'tiquete' ? 'tiquete' : 'electronica',
      id: existente.id,
      clave: existente.clave || '',
      consecutivo: existente.consecutivo || '',
      estado: existente.estado,
      total: existente.total
    };
  }

  const receptor = {
    tipo_identificacion: feReq.tipo_identificacion || '01',
    identificacion: feReq.identificacion || body.cliente_identificacion || '',
    nombre: feReq.nombre || body.cliente_nombre || '',
    email: feReq.email || ''
  };

  if (!emitirFe) {
    return feService.registrarFacturaTiquete(db, {
      ordenId: parseInt(ordenId, 10),
      abonoId: data.abono_id,
      monto: data.monto_cobrado_ahora,
      receptor: receptor
    });
  }

  try {
    return await feService.emitirDesdeCobro(db, {
      ordenId: parseInt(ordenId, 10),
      abonoId: data.abono_id,
      monto: data.monto_cobrado_ahora,
      metodo_pago: body.metodo_pago,
      receptor: receptor
    });
  } catch (feErr) {
    return {
      ok: false,
      error: feErr.message || 'Error al emitir factura electr?nica'
    };
  }
}

function getLocalNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  Object.values(interfaces).forEach(function (iface) {
    iface.forEach(function (addr) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    });
  });
  return ips;
}

const TERMINAL_IP_FILE = path.join(__dirname, '..', 'sanmy-taller-terminal-ip.txt');

function readTerminalIp() {
  try {
    if (fs.existsSync(TERMINAL_IP_FILE)) {
      return fs.readFileSync(TERMINAL_IP_FILE, 'utf8').trim();
    }
  } catch (e) {
    /* ignore */
  }
  return '';
}

function isValidIpv4(ip) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(String(ip || '').trim());
}

function buildTerminalUrl(ip, port) {
  return 'http://' + ip + ':' + port + '/abrir.html';
}

async function decodificarQrDesdeBuffer(buf) {
  const img = await Jimp.read(buf);
  const scales = [1, 1.5, 2, 0.6, 0.75];
  for (let i = 0; i < scales.length; i++) {
    const scale = scales[i];
    const w = Math.max(1, Math.round(img.bitmap.width * scale));
    const h = Math.max(1, Math.round(img.bitmap.height * scale));
    const clone = img.clone().resize({ w, h });
    const { data, width, height } = clone.bitmap;
    const code = jsQR(new Uint8ClampedArray(data), width, height);
    if (code && code.data) return String(code.data).trim();
  }
  return null;
}

function pickBestTerminalIp(ips) {
  if (!ips.length) return '';
  const stored = readTerminalIp();
  if (stored && ips.indexOf(stored) >= 0) return stored;
  const lan = ips.filter(function (ip) {
    return /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);
  }).filter(function (ip) {
    return !/^169\.254\./.test(ip) && !/^100\./.test(ip);
  });
  if (lan.length) return lan[0];
  return ips[0];
}

function resolveTerminalIp() {
  const ips = getLocalNetworkIPs();
  const stored = readTerminalIp();
  if (stored && isValidIpv4(stored) && ips.indexOf(stored) >= 0) return stored;
  return pickBestTerminalIp(ips);
}

router.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'Sanmy Taller API', version: '1.0.0' });
});

router.get('/licencia/estado', (req, res) => {
  try {
    const db = getDb();
    res.json(licenciaService.obtenerEstado(db, APP_ROOT));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/licencia/activar', (req, res) => {
  try {
    const db = getDb();
    res.json(licenciaService.activarLicencia(db, APP_ROOT, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/red/decodificar-qr', async function (req, res) {
  try {
    let buf = null;
    if (req.body && req.body.imagen) {
      const raw = String(req.body.imagen);
      const b64 = raw.replace(/^data:[^;]+;base64,/, '');
      buf = Buffer.from(b64, 'base64');
    }
    if (!buf || !buf.length) {
      return res.status(400).json({ ok: false, error: 'Envíe la imagen en el campo "imagen" (base64)' });
    }
    const texto = await decodificarQrDesdeBuffer(buf);
    if (!texto) {
      return res.status(422).json({ ok: false, error: 'No se encontró código QR en la imagen' });
    }
    res.json({ ok: true, texto: texto });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Error al leer QR' });
  }
});

router.use(function (req, res, next) {
  if (licenciaService.licenciaOmitida()) return next();
  try {
    const db = getDb();
    const estado = licenciaService.obtenerEstado(db, APP_ROOT);
    if (estado.valida) return next();
    res.status(403).json({
      error: estado.error || 'Licencia no v?lida o no activada',
      codigo: 'LICENCIA_REQUERIDA'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/usuarios', (req, res) => {
  try {
    const db = getDb();
    const todos = req.query.todos === '1' || req.query.todos === 'true';
    const filas = usuarioService.listarUsuarios(db, { todos: todos, q: req.query.q });
    res.json({ filas: filas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/usuarios/login', (req, res) => {
  try {
    const db = getDb();
    const usuario = usuarioService.loginUsuario(db, req.body || {});
    res.json({ ok: true, usuario: usuario });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

router.get('/usuarios/:id', (req, res) => {
  try {
    const db = getDb();
    const usuario = usuarioService.obtenerUsuario(db, parseInt(req.params.id, 10));
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ usuario: usuario });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/usuarios', (req, res) => {
  try {
    const db = getDb();
    const usuario = usuarioService.crearUsuario(db, req.body || {});
    res.status(201).json({ usuario: usuario });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/usuarios/:id', (req, res) => {
  try {
    const db = getDb();
    const usuario = usuarioService.actualizarUsuario(db, parseInt(req.params.id, 10), req.body || {});
    res.json({ usuario: usuario });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/usuarios/:id', (req, res) => {
  try {
    const db = getDb();
    usuarioService.desactivarUsuario(db, parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/red/info', (req, res) => {
  const port = parseInt(process.env.PORT, 10) || 3020;
  const ips = getLocalNetworkIPs();
  const ipActiva = resolveTerminalIp();
  res.json({
    ok: true,
    hostname: os.hostname(),
    port,
    ips,
    ip_activa: ipActiva,
    url_terminal: ipActiva ? buildTerminalUrl(ipActiva, port) : null
  });
});

router.get('/red/terminal', (req, res) => {
  const port = parseInt(process.env.PORT, 10) || 3020;
  const ips = getLocalNetworkIPs();
  const ipActiva = resolveTerminalIp();
  res.json({
    ok: true,
    port,
    ips,
    ip_activa: ipActiva,
    url: ipActiva ? buildTerminalUrl(ipActiva, port) : null
  });
});

router.get('/red/qr.png', async function (req, res) {
  try {
    const port = parseInt(process.env.PORT, 10) || 3020;
    let url = req.query.url ? String(req.query.url).trim() : '';
    if (!url) {
      const ip = resolveTerminalIp();
      if (!ip) {
        return res.status(400).json({ ok: false, error: 'Sin IP configurada' });
      }
      url = buildTerminalUrl(ip, port);
    }
    res.type('png');
    await QRCode.toFileStream(res, url, { margin: 2, width: 512, errorCorrectionLevel: 'M' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'No se pudo generar el QR' });
  }
});

router.get('/taller/ordenes', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.listarOrdenes(db, req.query));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/taller/ordenes/:id', (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.obtenerOrden(db, req.params.id);
    if (!data) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/taller/ordenes', (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.crearOrden(db, req.body);
    res.status(201).json({ ok: true, ...data });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/taller/ordenes/:id', (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.actualizarOrden(db, req.params.id, req.body);
    res.json({ ok: true, ...data });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/taller/ordenes/:id/lineas', (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.agregarLinea(db, req.params.id, req.body);
    res.status(201).json({ ok: true, ...data });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/taller/ordenes/:id/lineas/:lineaId', (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.eliminarLinea(db, req.params.id, req.params.lineaId);
    res.json({ ok: true, ...data });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/taller/ordenes/:id/fotos', (req, res) => {
  try {
    const db = getDb();
    const foto = tallerService.agregarFoto(db, req.params.id, req.body);
    res.status(201).json({ ok: true, foto });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


router.post('/taller/ordenes/:id/facturar', async (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.facturarDesdeProforma(db, req.params.id, req.body || {});
    const facturaElectronica = await procesarDocumentoFactura(
      db,
      req.body,
      req.params.id,
      data
    );
    res.json({ ok: true, ...data, factura_electronica: facturaElectronica });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.post('/taller/ordenes/:id/cobrar', async (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.cobrarOrden(db, req.params.id, req.body);
    const facturaElectronica = await procesarDocumentoFactura(
      db,
      req.body,
      req.params.id,
      data
    );
    res.json({ ok: true, ...data, factura_electronica: facturaElectronica });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/taller/ordenes/:id/abono', async (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.registrarAbono(db, req.params.id, req.body);
    const facturaElectronica = await procesarDocumentoFactura(
      db,
      req.body,
      req.params.id,
      data
    );
    res.json({ ok: true, ...data, factura_electronica: facturaElectronica });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/taller/resumen-hoy', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.resumenHoy(db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/taller/creditos/pendientes', (req, res) => {
  try {
    const db = getDb();
    const data = tallerService.listarPendientesCobro(db);
    const tipo = req.query.tipo;
    if (tipo === 'credito' || tipo === 'apartado') {
      data.filas = data.filas.filter(function (o) {
        return o.tipo_cobro === tipo;
      });
      data.cantidad = data.filas.length;
      data.saldo_total = data.filas.reduce(function (s, o) {
        return s + (Number(o.saldo_pendiente) || 0);
      }, 0);
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/taller/clientes', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.listarClientes(db, req.query));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/taller/clientes/:id/vehiculos', (req, res) => {
  try {
    const db = getDb();
    res.json({ filas: tallerService.obtenerClienteVehiculos(db, req.params.id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/taller/clientes', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.crearCliente(db, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/taller/clientes/:id', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.actualizarCliente(db, req.params.id, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/taller/cxp', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.listarCuentasPagar(db, req.query));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/taller/cxp', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.crearCuentaPagar(db, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/taller/cxp/:id', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.actualizarCuentaPagar(db, req.params.id, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/taller/cxp/:id', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.eliminarCuentaPagar(db, req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/taller/inventario', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.listarInventario(db, req.query));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/taller/inventario', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.crearItemInventario(db, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/taller/inventario/:id', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.actualizarItemInventario(db, req.params.id, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/taller/inventario/:id', (req, res) => {
  try {
    const db = getDb();
    res.json(tallerService.eliminarItemInventario(db, req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function leerPedirLoginIngreso(db) {
  return getConfig(db, 'pedir_login_ingreso', '0') === '1';
}

router.get('/taller/config/acceso', (req, res) => {
  try {
    const db = getDb();
    res.json({ pedir_login_ingreso: leerPedirLoginIngreso(db) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/taller/config', (req, res) => {
  try {
    const db = getDb();
    const activaId = empresaService.getEmpresaActivaId(db);
    res.json({
      nombre_negocio: getConfig(db, 'nombre_negocio', 'SANMY Taller Mec?nico'),
      impuesto_iva: getConfig(db, 'impuesto_iva', '0.13'),
      empresa_activa_id: activaId,
      pedir_login_ingreso: leerPedirLoginIngreso(db),
      metodos_pago: metodosPagoService.getMetodosActivos(db),
      logo_url: activaId ? logoService.urlLogo(activaId) : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/taller/config', (req, res) => {
  try {
    const db = getDb();
    const body = req.body || {};
    if (body.nombre_negocio != null) {
      setConfig(db, 'nombre_negocio', String(body.nombre_negocio).trim());
    }
    if (body.impuesto_iva != null) {
      setConfig(db, 'impuesto_iva', String(body.impuesto_iva));
    }
    if (body.pedir_login_ingreso != null) {
      setConfig(db, 'pedir_login_ingreso', body.pedir_login_ingreso ? '1' : '0');
    }
    empresaService.persistirDesdeConfigGlobal(db, body);
    res.json({
      ok: true,
      nombre_negocio: getConfig(db, 'nombre_negocio', 'SANMY Taller Mec?nico'),
      impuesto_iva: getConfig(db, 'impuesto_iva', '0.13'),
      empresa_activa_id: empresaService.getEmpresaActivaId(db),
      pedir_login_ingreso: leerPedirLoginIngreso(db),
      metodos_pago: metodosPagoService.getMetodosActivos(db)
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/taller/metodos-pago', (req, res) => {
  try {
    const db = getDb();
    const todos = req.query.todos === '1' || req.query.todos === 'true';
    res.json({
      metodos: todos ? metodosPagoService.getTodosMetodos(db) : metodosPagoService.getMetodosActivos(db),
      todos: metodosPagoService.getTodosMetodos(db)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/taller/metodos-pago', (req, res) => {
  try {
    const db = getDb();
    const lista = metodosPagoService.guardarMetodos(db, (req.body && req.body.metodos) || []);
    res.json({ ok: true, metodos: lista });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// =============================================================================
// RUTAS DE EMPRESAS (multi-empresa)
// La pantalla de Configuraci?n llama a estas URLs para crear, editar y activar empresas.
// =============================================================================

router.get('/taller/empresas', (req, res) => {
  try {
    const db = getDb();
    res.json(empresaService.listarEmpresas(db));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Obtiene una empresa por id (para editar). */
router.get('/taller/empresas/:id', (req, res) => {
  try {
    const db = getDb();
    const emp = empresaService.obtenerEmpresa(db, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(emp);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Crea una empresa nueva (POST = guardar por primera vez). */
router.post('/taller/empresas', (req, res) => {
  try {
    const db = getDb();
    res.status(201).json(empresaService.crearEmpresa(db, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Actualiza datos de una empresa ya existente. */
router.patch('/taller/empresas/:id', (req, res) => {
  try {
    const db = getDb();
    res.json(empresaService.actualizarEmpresa(db, parseInt(req.params.id, 10), req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** El usuario eligi? "Usar esta empresa": la ponemos como activa en todo el sistema. */
router.post('/taller/empresas/:id/activar', (req, res) => {
  try {
    const db = getDb();
    res.json(empresaService.activarEmpresa(db, parseInt(req.params.id, 10)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Desactiva una empresa (no borra la base de datos, solo la oculta de la lista). */
router.delete('/taller/empresas/:id', (req, res) => {
  try {
    const db = getDb();
    res.json(empresaService.eliminarEmpresa(db, parseInt(req.params.id, 10)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/taller/logo', (req, res) => {
  try {
    const db = getDb();
    let id = parseInt(req.query.empresa_id, 10);
    if (!id) id = empresaService.getEmpresaActivaId(db);
    if (!id) return res.status(404).type('text/plain').send('Sin logo');
    const info = logoService.leerLogo(id);
    if (!info) return res.status(404).type('text/plain').send('Sin logo');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.type(info.mime);
    res.sendFile(info.path);
  } catch (e) {
    res.status(500).type('text/plain').send(e.message);
  }
});

router.post('/taller/empresas/:id/logo', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = getDb();
    const emp = empresaService.obtenerEmpresa(db, id);
    if (!emp) return res.status(404).json({ error: 'Empresa no encontrada' });
    const body = req.body || {};
    const imagen = body.imagen || body.data || body.base64;
    if (!imagen) return res.status(400).json({ error: 'Falta la imagen' });
    const out = logoService.guardarLogoBase64(id, imagen, body.mime || body.tipo);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/taller/empresas/:id/logo', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = getDb();
    const emp = empresaService.obtenerEmpresa(db, id);
    if (!emp) return res.status(404).json({ error: 'Empresa no encontrada' });
    logoService.eliminarLogo(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/taller/ordenes/:id/imprimir', async (req, res) => {
  try {
    const db = getDb();
    const datos = tallerService.prepararDatosTicket(db, req.params.id);
    const result = await imprimirTicket(db, {
      tipo: 'taller',
      datos: datos,
      copias: req.body && req.body.copias ? req.body.copias : 1
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Error al imprimir orden' });
  }
});

router.get('/taller/ordenes/:id/pdf', async (req, res) => {
  try {
    const db = getDb();
    const ordenId = parseInt(req.params.id, 10);
    const tipo = normalizarTipoDoc(req.query.tipo);
    const datos = tallerService.prepararDatosTicket(db, ordenId);
    const activaId = empresaService.getEmpresaActivaId(db);
    const logoInfo = activaId ? logoService.leerLogo(activaId) : null;
    const config = {
      nombre_negocio: getConfig(db, 'nombre_negocio', 'SANMY Taller Mec?nico'),
      logo_path: logoInfo ? logoInfo.path : null
    };
    const facturaFe = tipo === 'factura' ? obtenerFacturaFeOrden(db, ordenId) : null;
    const buf = await pdfService.generarPdfOrden(datos, config, tipo, { facturaFe: facturaFe });
    const filename = tipo + '-' + (datos.numero || ordenId) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.send(buf);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Error al generar PDF' });
  }
});

router.get('/taller/ordenes/:id/whatsapp', (req, res) => {
  try {
    const db = getDb();
    const ordenId = parseInt(req.params.id, 10);
    const tipo = normalizarTipoDoc(req.query.tipo);
    const datos = tallerService.prepararDatosTicket(db, ordenId);
    const config = {
      nombre_negocio: getConfig(db, 'nombre_negocio', 'SANMY Taller Mec?nico')
    };
    const base = publicBaseUrl(req);
    const pdf_url =
      base + '/api/taller/ordenes/' + ordenId + '/pdf?tipo=' + encodeURIComponent(tipo);
    const facturaFe = tipo === 'factura' ? obtenerFacturaFeOrden(db, ordenId) : null;
    const mensaje = whatsappService.buildMensaje(tipo, datos, config, {
      pdf_url: pdf_url,
      facturaFe: facturaFe
    });
    const telefonoWa = whatsappService.normalizarTelefonoWa(datos.telefono);
    res.json({
      ok: true,
      telefono: datos.telefono || '',
      telefono_wa: telefonoWa,
      tiene_telefono: !!telefonoWa,
      mensaje: mensaje,
      pdf_url: pdf_url,
      wa_url: whatsappService.buildWaUrl(datos.telefono, mensaje)
    });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Error al preparar WhatsApp' });
  }
});

router.get('/taller/vehiculos/placa', (req, res) => {
  try {
    const db = getDb();
    const vehiculo = tallerService.obtenerVehiculoPorPlaca(db, req.query.placa);
    if (!vehiculo) {
      return res.status(404).json({ error: 'Veh?culo no encontrado' });
    }
    res.json({ vehiculo: vehiculo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/taller/vehiculos', (req, res) => {
  try {
    const db = getDb();
    res.json({ filas: tallerService.buscarVehiculos(db, req.query.q) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/taller/fotos/:ordenId/:nombre', (req, res) => {
  try {
    const full = tallerService.rutaArchivoFoto(req.params.ordenId, req.params.nombre);
    if (!full) return res.status(404).end();
    const ext = path.extname(full).toLowerCase();
    const types = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    res.type(types[ext] || 'application/octet-stream');
    res.sendFile(full);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/servidor/estado', (req, res) => {
  const port = parseInt(process.env.PORT, 10) || 3020;
  const ips = getLocalNetworkIPs();
  res.json({
    ok: true,
    activo: true,
    servicio: 'Sanmy Taller API',
    port,
    local_url: 'http://localhost:' + port,
    urls_red: ips.map(function (ip) {
      return 'http://' + ip + ':' + port;
    }),
    bd: DB_PATH
  });
});

router.get('/respaldo/listar', (req, res) => {
  try {
    res.json({ ok: true, filas: backupService.listarRespaldos() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/respaldo/crear', (req, res) => {
  try {
    const db = getDb();
    const info = backupService.crearRespaldo(db);
    res.json({
      ok: true,
      respaldo: info,
      mensaje: 'Copia de seguridad creada correctamente.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'No se pudo crear el respaldo.' });
  }
});

router.get('/respaldo/descargar/:nombre', (req, res) => {
  try {
    const full = backupService.rutaRespaldoSegura(req.params.nombre);
    if (!full) return res.status(404).json({ error: 'Respaldo no encontrado.' });
    res.download(full, path.basename(full));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/respaldo/:nombre', (req, res) => {
  try {
    const full = backupService.rutaRespaldoSegura(req.params.nombre);
    if (!full) return res.status(404).json({ error: 'Respaldo no encontrado.' });
    fs.unlinkSync(full);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/respaldo/restaurar/:nombre', (req, res) => {
  try {
    const full = backupService.rutaRespaldoSegura(req.params.nombre);
    if (!full) return res.status(404).json({ error: 'Respaldo no encontrado.' });
    const db = getDb();
    const info = backupService.restaurarDesdeArchivo(full, db, DB_PATH, closeDb, reopenDb);
    res.json({
      ok: true,
      mensaje: 'Base de datos restaurada correctamente.',
      respaldo_previo: info.respaldo_previo
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'No se pudo restaurar el respaldo.' });
  }
});

router.post('/respaldo/restaurar-archivo', (req, res) => {
  let tmp = null;
  try {
    const body = req.body || {};
    tmp = backupService.guardarArchivoTemporal(body.contenido_base64 || body.base64, body.nombre);
    const db = getDb();
    const info = backupService.restaurarDesdeArchivo(tmp, db, DB_PATH, closeDb, reopenDb);
    res.json({
      ok: true,
      mensaje: 'Base de datos restaurada correctamente.',
      respaldo_previo: info.respaldo_previo
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'No se pudo restaurar el respaldo.' });
  } finally {
    if (tmp && fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
      } catch (e2) {
        /* ignore */
      }
    }
  }
});

router.get('/fe/proveedores', (req, res) => {
  try {
    res.json({ ok: true, proveedores: feService.getProveedores() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/fe/config', (req, res) => {
  try {
    const db = getDb();
    res.json({ ok: true, config: feService.getConfig(db) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/fe/config', (req, res) => {
  try {
    const db = getDb();
    const config = feService.saveConfig(db, req.body || {});
    empresaService.persistirDesdeConfigGlobal(db, {});
    res.json({ ok: true, config: config });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/fe/probar', async (req, res) => {
  try {
    const db = getDb();
    const result = await feService.probarConexion(db);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/fe/recientes', (req, res) => {
  try {
    const db = getDb();
    const facturas = feService.listarFacturas(db, {
      limit: req.query.limit,
      q: req.query.q,
      estado: req.query.estado,
      desde: req.query.desde,
      hasta: req.query.hasta,
      tipo: req.query.tipo
    });
    const alertas = feService.contarAlertasFacturas(db);
    res.json({ ok: true, facturas: facturas, alertas: alertas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/fe/resumen', (req, res) => {
  try {
    const db = getDb();
    const resumen = feService.resumenFacturas(db, {
      desde: req.query.desde,
      hasta: req.query.hasta,
      estado: req.query.estado,
      tipo: req.query.tipo
    });
    res.json({ ok: true, resumen: resumen });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/fe/export', (req, res) => {
  try {
    const db = getDb();
    const csv = feService.exportarFacturasCsv(db, {
      desde: req.query.desde,
      hasta: req.query.hasta,
      estado: req.query.estado,
      tipo: req.query.tipo,
      q: req.query.q
    });
    const nombre = 'facturas-sanmy-' + new Date().toISOString().slice(0, 10) + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + nombre + '"');
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/fe/validar-orden/:ordenId', (req, res) => {
  try {
    const db = getDb();
    const ordenId = parseInt(req.params.ordenId, 10);
    if (!ordenId) {
      return res.status(400).json({ error: 'ID de orden inv?lido' });
    }
    res.json(feService.validarOrdenParaFe(db, ordenId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/fe/tico-registrar', (req, res) => {
  try {
    const db = getDb();
    const result = feService.registrarFacturaTicoManual(db, req.body || {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/fe/detalle/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const detalle = feService.getFacturaDetalle(db, id);
    if (!detalle) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    res.json({ ok: true, factura: detalle });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/fe/orden/:ordenId', (req, res) => {
  try {
    const db = getDb();
    const ordenId = parseInt(req.params.ordenId, 10);
    res.json({ ok: true, facturas: feService.listarFacturasOrden(db, ordenId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/fe/guia-tico/:ordenId', (req, res) => {
  try {
    const db = getDb();
    const ordenId = parseInt(req.params.ordenId, 10);
    if (!ordenId) {
      return res.status(400).json({ error: 'ID de orden inv?lido' });
    }
    res.json(feService.guiaTicoFactura(db, ordenId));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/fe/:id/enviar', async (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const result = await feService.enviarAHacienda(db, id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/fe/abono/:abonoId', (req, res) => {
  try {
    const db = getDb();
    const abonoId = parseInt(req.params.abonoId, 10);
    const row = feService.getFacturaByAbono(db, abonoId);
    if (!row) {
      return res.status(404).json({ error: 'Sin factura electr?nica para este cobro' });
    }
    res.json({ ok: true, factura: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function mapImpresoraRow(row) {
  return {
    ...row,
    activa: row.activa === 1,
    predeterminada: row.predeterminada === 1
  };
}

router.get('/ticket/config', (req, res) => {
  try {
    const db = getDb();
    res.json({ ok: true, config: ticketService.getTicketConfig(db) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/ticket/config', (req, res) => {
  try {
    const db = getDb();
    const config = ticketService.saveTicketConfig(db, req.body || {});
    res.json({ ok: true, config: config });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/ticket/preview', (req, res) => {
  try {
    const db = getDb();
    const cfg = ticketService.getTicketConfig(db);
    const tipo = normalizarTipoDoc(req.query.tipo || 'factura');
    const texto = ticketService.buildPlainTextTicket(
      tipo,
      ticketService.datosPruebaTicket(),
      cfg,
      {
        prueba: false,
        facturaFe: {
          consecutivo: '0000000123',
          clave: '50625062500310112345600100001010000000023123456789',
          estado: 'simulado'
        }
      }
    );
    res.json({ ok: true, texto: texto, config: cfg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/ticket/preview', (req, res) => {
  try {
    const db = getDb();
    const saved = ticketService.getTicketConfig(db);
    const incoming = req.body || {};
    const cfg = Object.assign({}, saved, incoming);
    const tipo = normalizarTipoDoc(incoming.tipo || 'factura');
    const texto = ticketService.buildPlainTextTicket(
      tipo,
      ticketService.datosPruebaTicket(),
      cfg,
      {
        prueba: false,
        facturaFe: {
          consecutivo: '0000000123',
          clave: '50625062500310112345600100001010000000023123456789',
          estado: 'simulado'
        }
      }
    );
    res.json({ ok: true, texto: texto });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/impresoras/sistema', (req, res) => {
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        { encoding: 'utf8', timeout: 10000 }
      );
      const names = out.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      return res.json(names);
    }
    res.json([]);
  } catch (e) {
    res.json([]);
  }
});

router.get('/impresoras', (req, res) => {
  try {
    const db = getDb();
    const impresoras = db.prepare('SELECT * FROM impresoras ORDER BY orden, id').all().map(mapImpresoraRow);
    res.json({
      ok: true,
      impresoras: impresoras,
      config: ticketService.getTicketConfig(db)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/impresoras', (req, res) => {
  try {
    const db = getDb();
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const predeterminada = req.body.predeterminada ? 1 : 0;
    if (predeterminada) db.prepare('UPDATE impresoras SET predeterminada = 0').run();
    const info = db.prepare(
      `INSERT INTO impresoras (nombre, rol, conexion, nombre_sistema, ip, puerto, ancho_mm, activa, copias, predeterminada, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      nombre,
      req.body.rol || 'factura',
      req.body.conexion || 'sistema',
      (req.body.nombre_sistema || '').trim(),
      (req.body.ip || '').trim(),
      parseInt(req.body.puerto, 10) || 9100,
      parseInt(req.body.ancho_mm, 10) || 80,
      req.body.activa === false ? 0 : 1,
      Math.max(1, parseInt(req.body.copias, 10) || 1),
      predeterminada,
      parseInt(req.body.orden, 10) || 0
    );
    res.json(mapImpresoraRow(db.prepare('SELECT * FROM impresoras WHERE id = ?').get(info.lastInsertRowid)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/impresoras/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM impresoras WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Impresora no encontrada' });
    const predeterminada = req.body.predeterminada !== undefined ? (req.body.predeterminada ? 1 : 0) : existing.predeterminada;
    if (predeterminada) db.prepare('UPDATE impresoras SET predeterminada = 0').run();
    db.prepare(
      `UPDATE impresoras SET nombre = ?, rol = ?, conexion = ?, nombre_sistema = ?, ip = ?, puerto = ?,
       ancho_mm = ?, activa = ?, copias = ?, predeterminada = ?, orden = ? WHERE id = ?`
    ).run(
      (req.body.nombre || existing.nombre).trim(),
      req.body.rol || existing.rol,
      req.body.conexion || existing.conexion,
      req.body.nombre_sistema !== undefined ? (req.body.nombre_sistema || '').trim() : existing.nombre_sistema,
      req.body.ip !== undefined ? (req.body.ip || '').trim() : existing.ip,
      req.body.puerto !== undefined ? parseInt(req.body.puerto, 10) || 9100 : existing.puerto,
      req.body.ancho_mm !== undefined ? parseInt(req.body.ancho_mm, 10) || 80 : existing.ancho_mm,
      req.body.activa !== undefined ? (req.body.activa ? 1 : 0) : existing.activa,
      req.body.copias !== undefined ? Math.max(1, parseInt(req.body.copias, 10) || 1) : existing.copias,
      predeterminada,
      req.body.orden !== undefined ? parseInt(req.body.orden, 10) || 0 : existing.orden,
      id
    );
    res.json(mapImpresoraRow(db.prepare('SELECT * FROM impresoras WHERE id = ?').get(id)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/impresoras/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (!db.prepare('SELECT id FROM impresoras WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Impresora no encontrada' });
    }
    db.prepare('DELETE FROM impresoras WHERE id = ?').run(id);
    res.json({ ok: true, id: id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/impresoras/:id/probar', async (req, res) => {
  try {
    const db = getDb();
    const result = await imprimirPrueba(db, { impresora_id: parseInt(req.params.id, 10) });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
