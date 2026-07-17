const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'sanmy-taller.db');

let db = null;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

function closeDb() {
  if (db) {
    try {
      db.close();
    } catch (e) {
      /* ignore */
    }
    db = null;
  }
}

function reopenDb() {
  closeDb();
  return initDatabase();
}

function migrateConfiguracion(database) {
  const exists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='configuracion'"
    )
    .get();
  if (!exists) {
    database.exec(`
      CREATE TABLE configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT,
        descripcion TEXT,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const insert = database.prepare(
      'INSERT INTO configuracion (clave, valor, descripcion) VALUES (?, ?, ?)'
    );
    insert.run('impuesto_iva', '0.13', 'Tasa IVA');
    insert.run('nombre_negocio', 'Sanmy Taller Mecánico', 'Nombre en tickets');
    insert.run('impresion_pie_ticket', 'Gracias por su preferencia', 'Pie de ticket');
  }
}

function migrateImpresoras(database) {
  const exists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='impresoras'"
    )
    .get();
  if (!exists) {
    database.exec(`
      CREATE TABLE impresoras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'recibo',
        conexion TEXT NOT NULL DEFAULT 'sistema',
        nombre_sistema TEXT,
        ip TEXT,
        puerto INTEGER DEFAULT 9100,
        ancho_mm INTEGER DEFAULT 80,
        activa INTEGER DEFAULT 1,
        copias INTEGER DEFAULT 1,
        predeterminada INTEGER DEFAULT 0,
        orden INTEGER DEFAULT 0
      );
    `);
    database
      .prepare(
        `INSERT INTO impresoras (nombre, rol, conexion, nombre_sistema, ancho_mm, activa, copias, predeterminada, orden)
         VALUES (?, ?, ?, ?, ?, 1, 1, 1, 0)`
      )
      .run('Impresora del sistema', 'recibo', 'sistema', '', 80);
  }
}

function migrateUsuarios(database) {
  const exists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'"
    )
    .get();
  if (!exists) {
    database.exec(`
      CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) DEFAULT '',
        activo INTEGER DEFAULT 1
      );
    `);
    database
      .prepare('INSERT INTO usuarios (nombre, apellido) VALUES (?, ?)')
      .run('Técnico', 'Taller');
  }
}

function migrateTaller(database) {
  const exists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='taller_ordenes'"
    )
    .get();
  if (!exists) {
    database.exec(`
      CREATE TABLE taller_clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        identificacion TEXT,
        telefono TEXT,
        email TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE taller_vehiculos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        placa TEXT NOT NULL UNIQUE,
        marca TEXT,
        modelo TEXT,
        anio INTEGER,
        color TEXT,
        kilometraje INTEGER,
        observaciones TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES taller_clientes(id)
      );
      CREATE TABLE taller_ordenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero INTEGER NOT NULL,
        vehiculo_id INTEGER NOT NULL,
        cliente_id INTEGER,
        usuario_id INTEGER,
        estado TEXT DEFAULT 'ingreso',
        diagnostico TEXT,
        observaciones TEXT,
        subtotal DECIMAL(10,2) DEFAULT 0,
        iva DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        tipo_cobro TEXT DEFAULT 'contado',
        saldo_pendiente DECIMAL(10,2) DEFAULT 0,
        metodo_pago TEXT,
        monto_cobrado DECIMAL(10,2) DEFAULT 0,
        fecha_ingreso DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_entrega DATETIME,
        FOREIGN KEY (vehiculo_id) REFERENCES taller_vehiculos(id),
        FOREIGN KEY (cliente_id) REFERENCES taller_clientes(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      );
      CREATE TABLE taller_orden_lineas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_id INTEGER NOT NULL,
        tipo TEXT DEFAULT 'repuesto',
        descripcion TEXT NOT NULL,
        cantidad DECIMAL(10,2) DEFAULT 1,
        precio_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (orden_id) REFERENCES taller_ordenes(id) ON DELETE CASCADE
      );
      CREATE TABLE taller_orden_fotos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_id INTEGER NOT NULL,
        ruta TEXT NOT NULL,
        titulo TEXT,
        tipo TEXT DEFAULT 'general',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (orden_id) REFERENCES taller_ordenes(id) ON DELETE CASCADE
      );
      CREATE TABLE taller_orden_abonos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_id INTEGER NOT NULL,
        monto DECIMAL(10,2) NOT NULL,
        metodo_pago TEXT,
        tipo TEXT DEFAULT 'abono',
        nota TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (orden_id) REFERENCES taller_ordenes(id) ON DELETE CASCADE
      );
    `);
  }
}

function migrateOrdenCobro(database) {
  const cols = database.prepare('PRAGMA table_info(taller_ordenes)').all();
  const names = cols.map(function (c) {
    return c.name;
  });
  if (names.indexOf('tipo_cobro') < 0) {
    database.exec(
      "ALTER TABLE taller_ordenes ADD COLUMN tipo_cobro TEXT DEFAULT 'contado'"
    );
  }
  if (names.indexOf('saldo_pendiente') < 0) {
    database.exec(
      'ALTER TABLE taller_ordenes ADD COLUMN saldo_pendiente DECIMAL(10,2) DEFAULT 0'
    );
  }
  const abonos = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='taller_orden_abonos'"
    )
    .get();
  if (!abonos) {
    database.exec(`
      CREATE TABLE taller_orden_abonos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_id INTEGER NOT NULL,
        monto DECIMAL(10,2) NOT NULL,
        metodo_pago TEXT,
        tipo TEXT DEFAULT 'abono',
        nota TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (orden_id) REFERENCES taller_ordenes(id) ON DELETE CASCADE
      );
    `);
  }
}

function migrateInventario(database) {
  const exists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='taller_inventario'"
    )
    .get();
  if (!exists) {
    database.exec(`
      CREATE TABLE taller_inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT,
        nombre TEXT NOT NULL,
        categoria TEXT,
        proveedor TEXT,
        cantidad DECIMAL(10,2) DEFAULT 0,
        stock_minimo DECIMAL(10,2) DEFAULT 0,
        costo DECIMAL(10,2) DEFAULT 0,
        precio DECIMAL(10,2) DEFAULT 0,
        activo INTEGER DEFAULT 1,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

