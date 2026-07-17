/**
 * =============================================================================
 * MÓDULO DE VARIAS EMPRESAS (multi-empresa)
 * =============================================================================
 * Imagina que el taller puede tener varios "negocios" dentro del mismo programa.
 * Solo UNO está "encendido" a la vez (la empresa activa). Ese negocio define:
 * - Qué nombre sale en tickets y facturas
 * - Qué clientes, repuestos y órdenes ves
 * - Si compartes datos con otros negocios o trabajas totalmente aparte
 * =============================================================================
 */
const { getConfig, setConfig } = require('../db/database');
const logoService = require('./logo-service');

// Lista de claves de configuración de Factura Electrónica (Hacienda CR)
const FE_KEYS = [
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

/** Convierte texto JSON guardado en la base de datos a un objeto JavaScript. Si falla, devuelve {} vacío. */
function leerConfigJson(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Devuelve el número (id) de la empresa que está activa ahora mismo.
 * 1) Mira en configuracion.empresa_activa_id
 * 2) Si no hay o no existe, toma la primera empresa activa de la tabla
 */
function getEmpresaActivaId(db) {
  const id = parseInt(getConfig(db, 'empresa_activa_id', ''), 10);
  if (id) {
    const row = db.prepare('SELECT id FROM taller_empresas WHERE id = ? AND activa = 1').get(id);
    if (row) return id;
  }
  const first = db
    .prepare('SELECT id FROM taller_empresas WHERE activa = 1 ORDER BY id ASC LIMIT 1')
    .get();
  return first ? first.id : null;
}

/** Copia la configuración FE actual del sistema global a un objeto (para la primera empresa). */
function snapshotFeDesdeGlobal(db) {
  const snap = {};
  FE_KEYS.forEach(function (k) {
    snap[k] = getConfig(db, k, '');
  });
  return snap;
}

/**
 * Cuando el usuario elige "usar esta empresa", copiamos SUS datos al sistema global
 * para que tickets, FE y pantallas muestren el nombre y datos correctos.
 * IMPORTANTE: si la empresa nueva no tiene FE configurada, limpiamos los campos
 * (no arrastramos los de la empresa anterior).
 */
function aplicarEmpresaAGlobal(db, empresaId) {
  const emp = db.prepare('SELECT * FROM taller_empresas WHERE id = ? AND activa = 1').get(empresaId);
  if (!emp) throw new Error('Empresa no encontrada');

  // Guardamos cuál empresa quedó activa
  setConfig(db, 'empresa_activa_id', String(empresaId));
  setConfig(db, 'nombre_negocio', emp.nombre);
  setConfig(db, 'impuesto_iva', emp.impuesto_iva || '0.13');

  const extra = leerConfigJson(emp.config_json);
  // Cada clave FE: si la empresa tiene valor lo usamos; si no, dejamos cadena vacía
  FE_KEYS.forEach(function (k) {
    const v = extra[k];
    setConfig(db, k, v != null && v !== '' ? String(v) : '');
  });
  setConfig(db, 'fe_emisor_cedula', emp.identificacion || extra.fe_emisor_cedula || '');
  setConfig(db, 'fe_emisor_nombre', extra.fe_emisor_nombre || emp.nombre || '');
  setConfig(db, 'fe_emisor_email', extra.fe_emisor_email || emp.email || '');

  return mapEmpresa(emp, empresaId);
}

/** Convierte una fila de la tabla taller_empresas al formato que usa la pantalla (con banderas compartir/aislado). */
function mapEmpresa(row, activaId) {
  if (!row) return null;
  const compartirClientes = row.compartir_clientes == null ? true : row.compartir_clientes !== 0;
  const compartirInventario = row.compartir_inventario == null ? true : row.compartir_inventario !== 0;
  return {
    id: row.id,
    nombre: row.nombre,
    identificacion: row.identificacion || '',
    telefono: row.telefono || '',
    email: row.email || '',
    direccion: row.direccion || '',
    impuesto_iva: row.impuesto_iva || '0.13',
    compartir_clientes: compartirClientes,
    compartir_inventario: compartirInventario,
    datos_aislados: !compartirClientes && !compartirInventario,
    activa: row.activa === 1,
    es_activa: activaId != null && row.id === activaId,
    tiene_logo: logoService.existeLogo(row.id),
    logo_url: logoService.urlLogo(row.id),
    config: leerConfigJson(row.config_json)
  };
}

/**
 * Lee las reglas de la empresa activa: ¿comparte clientes? ¿comparte inventario?
 * Si ambos son "no compartir", finanzas también quedan aparte (compartir_finanzas = false).
 */
function obtenerPoliticaActiva(db) {
  const empresaId = getEmpresaActivaId(db);
  if (!empresaId) {
    return {
      empresa_id: null,
      compartir_clientes: true,
      compartir_inventario: true,
      compartir_finanzas: true
    };
  }
  const row = db
    .prepare('SELECT compartir_clientes, compartir_inventario FROM taller_empresas WHERE id = ?')
    .get(empresaId);
  const compartirClientes = row ? row.compartir_clientes !== 0 : true;
  const compartirInventario = row ? row.compartir_inventario !== 0 : true;
  return {
    empresa_id: empresaId,
    compartir_clientes: compartirClientes,
    compartir_inventario: compartirInventario,
    compartir_finanzas: compartirClientes && compartirInventario
  };
}

/**
 * Arma un pedazo de SQL para filtrar registros por empresa.
 * - Si COMPARTE: solo ve registros con empresa_id NULL (datos comunes del taller)
 * - Si APARTE: solo ve registros con empresa_id = su id
 */
function filtroSqlEmpresa(compartir, column, empresaId) {
  if (compartir) {
    return { clause: ' AND (' + column + ' IS NULL)', params: [] };
  }
  if (!empresaId) {
    return { clause: ' AND 1=0', params: [] };
  }
  return { clause: ' AND (' + column + ' = ?)', params: [empresaId] };
}

/** Al crear un registro nuevo: si comparte datos, empresa_id queda NULL; si no, lleva el id de la empresa activa. */
function empresaIdParaRegistro(compartir, empresaId) {
  return compartir ? null : empresaId;
}

/** Comprueba si un registro (cliente, repuesto, etc.) le pertenece a la empresa activa según las reglas. */
function registroEnScope(row, compartir, empresaId) {
  if (!row) return false;
  if (compartir) return row.empresa_id == null;
  return row.empresa_id === empresaId;
}

/** Convierte true/false/1/0 del formulario a booleano claro. */
function parseCompartirFlag(val, defaultVal) {
  if (val === undefined || val === null) return defaultVal !== false;
  if (val === true || val === 1 || val === '1') return true;
  if (val === false || val === 0 || val === '0') return false;
  return defaultVal !== false;
}