function migrateCuentasPagar(database) {
  const exists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='taller_cuentas_pagar'"
    )
    .get();
  if (!exists) {
    database.exec(`
      CREATE TABLE taller_cuentas_pagar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proveedor TEXT NOT NULL,
        descripcion TEXT,
        monto DECIMAL(10,2) DEFAULT 0,
        fecha DATE,
        fecha_vencimiento DATE,
        estado TEXT DEFAULT 'pendiente',
        fecha_pago DATETIME,
        nota TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

function migrateLineaInventario(database) {
  const cols = database.prepare('PRAGMA table_info(taller_orden_lineas)').all();
  const names = cols.map(function (c) { return c.name; });
  if (names.indexOf('inventario_id') < 0) {
    database.exec('ALTER TABLE taller_orden_lineas ADD COLUMN inventario_id INTEGER');
  }
}

function migrateInventarioFE(database) {
  const cols = database.prepare('PRAGMA table_info(taller_inventario)').all();
  const names = cols.map(function (c) { return c.name; });
  if (names.indexOf('cabys') < 0) {
    database.exec("ALTER TABLE taller_inventario ADD COLUMN cabys TEXT");
  }
  if (names.indexOf('unidad_medida') < 0) {
    database.exec("ALTER TABLE taller_inventario ADD COLUMN unidad_medida TEXT DEFAULT 'Unid'");
  }
  if (names.indexOf('iva') < 0) {
    database.exec("ALTER TABLE taller_inventario ADD COLUMN iva DECIMAL(5,2) DEFAULT 13");
  }
}

function migrateTicketConfig(database) {
  const defaults = {
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
  const insert = database.prepare(
    'INSERT INTO configuracion (clave, valor) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = ?)'
  );
  Object.keys(defaults).forEach(function (clave) {
    insert.run(clave, defaults[clave], clave);
  });
}

function migrateEmpresas(database) {
  const exists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='taller_empresas'"
    )
    .get();
  if (!exists) {
    database.exec(`
      CREATE TABLE taller_empresas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        identificacion TEXT,
        telefono TEXT,
        email TEXT,
        direccion TEXT,
        impuesto_iva TEXT DEFAULT '0.13',
        config_json TEXT DEFAULT '{}',
        activa INTEGER DEFAULT 1,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  const cols = database.prepare('PRAGMA table_info(taller_ordenes)').all();
  const names = cols.map(function (c) {
    return c.name;
  });
  if (names.indexOf('empresa_id') < 0) {
    database.exec(
      'ALTER TABLE taller_ordenes ADD COLUMN empresa_id INTEGER REFERENCES taller_empresas(id)'
    );
  }
  try {
    const empresaService = require('../api/empresa-service');
    empresaService.sincronizarEmpresaInicial(database);
    const activa = getConfig(database, 'empresa_activa_id', '');
    if (activa) {
      database
        .prepare('UPDATE taller_ordenes SET empresa_id = ? WHERE empresa_id IS NULL')
        .run(parseInt(activa, 10));
    }
  } catch (e) {
    /* init order */
  }
}

function addColumnIfMissing(database, table, column, definition) {
  const names = database.prepare('PRAGMA table_info(' + table + ')').all().map(function (c) {
    return c.name;
  });
  if (names.indexOf(column) < 0) {
    database.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
  }
}

function migrateVehiculosEmpresaPlaca(database) {
  const migExists = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='taller_vehiculos_mig'")
    .get();
  if (migExists) {
    database.exec('PRAGMA foreign_keys = OFF');
    database.exec('DROP TABLE IF EXISTS taller_vehiculos');
    database.exec('ALTER TABLE taller_vehiculos_mig RENAME TO taller_vehiculos');
    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_veh_empresa_placa
      ON taller_vehiculos (COALESCE(empresa_id, 0), placa)
    `);
    database.exec('PRAGMA foreign_keys = ON');
    return;
  }

  const cols = database.prepare('PRAGMA table_info(taller_vehiculos)').all();
  const hasEmpresaCol = cols.some(function (c) {
    return c.name === 'empresa_id';
  });
  const indexes = database.prepare('PRAGMA index_list(taller_vehiculos)').all();
  let placaUniqueGlobal = false;
  indexes.forEach(function (idx) {
    if (!idx.unique) return;
    const info = database.prepare('PRAGMA index_info(' + idx.name + ')').all();
    if (info.length === 1 && info[0].name === 'placa') placaUniqueGlobal = true;
  });
  if (hasEmpresaCol && !placaUniqueGlobal) {
    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_veh_empresa_placa
      ON taller_vehiculos (COALESCE(empresa_id, 0), placa)
    `);
    return;
  }
  if (!placaUniqueGlobal && !hasEmpresaCol) return;

  database.exec('PRAGMA foreign_keys = OFF');
  database.exec(`
    CREATE TABLE taller_vehiculos_mig (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER,
      cliente_id INTEGER,
      placa TEXT NOT NULL,
      marca TEXT,
      modelo TEXT,
      anio INTEGER,
      color TEXT,
      kilometraje INTEGER,
      observaciones TEXT,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES taller_clientes(id)
    );
  `);
  if (hasEmpresaCol) {
    database.exec(`
      INSERT INTO taller_vehiculos_mig
        (id, empresa_id, cliente_id, placa, marca, modelo, anio, color, kilometraje, observaciones, fecha_registro)
      SELECT id, empresa_id, cliente_id, placa, marca, modelo, anio, color, kilometraje, observaciones, fecha_registro
      FROM taller_vehiculos
    `);
  } else {
    database.exec(`
      INSERT INTO taller_vehiculos_mig
        (id, empresa_id, cliente_id, placa, marca, modelo, anio, color, kilometraje, observaciones, fecha_registro)
      SELECT id, NULL, cliente_id, placa, marca, modelo, anio, color, kilometraje, observaciones, fecha_registro
      FROM taller_vehiculos
    `);
  }
  database.exec('DROP TABLE taller_vehiculos');
  database.exec('ALTER TABLE taller_vehiculos_mig RENAME TO taller_vehiculos');
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_veh_empresa_placa
    ON taller_vehiculos (COALESCE(empresa_id, 0), placa)
  `);
  database.exec('PRAGMA foreign_keys = ON');
}

function migrateEmpresaDatosAislamiento(database) {
  addColumnIfMissing(database, 'taller_empresas', 'compartir_clientes', 'INTEGER DEFAULT 1');
  addColumnIfMissing(database, 'taller_empresas', 'compartir_inventario', 'INTEGER DEFAULT 1');
  addColumnIfMissing(database, 'taller_clientes', 'empresa_id', 'INTEGER');
  addColumnIfMissing(database, 'taller_clientes', 'apellidos', 'TEXT');
  addColumnIfMissing(database, 'taller_inventario', 'empresa_id', 'INTEGER');
  addColumnIfMissing(database, 'taller_cuentas_pagar', 'empresa_id', 'INTEGER');
  migrateVehiculosEmpresaPlaca(database);
}

function initDatabase() {
  const database = getDb();
  migrateConfiguracion(database);
  migrateImpresoras(database);
  migrateUsuarios(database);
  migrateTaller(database);
  migrateOrdenCobro(database);
  migrateFacturaElectronica(database);
  migrateInventario(database);
  migrateCuentasPagar(database);
  migrateLineaInventario(database);
  migrateInventarioFE(database);
  migrateTicketConfig(database);
  migrateEmpresas(database);
  migrateEmpresaDatosAislamiento(database);
  const usuarioService = require('../api/usuario-service');
  usuarioService.seedDefaults(database);
  if (getConfig(database, 'usuarios_entrada_sin_clave') !== '1') {
    database.prepare('UPDATE usuarios SET password_hash = NULL').run();
    setConfig(database, 'usuarios_entrada_sin_clave', '1');
  }
  return database;
}

function migrateFacturaElectronica(database) {
  const exists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='facturas_electronicas'"
    )
    .get();
  if (!exists) {
    database.exec(`
      CREATE TABLE facturas_electronicas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_id INTEGER,
        abono_id INTEGER,
        clave TEXT,
        consecutivo TEXT,
        estado TEXT DEFAULT 'pendiente',
        receptor_identificacion TEXT,
        receptor_nombre TEXT,
        receptor_email TEXT,
        total DECIMAL(10,2),
        json_envio TEXT,
        json_respuesta TEXT,
        pdf_url TEXT,
        fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (orden_id) REFERENCES taller_ordenes(id),
        FOREIGN KEY (abono_id) REFERENCES taller_orden_abonos(id)
      )
    `);
  }

  const defaults = {
    fe_modo: 'simulacion',
    fe_proveedor: 'pendiente',
    fe_sandbox: '0',
    fe_sucursal: '001',
    fe_terminal: '001',
    fe_actividad_economica: '452000',
    fe_consecutivo: '0'
  };
  Object.keys(defaults).forEach(function (clave) {
    const row = database.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
    if (!row) {
      database
        .prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?)')
        .run(clave, defaults[clave]);
    }
  });
}

function calcTotalesDesdeSubtotal(subtotal) {
  const database = getDb();
  const ivaConfig = database
    .prepare('SELECT valor FROM configuracion WHERE clave = ?')
    .get('impuesto_iva');
  const ivaRate = parseFloat(ivaConfig?.valor || '0.13');
  const iva = Math.round(subtotal * ivaRate * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;
  return { subtotal, iva, total };
}

function getConfig(database, clave, def) {
  const row = database.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
  return row ? row.valor : def;
}

function setConfig(database, clave, valor) {
  database
    .prepare(
      `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, fecha_actualizacion = CURRENT_TIMESTAMP`
    )
    .run(clave, valor);
}

module.exports = {
  getDb,
  closeDb,
  reopenDb,
  initDatabase,
  DB_PATH,
  calcTotalesDesdeSubtotal,
  getConfig,
  setConfig
};