/** Lista todas las empresas activas y marca cuál está seleccionada. */
function listarEmpresas(db) {
  const activaId = getEmpresaActivaId(db);
  const filas = db
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM taller_ordenes o WHERE o.empresa_id = e.id) AS num_ordenes
       FROM taller_empresas e
       WHERE e.activa = 1
       ORDER BY e.nombre COLLATE NOCASE`
    )
    .all();
  return {
    empresa_activa_id: activaId,
    filas: filas.map(function (r) {
      const m = mapEmpresa(r, activaId);
      m.num_ordenes = r.num_ordenes || 0;
      return m;
    })
  };
}

/** Obtiene una empresa por su id. */
function obtenerEmpresa(db, id) {
  const activaId = getEmpresaActivaId(db);
  const row = db.prepare('SELECT * FROM taller_empresas WHERE id = ?').get(id);
  if (!row) return null;
  return mapEmpresa(row, activaId);
}

/**
 * Crea una empresa nueva en la base de datos.
 * Si es "totalmente aparte", no copiamos configuración interna de otra empresa (config_json vacío).
 */
function crearEmpresa(db, datos) {
  const nombre = String(datos.nombre || '').trim();
  if (!nombre) throw new Error('El nombre de la empresa es obligatorio');

  const configJson = {};
  if (datos.config && typeof datos.config === 'object') {
    Object.assign(configJson, datos.config);
  }
  // Empresa aparte = empezar de cero, sin arrastrar configs de FE u otras cosas
  const aislarDatos =
    !parseCompartirFlag(datos.compartir_clientes, true) &&
    !parseCompartirFlag(datos.compartir_inventario, true);
  if (aislarDatos) {
    Object.keys(configJson).forEach(function (k) {
      delete configJson[k];
    });
  }

  const result = db
    .prepare(
      `INSERT INTO taller_empresas
       (nombre, identificacion, telefono, email, direccion, impuesto_iva, config_json, compartir_clientes, compartir_inventario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nombre,
      String(datos.identificacion || '').trim() || null,
      String(datos.telefono || '').trim() || null,
      String(datos.email || '').trim() || null,
      String(datos.direccion || '').trim() || null,
      String(datos.impuesto_iva || '0.13'),
      JSON.stringify(configJson),
      parseCompartirFlag(datos.compartir_clientes, true) ? 1 : 0,
      parseCompartirFlag(datos.compartir_inventario, true) ? 1 : 0
    );

  const id = result.lastInsertRowid;
  const count = db.prepare('SELECT COUNT(*) AS n FROM taller_empresas WHERE activa = 1').get().n;
  // Si es la primera empresa del sistema, o el usuario pidió activarla, la encendemos
  if (count === 1 || datos.activar === true) {
    activarEmpresa(db, id);
  }
  return obtenerEmpresa(db, id);
}

/** Actualiza los datos de una empresa existente. Si es la activa, refresca también el sistema global. */
function actualizarEmpresa(db, id, datos) {
  const row = db.prepare('SELECT * FROM taller_empresas WHERE id = ?').get(id);
  if (!row) throw new Error('Empresa no encontrada');

  const nombre = datos.nombre != null ? String(datos.nombre).trim() : row.nombre;
  if (!nombre) throw new Error('El nombre de la empresa es obligatorio');

  let configJson = leerConfigJson(row.config_json);
  if (datos.config && typeof datos.config === 'object') {
    configJson = Object.assign(configJson, datos.config);
  }

  db.prepare(
    `UPDATE taller_empresas SET
       nombre = ?, identificacion = ?, telefono = ?, email = ?, direccion = ?,
       impuesto_iva = ?, config_json = ?,
       compartir_clientes = ?, compartir_inventario = ?
     WHERE id = ?`
  ).run(
    nombre,
    datos.identificacion != null ? String(datos.identificacion).trim() || null : row.identificacion,
    datos.telefono != null ? String(datos.telefono).trim() || null : row.telefono,
    datos.email != null ? String(datos.email).trim() || null : row.email,
    datos.direccion != null ? String(datos.direccion).trim() || null : row.direccion,
    datos.impuesto_iva != null ? String(datos.impuesto_iva) : row.impuesto_iva,
    JSON.stringify(configJson),
    datos.compartir_clientes != null
      ? (parseCompartirFlag(datos.compartir_clientes, true) ? 1 : 0)
      : (row.compartir_clientes == null ? 1 : row.compartir_clientes),
    datos.compartir_inventario != null
      ? (parseCompartirFlag(datos.compartir_inventario, true) ? 1 : 0)
      : (row.compartir_inventario == null ? 1 : row.compartir_inventario),
    id
  );

  const activaId = getEmpresaActivaId(db);
  if (activaId === id) {
    aplicarEmpresaAGlobal(db, id);
  }
  return obtenerEmpresa(db, id);
}

/** El usuario eligió trabajar con esta empresa: aplicamos sus datos al sistema global. */
function activarEmpresa(db, id) {
  const row = db.prepare('SELECT id FROM taller_empresas WHERE id = ? AND activa = 1').get(id);
  if (!row) throw new Error('Empresa no encontrada');
  return aplicarEmpresaAGlobal(db, id);
}

/** Desactiva una empresa (no la borra físicamente). No se puede si es la única o tiene órdenes. */
function eliminarEmpresa(db, id) {
  const activaId = getEmpresaActivaId(db);
  const total = db.prepare('SELECT COUNT(*) AS n FROM taller_empresas WHERE activa = 1').get().n;
  if (total <= 1) throw new Error('Debe existir al menos una empresa');

  const ordenes = db
    .prepare('SELECT COUNT(*) AS n FROM taller_ordenes WHERE empresa_id = ?')
    .get(id).n;
  if (ordenes > 0) {
    throw new Error('No se puede eliminar: tiene ' + ordenes + ' orden(es). Desactívela o cambie las órdenes.');
  }

  if (activaId === id) {
    const otra = db
      .prepare('SELECT id FROM taller_empresas WHERE activa = 1 AND id != ? ORDER BY id LIMIT 1')
      .get(id);
    if (otra) activarEmpresa(db, otra.id);
  }

  db.prepare('UPDATE taller_empresas SET activa = 0 WHERE id = ?').run(id);
  logoService.eliminarLogo(id);
  return { ok: true };
}

/** Guarda en la fila de la empresa activa lo que el usuario cambió en Configuración general / FE. */
function persistirDesdeConfigGlobal(db, patch) {
  const id = getEmpresaActivaId(db);
  if (!id) return null;

  const row = db.prepare('SELECT * FROM taller_empresas WHERE id = ?').get(id);
  if (!row) return null;

  const configJson = leerConfigJson(row.config_json);
  FE_KEYS.forEach(function (k) {
    const v = getConfig(db, k, '');
    if (v != null && v !== '') configJson[k] = v;
  });
  if (patch && patch.config) Object.assign(configJson, patch.config);

  const nombre = patch && patch.nombre_negocio != null
    ? String(patch.nombre_negocio).trim()
    : getConfig(db, 'nombre_negocio', row.nombre);
  const iva = patch && patch.impuesto_iva != null
    ? String(patch.impuesto_iva)
    : getConfig(db, 'impuesto_iva', row.impuesto_iva);

  db.prepare(
    `UPDATE taller_empresas SET nombre = ?, impuesto_iva = ?, config_json = ?,
      identificacion = COALESCE(identificacion, ?),
      email = COALESCE(email, ?)
     WHERE id = ?`
  ).run(
    nombre || row.nombre,
    iva,
    JSON.stringify(configJson),
    getConfig(db, 'fe_emisor_cedula', '') || null,
    getConfig(db, 'fe_emisor_email', '') || null,
    id
  );

  return obtenerEmpresa(db, id);
}

/**
 * Al instalar el programa por primera vez: si no hay empresas, creamos una
 * con el nombre que ya tenía el taller en configuracion.
 */
function sincronizarEmpresaInicial(db) {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='taller_empresas'")
    .get();
  if (!exists) return;

  const count = db.prepare('SELECT COUNT(*) AS n FROM taller_empresas').get().n;
  if (count > 0) return;

  const nombre = getConfig(db, 'nombre_negocio', 'Sanmy Taller Mecánico');
  const configJson = snapshotFeDesdeGlobal(db);

  const result = db
    .prepare(
      `INSERT INTO taller_empresas (nombre, identificacion, email, impuesto_iva, config_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      nombre,
      getConfig(db, 'fe_emisor_cedula', '') || null,
      getConfig(db, 'fe_emisor_email', '') || null,
      getConfig(db, 'impuesto_iva', '0.13'),
      JSON.stringify(configJson)
    );

  const id = result.lastInsertRowid;
  setConfig(db, 'empresa_activa_id', String(id));
  db.prepare('UPDATE taller_ordenes SET empresa_id = ? WHERE empresa_id IS NULL').run(id);
}

module.exports = {
  FE_KEYS,
  getEmpresaActivaId,
  obtenerPoliticaActiva,
  filtroSqlEmpresa,
  empresaIdParaRegistro,
  registroEnScope,
  parseCompartirFlag,
  listarEmpresas,
  obtenerEmpresa,
  crearEmpresa,
  actualizarEmpresa,
  activarEmpresa,
  eliminarEmpresa,
  aplicarEmpresaAGlobal,
  persistirDesdeConfigGlobal,
  sincronizarEmpresaInicial
};
