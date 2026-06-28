const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { calcTotalesDesdeSubtotal } = require('../db/database');
// Servicio de empresas: nos dice cuál empresa está activa y si comparte o aísla datos
const empresaService = require('./empresa-service');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FOTOS_DIR = path.join(DATA_DIR, 'taller-fotos');

const ESTADOS_ORDEN = [
  'ingreso',
  'diagnostico',
  'en_proceso',
  'listo',
  'entregado',
  'cancelado'
];

// =============================================================================
// AYUDAS PARA MULTI-EMPRESA
// Cada función pequeña hace una sola cosa fácil de entender:
// - politicaActiva: lee las reglas de la empresa encendida ahora
// - appendFiltroEmpresa: agrega al SQL "solo muestra lo de esta empresa"
// - empresaIdRegistro: al guardar, pone el id de empresa o NULL si comparte
// - asegurarEnScope: lanza error si intentas tocar datos de otra empresa
// =============================================================================

/** Pregunta al módulo empresa qué reglas aplicar (compartir clientes, inventario, etc.). */
function politicaActiva(db) {
  return empresaService.obtenerPoliticaActiva(db);
}

/** Une el filtro SQL de empresa a una consulta que ya teníamos armada. */
function appendFiltroEmpresa(sql, params, compartir, column, empresaId) {
  const f = empresaService.filtroSqlEmpresa(compartir, column, empresaId);
  return { sql: sql + f.clause, params: params.concat(f.params) };
}

/** Devuelve qué valor guardar en la columna empresa_id al crear un registro nuevo. */
function empresaIdRegistro(compartir, empresaId) {
  return empresaService.empresaIdParaRegistro(compartir, empresaId);
}

/** Si el registro no es de la empresa activa, cortamos con un mensaje de error claro. */
function asegurarEnScope(row, compartir, empresaId, mensaje) {
  if (!empresaService.registroEnScope(row, compartir, empresaId)) {
    throw new Error(mensaje || 'No pertenece a la empresa activa');
  }
}

function ensureFotosDir() {
  if (!fs.existsSync(FOTOS_DIR)) {
    fs.mkdirSync(FOTOS_DIR, { recursive: true });
  }
}

function urlFoto(ordenId, nombreArchivo) {
  return '/api/taller/fotos/' + ordenId + '/' + encodeURIComponent(nombreArchivo);
}

function guardarImagenBase64(ordenId, imagenBase64, titulo) {
  ensureFotosDir();
  const match = String(imagenBase64 || '').match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    throw new Error('Formato de imagen no válido');
  }
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('La imagen supera el tamaño máximo (8 MB)');
  }
  const dirOrden = path.join(FOTOS_DIR, String(ordenId));
  if (!fs.existsSync(dirOrden)) {
    fs.mkdirSync(dirOrden, { recursive: true });
  }
  const nombre = crypto.randomBytes(8).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(dirOrden, nombre), buffer);
  return { nombre, titulo: titulo || '' };
}

function mapOrdenRow(row) {
  if (!row) return null;
  return {
    ...row,
    foto_url: row.foto_archivo ? urlFoto(row.id, row.foto_archivo) : null,
    vehiculo_foto_url: row.vehiculo_foto
      ? row.vehiculo_foto.startsWith('data:')
        ? row.vehiculo_foto
        : urlFoto(row.id, row.vehiculo_foto)
      : null
  };
}

function recalcOrden(db, ordenId) {
  const lineas = db
    .prepare('SELECT COALESCE(SUM(subtotal), 0) AS subtotal FROM taller_orden_lineas WHERE orden_id = ?')
    .get(ordenId);
  const subtotal = lineas.subtotal || 0;
  const { iva, total } = calcTotalesDesdeSubtotal(subtotal);
  db.prepare('UPDATE taller_ordenes SET subtotal = ?, iva = ?, total = ? WHERE id = ?').run(
    subtotal,
    iva,
    total,
    ordenId
  );
  return { subtotal, iva, total };
}

function siguienteNumeroOrden(db, empresaId) {
  if (empresaId) {
    const row = db
      .prepare('SELECT COALESCE(MAX(numero), 0) AS n FROM taller_ordenes WHERE empresa_id = ?')
      .get(empresaId);
    return (row.n || 0) + 1;
  }
  const row = db.prepare('SELECT COALESCE(MAX(numero), 0) AS n FROM taller_ordenes').get();
  return (row.n || 0) + 1;
}

function buscarOCrearCliente(db, datos) {
  // Paso 1: leer reglas de la empresa activa (¿comparte clientes con otras?)
  const pol = politicaActiva(db);
  const nombre = String(datos.cliente_nombre || datos.nombre || '').trim();
  if (!nombre) return null;
  const identificacion = String(datos.cliente_identificacion || datos.identificacion || '').trim();
  // Paso 2: decidir si el cliente nuevo lleva id de empresa o queda "común" (NULL)
  const empIdReg = empresaIdRegistro(pol.compartir_clientes, pol.empresa_id);
  if (identificacion) {
    // Paso 3: buscar solo dentro del "mundo" de esta empresa (compartido o aparte)
    let sql = 'SELECT id FROM taller_clientes WHERE identificacion = ?';
    let params = [identificacion];
    const filtrado = appendFiltroEmpresa(sql, params, pol.compartir_clientes, 'empresa_id', pol.empresa_id);
    const existente = db.prepare(filtrado.sql).get(...filtrado.params);
    if (existente) {
      db.prepare(
        'UPDATE taller_clientes SET nombre = ?, telefono = COALESCE(?, telefono), email = COALESCE(?, email) WHERE id = ?'
      ).run(
        nombre,
        datos.cliente_telefono || datos.telefono || null,
        datos.cliente_email || datos.email || null,
        existente.id
      );
      return existente.id;
    }
  }
  const result = db
    .prepare(
      `INSERT INTO taller_clientes (nombre, identificacion, telefono, email, empresa_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      nombre,
      identificacion || null,
      datos.cliente_telefono || datos.telefono || null,
      datos.cliente_email || datos.email || null,
      empIdReg
    );
  return result.lastInsertRowid;
}

function buscarOCrearVehiculo(db, datos, clienteId) {
  // Igual que clientes: placa única por empresa (empresa aparte no ve placas de otra)
  const pol = politicaActiva(db);
  const placa = String(datos.placa || '').trim().toUpperCase();
  if (!placa) {
    throw new Error('La placa del vehículo es obligatoria');
  }
  const empIdReg = empresaIdRegistro(pol.compartir_clientes, pol.empresa_id);
  let sql = 'SELECT id FROM taller_vehiculos WHERE placa = ?';
  let params = [placa];
  const filtrado = appendFiltroEmpresa(sql, params, pol.compartir_clientes, 'empresa_id', pol.empresa_id);
  const existente = db.prepare(filtrado.sql).get(...filtrado.params);
  if (existente) {
    db.prepare(
      `UPDATE taller_vehiculos SET
         cliente_id = COALESCE(?, cliente_id),
         marca = COALESCE(?, marca),
         modelo = COALESCE(?, modelo),
         anio = COALESCE(?, anio),
         color = COALESCE(?, color),
         kilometraje = COALESCE(?, kilometraje),
         observaciones = COALESCE(?, observaciones)
       WHERE id = ?`
    ).run(
      clienteId,
      datos.marca || null,
      datos.modelo || null,
      datos.anio ? Number(datos.anio) : null,
      datos.color || null,
      datos.kilometraje ? Number(datos.kilometraje) : null,
      datos.observaciones_vehiculo || null,
      existente.id
    );
    return existente.id;
  }
  const result = db
    .prepare(
      `INSERT INTO taller_vehiculos
       (cliente_id, placa, marca, modelo, anio, color, kilometraje, observaciones, empresa_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      clienteId,
      placa,
      datos.marca || null,
      datos.modelo || null,
      datos.anio ? Number(datos.anio) : null,
      datos.color || null,
      datos.kilometraje ? Number(datos.kilometraje) : null,
      datos.observaciones_vehiculo || null,
      empIdReg
    );
  return result.lastInsertRowid;
}

function listarOrdenes(db, query) {
  const todos = query.todos === '1' || query.todos === 'true';
  const estado = query.estado ? String(query.estado) : '';
  const q = String(query.q || '').trim();
  const placa = String(query.placa || '').trim().toUpperCase();
  let sql = `
    SELECT o.*,
           v.placa, v.marca, v.modelo, v.anio, v.color, v.kilometraje,
           c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
           (SELECT f.ruta FROM taller_orden_fotos f WHERE f.orden_id = o.id ORDER BY f.id ASC LIMIT 1) AS foto_archivo
    FROM taller_ordenes o
    JOIN taller_vehiculos v ON v.id = o.vehiculo_id
    LEFT JOIN taller_clientes c ON c.id = o.cliente_id
    WHERE 1=1`;
  const params = [];
  if (!todos) {
    if (estado) {
      sql += ' AND o.estado = ?';
      params.push(estado);
    } else {
      sql += " AND o.estado NOT IN ('entregado', 'cancelado')";
    }
    if (!(query.proforma === '1' || query.proforma === 'true')) {
      sql += " AND LOWER(IFNULL(o.observaciones, '')) NOT LIKE '%proforma%'";
    }
  } else if (estado) {
    sql += ' AND o.estado = ?';
    params.push(estado);
  }
  if (q) {
    sql += ' AND (v.placa LIKE ? OR c.nombre LIKE ? OR CAST(o.numero AS TEXT) LIKE ?)';
    const like = '%' + q + '%';
    params.push(like, like, like);
  }
  if (placa) {
    sql += ' AND v.placa = ?';
    params.push(placa);
  }
  if (query.saldo === '1' || query.pendientes === '1') {
    sql += ' AND o.saldo_pendiente > 0 AND o.estado != \'cancelado\'';
  }
  if (query.proforma === '1' || query.proforma === 'true') {
    sql += " AND LOWER(IFNULL(o.observaciones, '')) LIKE '%proforma%'";
  }
  const empresaId = empresaService.getEmpresaActivaId(db);
  // Solo listamos órdenes de la empresa que está "encendida" ahora
  if (empresaId) {
    sql += ' AND o.empresa_id = ?';
    params.push(empresaId);
  }
  sql += ' ORDER BY o.fecha_ingreso DESC, o.id DESC LIMIT 100';
  const filas = db.prepare(sql).all(...params).map(mapOrdenRow);
  return { filas, cantidad: filas.length };
}

function obtenerOrden(db, id) {
  const orden = db
    .prepare(
      `SELECT o.*,
              v.placa, v.marca, v.modelo, v.anio, v.color, v.kilometraje, v.observaciones AS vehiculo_obs,
              c.nombre AS cliente_nombre, c.identificacion AS cliente_identificacion,
              c.telefono AS cliente_telefono, c.email AS cliente_email,
              TRIM(u.nombre || ' ' || IFNULL(u.apellido, '')) AS usuario_nombre
       FROM taller_ordenes o
       JOIN taller_vehiculos v ON v.id = o.vehiculo_id
       LEFT JOIN taller_clientes c ON c.id = o.cliente_id
       LEFT JOIN usuarios u ON u.id = o.usuario_id
       WHERE o.id = ?`
    )
    .get(id);
  if (!orden) return null;

  const lineas = db
    .prepare('SELECT * FROM taller_orden_lineas WHERE orden_id = ? ORDER BY id')
    .all(id);
  const fotos = db
    .prepare('SELECT * FROM taller_orden_fotos WHERE orden_id = ? ORDER BY id')
    .all(id)
    .map(function (f) {
      return {
        ...f,
        url: urlFoto(id, f.ruta)
      };
    });
  const abonos = db
    .prepare('SELECT * FROM taller_orden_abonos WHERE orden_id = ? ORDER BY id')
    .all(id);

  return {
    orden: mapOrdenRow(orden),
    lineas,
    fotos,
    abonos
  };
}

function crearOrden(db, datos) {
  const clienteId = buscarOCrearCliente(db, datos);
  const vehiculoId = buscarOCrearVehiculo(db, datos, clienteId);
  const empresaId = empresaService.getEmpresaActivaId(db);
  const numero = siguienteNumeroOrden(db, empresaId);
  const usuarioId = datos.usuario_id ? Number(datos.usuario_id) : null;

  const result = db
    .prepare(
      `INSERT INTO taller_ordenes
       (numero, vehiculo_id, cliente_id, usuario_id, empresa_id, estado, diagnostico, observaciones)
       VALUES (?, ?, ?, ?, ?, 'ingreso', ?, ?)`
    )
    .run(
      numero,
      vehiculoId,
      clienteId,
      usuarioId,
      empresaId,
      String(datos.diagnostico || '').trim() || null,
      String(datos.observaciones || '').trim() || null
    );

  const ordenId = result.lastInsertRowid;

  if (datos.imagen_base64) {
    agregarFoto(db, ordenId, {
      imagen_base64: datos.imagen_base64,
      titulo: 'Ingreso',
      tipo: 'ingreso'
    });
  }

  return obtenerOrden(db, ordenId);
}

function actualizarOrden(db, id, datos) {
  const orden = db.prepare('SELECT id FROM taller_ordenes WHERE id = ?').get(id);
  if (!orden) throw new Error('Orden no encontrada');

  const campos = [];
  const params = [];
  if (datos.estado != null) {
    if (!ESTADOS_ORDEN.includes(datos.estado)) {
      throw new Error('Estado no válido');
    }
    campos.push('estado = ?');
    params.push(datos.estado);
    if (datos.estado === 'entregado') {
      campos.push('fecha_entrega = CURRENT_TIMESTAMP');
    }
  }
  if (datos.diagnostico != null) {
    campos.push('diagnostico = ?');
    params.push(String(datos.diagnostico).trim());
  }
  if (datos.observaciones != null) {
    campos.push('observaciones = ?');
    params.push(String(datos.observaciones).trim());
  }
  if (!campos.length) {
    return obtenerOrden(db, id);
  }
  params.push(id);
  db.prepare('UPDATE taller_ordenes SET ' + campos.join(', ') + ' WHERE id = ?').run(...params);
  return obtenerOrden(db, id);
}

function agregarLinea(db, ordenId, datos) {
  const orden = db.prepare('SELECT id, estado FROM taller_ordenes WHERE id = ?').get(ordenId);
  if (!orden) throw new Error('Orden no encontrada');
  if (orden.estado === 'entregado' || orden.estado === 'cancelado') {
    throw new Error('No se pueden agregar líneas a una orden cerrada');
  }
  const descripcion = String(datos.descripcion || '').trim();
  const cantidad = Number(datos.cantidad) || 1;
  const precio = Number(datos.precio_unitario);
  if (!descripcion) throw new Error('Descripción obligatoria');
  if (precio == null || Number.isNaN(precio) || precio < 0) throw new Error('Precio no válido');
  const subtotal = Math.round(cantidad * precio * 100) / 100;
  const tipo = ['repuesto', 'mano_obra', 'otro'].includes(datos.tipo) ? datos.tipo : 'repuesto';

  // Si la línea proviene de un repuesto del inventario, validamos y descontamos stock.
  let inventarioId = Number(datos.inventario_id) || null;
  let itemInv = null;
  if (inventarioId) {
    itemInv = db.prepare('SELECT * FROM taller_inventario WHERE id = ?').get(inventarioId);
    if (itemInv) {
      const polInv = politicaActiva(db);
      try {
        asegurarEnScope(itemInv, polInv.compartir_inventario, polInv.empresa_id, 'Repuesto no disponible para esta empresa');
      } catch (e) {
        itemInv = null;
        inventarioId = null;
      }
    }
    if (!itemInv) {
      inventarioId = null;
    }
  }

  const result = db
    .prepare(
      `INSERT INTO taller_orden_lineas (orden_id, tipo, descripcion, cantidad, precio_unitario, subtotal, inventario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(ordenId, tipo, descripcion, cantidad, precio, subtotal, inventarioId);

  if (inventarioId && itemInv) {
    const stockActual = Number(itemInv.cantidad) || 0;
    const nuevoStock = Math.round((stockActual - cantidad) * 1000) / 1000;
    db.prepare('UPDATE taller_inventario SET cantidad = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?')
      .run(nuevoStock, inventarioId);
  }

  recalcOrden(db, ordenId);
  const linea = db.prepare('SELECT * FROM taller_orden_lineas WHERE id = ?').get(result.lastInsertRowid);
  return { linea, totales: recalcOrden(db, ordenId) };
}

function eliminarLinea(db, ordenId, lineaId) {
  const orden = db.prepare('SELECT id, estado FROM taller_ordenes WHERE id = ?').get(ordenId);
  if (!orden) throw new Error('Orden no encontrada');
  if (orden.estado === 'entregado' || orden.estado === 'cancelado') {
    throw new Error('No se pueden eliminar líneas de una orden cerrada');
  }
  // Si la línea descontó stock de inventario, lo devolvemos antes de borrarla.
  const linea = db.prepare('SELECT * FROM taller_orden_lineas WHERE id = ? AND orden_id = ?').get(lineaId, ordenId);
  if (linea && linea.inventario_id) {
    const itemInv = db.prepare('SELECT * FROM taller_inventario WHERE id = ?').get(linea.inventario_id);
    if (itemInv) {
      const nuevoStock = Math.round(((Number(itemInv.cantidad) || 0) + (Number(linea.cantidad) || 0)) * 1000) / 1000;
      db.prepare('UPDATE taller_inventario SET cantidad = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?')
        .run(nuevoStock, linea.inventario_id);
    }
  }
  db.prepare('DELETE FROM taller_orden_lineas WHERE id = ? AND orden_id = ?').run(lineaId, ordenId);
  return { totales: recalcOrden(db, ordenId) };
}


function reemplazarLineasOrden(db, ordenId, lineasNuevas) {
  const orden = db.prepare("SELECT id, estado FROM taller_ordenes WHERE id = ?").get(ordenId);
  if (!orden) throw new Error("Orden no encontrada");
  if (orden.estado === "entregado" || orden.estado === "cancelado") {
    throw new Error("No se pueden modificar lineas de una orden cerrada");
  }
  const existentes = db.prepare("SELECT id FROM taller_orden_lineas WHERE orden_id = ? ORDER BY id").all(ordenId);
  existentes.forEach(function (l) { eliminarLinea(db, ordenId, l.id); });
  (lineasNuevas || []).forEach(function (ln) { agregarLinea(db, ordenId, ln); });
  return obtenerOrden(db, ordenId);
}

function facturarDesdeProforma(db, ordenId, datos) {
  datos = datos || {};
  const orden = db.prepare("SELECT * FROM taller_ordenes WHERE id = ?").get(ordenId);
  if (!orden) throw new Error("Orden no encontrada");
  if (orden.estado === "cancelado") throw new Error("Orden cancelada");
  if (orden.estado === "entregado" && (Number(orden.saldo_pendiente) || 0) <= 0) {
    const ultimoAbono = db
      .prepare('SELECT id, monto FROM taller_orden_abonos WHERE orden_id = ? ORDER BY id DESC LIMIT 1')
      .get(ordenId);
    const data = obtenerOrden(db, ordenId);
    if (ultimoAbono) {
      data.abono_id = ultimoAbono.id;
      data.monto_cobrado_ahora = ultimoAbono.monto;
    }
    return data;
  }
  if (datos.lineas && datos.lineas.length) {
    reemplazarLineasOrden(db, ordenId, datos.lineas);
  }
  if (datos.cliente_identificacion && orden.cliente_id) {
    db.prepare("UPDATE taller_clientes SET identificacion = ? WHERE id = ?").run(String(datos.cliente_identificacion).trim(), orden.cliente_id);
  }
  if (datos.cliente_nombre && orden.cliente_id) {
    db.prepare("UPDATE taller_clientes SET nombre = ? WHERE id = ?").run(String(datos.cliente_nombre).trim(), orden.cliente_id);
  }
  db.prepare("UPDATE taller_ordenes SET observaciones = ?, estado = CASE WHEN estado = 'ingreso' THEN 'listo' ELSE estado END WHERE id = ?").run("Facturada", ordenId);
  return cobrarOrden(db, ordenId, {
    metodo_pago: datos.metodo_pago || "efectivo",
    tipo_cobro: datos.tipo_cobro || "contado",
    monto: datos.monto,
    nota: datos.nota || "Facturada desde proforma"
  });
}

function agregarFoto(db, ordenId, datos) {
  const orden = db.prepare('SELECT id FROM taller_ordenes WHERE id = ?').get(ordenId);
  if (!orden) throw new Error('Orden no encontrada');
  const { nombre, titulo } = guardarImagenBase64(ordenId, datos.imagen_base64, datos.titulo);
  const tipo = ['ingreso', 'dano', 'proceso', 'entrega', 'general'].includes(datos.tipo)
    ? datos.tipo
    : 'general';
  const result = db
    .prepare(
      `INSERT INTO taller_orden_fotos (orden_id, ruta, titulo, tipo)
       VALUES (?, ?, ?, ?)`
    )
    .run(ordenId, nombre, titulo || datos.titulo || '', tipo);
  const foto = db.prepare('SELECT * FROM taller_orden_fotos WHERE id = ?').get(result.lastInsertRowid);
  return {
    ...foto,
    url: urlFoto(ordenId, nombre)
  };
}

function cobrarOrden(db, ordenId, datos) {
  const orden = db.prepare('SELECT * FROM taller_ordenes WHERE id = ?').get(ordenId);
  if (!orden) throw new Error('Orden no encontrada');
  if (orden.estado === 'cancelado') throw new Error('Orden cancelada');
  if (orden.estado === 'entregado' && (orden.saldo_pendiente || 0) <= 0) {
    throw new Error('Orden ya cobrada/entregada');
  }
  if (orden.estado === 'entregado' && orden.saldo_pendiente > 0) {
    return registrarAbono(db, ordenId, datos);
  }

  const metodos = ['efectivo', 'tarjeta', 'sinpe', 'otro'];
  const metodo = metodos.includes(datos.metodo_pago) ? datos.metodo_pago : 'efectivo';
  const total = Number(orden.total) || 0;
  if (total <= 0) throw new Error('La orden no tiene total a cobrar');

  let tipoCobro = ['contado', 'credito', 'apartado'].includes(datos.tipo_cobro)
    ? datos.tipo_cobro
    : 'contado';
  let monto = Number(datos.monto != null ? datos.monto : total);
  if (monto < 0 || Number.isNaN(monto)) throw new Error('Monto de cobro no válido');

  if (tipoCobro === 'contado') {
    monto = total;
  } else if (tipoCobro === 'apartado') {
    if (monto <= 0 || monto >= total) {
      throw new Error('Apartado: indique un anticipo menor al total');
    }
  } else if (tipoCobro === 'credito') {
    if (monto >= total) {
      tipoCobro = 'contado';
      monto = total;
    }
  }

  const saldo = Math.round((total - monto) * 100) / 100;

  db.prepare(
    `UPDATE taller_ordenes SET
       estado = 'entregado',
       tipo_cobro = ?,
       metodo_pago = ?,
       monto_cobrado = ?,
       saldo_pendiente = ?,
       fecha_entrega = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(tipoCobro, metodo, monto, saldo, ordenId);

  const abonoResult = db.prepare(
    `INSERT INTO taller_orden_abonos (orden_id, monto, metodo_pago, tipo, nota)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    ordenId,
    monto,
    metodo,
    tipoCobro === 'contado' ? 'cobro' : tipoCobro,
    datos.nota || null
  );

  const data = obtenerOrden(db, ordenId);
  data.abono_id = abonoResult.lastInsertRowid;
  data.monto_cobrado_ahora = monto;
  return data;
}

function registrarAbono(db, ordenId, datos) {
  const orden = db.prepare('SELECT * FROM taller_ordenes WHERE id = ?').get(ordenId);
  if (!orden) throw new Error('Orden no encontrada');
  if (orden.estado === 'cancelado') throw new Error('Orden cancelada');
  const saldoActual = Number(orden.saldo_pendiente) || 0;
  if (saldoActual <= 0) throw new Error('Esta orden no tiene saldo pendiente');

  const metodos = ['efectivo', 'tarjeta', 'sinpe', 'otro'];
  const metodo = metodos.includes(datos.metodo_pago) ? datos.metodo_pago : 'efectivo';
  const monto = Number(datos.monto);
  if (!monto || monto <= 0) throw new Error('Monto de abono no válido');
  if (monto > saldoActual) {
    throw new Error('El abono supera el saldo pendiente (' + saldoActual + ')');
  }

  const nuevoCobrado = Math.round(((Number(orden.monto_cobrado) || 0) + monto) * 100) / 100;
  const nuevoSaldo = Math.round((saldoActual - monto) * 100) / 100;

  db.prepare(
    'UPDATE taller_ordenes SET monto_cobrado = ?, saldo_pendiente = ?, metodo_pago = ? WHERE id = ?'
  ).run(nuevoCobrado, nuevoSaldo, metodo, ordenId);

  const abonoResult = db.prepare(
    `INSERT INTO taller_orden_abonos (orden_id, monto, metodo_pago, tipo, nota)
     VALUES (?, ?, ?, 'abono', ?)`
  ).run(ordenId, monto, metodo, datos.nota || null);

  const data = obtenerOrden(db, ordenId);
  data.abono_id = abonoResult.lastInsertRowid;
  data.monto_cobrado_ahora = monto;
  return data;
}

function listarPendientesCobro(db) {
  // Cobros pendientes: solo de la empresa activa
  const empresaId = empresaService.getEmpresaActivaId(db);
  let sql = `
      SELECT o.*,
              v.placa, v.marca, v.modelo,
              c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM taller_ordenes o
       JOIN taller_vehiculos v ON v.id = o.vehiculo_id
       LEFT JOIN taller_clientes c ON c.id = o.cliente_id
       WHERE o.saldo_pendiente > 0 AND o.estado != 'cancelado'`;
  const params = [];
  if (empresaId) {
    sql += ' AND o.empresa_id = ?';
    params.push(empresaId);
  }
  sql += ' ORDER BY o.fecha_entrega DESC, o.id DESC';
  const filas = db.prepare(sql).all(...params).map(mapOrdenRow);
  const saldoTotal = filas.reduce(function (s, o) {
    return s + (Number(o.saldo_pendiente) || 0);
  }, 0);
  return { filas, cantidad: filas.length, saldo_total: saldoTotal };
}

function resumenHoy(db) {
  // Resumen del día (órdenes, cobros): números solo de la empresa activa
  const empresaId = empresaService.getEmpresaActivaId(db);
  const filtroOrd = empresaId ? ' AND empresa_id = ?' : '';
  const filtroOrdParams = empresaId ? [empresaId] : [];
  const activas = db
    .prepare(
      "SELECT COUNT(*) AS n FROM taller_ordenes WHERE estado NOT IN ('entregado', 'cancelado')" +
        filtroOrd
    )
    .get(...filtroOrdParams).n || 0;
  const listas = db
    .prepare("SELECT COUNT(*) AS n FROM taller_ordenes WHERE estado = 'listo'" + filtroOrd)
    .get(...filtroOrdParams).n || 0;
  const entregadasHoy = db
    .prepare(
      `SELECT COUNT(*) AS n FROM taller_ordenes
       WHERE estado = 'entregado' AND date(fecha_entrega) = date('now', 'localtime')` + filtroOrd
    )
    .get(...filtroOrdParams).n || 0;
  let abonoSql = `SELECT COALESCE(SUM(a.monto), 0) AS t FROM taller_orden_abonos a
       JOIN taller_ordenes o ON o.id = a.orden_id
       WHERE date(a.fecha) = date('now', 'localtime')`;
  const abonoParams = [];
  if (empresaId) {
    abonoSql += ' AND o.empresa_id = ?';
    abonoParams.push(empresaId);
  }
  const cobradoHoy = db.prepare(abonoSql).get(...abonoParams).t || 0;
  let pendSql = `SELECT COUNT(*) AS n, COALESCE(SUM(saldo_pendiente), 0) AS saldo
       FROM taller_ordenes WHERE saldo_pendiente > 0 AND estado != 'cancelado'`;
  const pendParams = [];
  if (empresaId) {
    pendSql += ' AND empresa_id = ?';
    pendParams.push(empresaId);
  }
  const pendientes = db.prepare(pendSql).get(...pendParams);
  return {
    ordenes_activas: activas,
    ordenes_listas: listas,
    entregadas_hoy: entregadasHoy,
    cobrado_hoy: cobradoHoy,
    pendientes_cobro: pendientes.n || 0,
    saldo_pendiente_total: pendientes.saldo || 0
  };
}

function buscarVehiculos(db, q) {
  const pol = politicaActiva(db);
  const term = String(q || '').trim().toUpperCase();
  if (!term) return [];
  const like = '%' + term + '%';
  let sql = `
      SELECT v.*, c.nombre AS cliente_nombre, c.identificacion AS cliente_identificacion,
              c.telefono AS cliente_telefono, c.email AS cliente_email
       FROM taller_vehiculos v
       LEFT JOIN taller_clientes c ON c.id = v.cliente_id
       WHERE (v.placa LIKE ? OR v.marca LIKE ? OR v.modelo LIKE ?)`;
  let params = [like, like, like];
  const filtrado = appendFiltroEmpresa(sql, params, pol.compartir_clientes, 'v.empresa_id', pol.empresa_id);
  filtrado.sql += ' ORDER BY CASE WHEN v.placa = ? THEN 0 ELSE 1 END, v.placa LIMIT 30';
  filtrado.params.push(term);
  return db.prepare(filtrado.sql).all(...filtrado.params);
}

function obtenerVehiculoPorPlaca(db, placa) {
  const pol = politicaActiva(db);
  const p = String(placa || '').trim().toUpperCase();
  if (!p) return null;
  let sql = `
      SELECT v.*, c.nombre AS cliente_nombre, c.identificacion AS cliente_identificacion,
              c.telefono AS cliente_telefono, c.email AS cliente_email
       FROM taller_vehiculos v
       LEFT JOIN taller_clientes c ON c.id = v.cliente_id
       WHERE v.placa = ?`;
  let params = [p];
  const filtrado = appendFiltroEmpresa(sql, params, pol.compartir_clientes, 'v.empresa_id', pol.empresa_id);
  return db.prepare(filtrado.sql).get(...filtrado.params);
}

function prepararDatosTicket(db, ordenId) {
  const data = obtenerOrden(db, ordenId);
  if (!data) throw new Error('Orden no encontrada');
  const o = data.orden;
  const vehiculo = [o.marca, o.modelo, o.anio].filter(Boolean).join(' ');
  let fecha = o.fecha_ingreso;
  try {
    fecha = new Date(o.fecha_ingreso).toLocaleString('es-CR');
  } catch (e) {
    /* keep raw */
  }
  return {
    numero: o.numero,
    placa: o.placa,
    vehiculo: vehiculo,
    color: o.color || '',
    kilometraje: o.kilometraje || '',
    cliente: o.cliente_nombre || '',
    telefono: o.cliente_telefono || '',
    empleado: o.usuario_nombre || '',
    diagnostico: o.diagnostico || '',
    estado: o.estado || '',
    subtotal: o.subtotal,
    iva: o.iva,
    total: o.total,
    metodo: o.metodo_pago || '',
    montoPagado: o.monto_cobrado || 0,
    items: (data.lineas || []).map(function (l) {
      return {
        cantidad: l.cantidad,
        nombre: (l.tipo === 'mano_obra' ? '[MO] ' : l.tipo === 'repuesto' ? '[REP] ' : '') + l.descripcion,
        total: l.subtotal
      };
    }),
    fecha: fecha
  };
}

function listarClientes(db, query) {
  // Lista clientes filtrados: empresa aparte = solo los suyos; compartida = pool común (empresa_id NULL)
  query = query || {};
  const pol = politicaActiva(db);
  const q = String(query.q || '').trim();
  const fCli = empresaService.filtroSqlEmpresa(pol.compartir_clientes, 'c.empresa_id', pol.empresa_id);
  const fVeh = empresaService.filtroSqlEmpresa(pol.compartir_clientes, 'v.empresa_id', pol.empresa_id);
  const ordenEmpresa = pol.empresa_id ? ' AND o.empresa_id = ?' : '';
  let sql =
    `SELECT c.id, c.nombre, c.identificacion, c.telefono, c.email, c.fecha_registro,
           (SELECT COUNT(*) FROM taller_vehiculos v WHERE v.cliente_id = c.id` +
    fVeh.clause +
    `) AS vehiculos,
           (SELECT COUNT(*) FROM taller_ordenes o WHERE o.cliente_id = c.id` +
    ordenEmpresa +
    `) AS ordenes,
           (SELECT IFNULL(SUM(o.saldo_pendiente), 0) FROM taller_ordenes o
              WHERE o.cliente_id = c.id AND o.estado != 'cancelado'` +
    ordenEmpresa +
    `) AS saldo_pendiente
    FROM taller_clientes c
    WHERE 1=1` +
    fCli.clause;
  const params = fVeh.params.slice();
  if (pol.empresa_id) {
    params.push(pol.empresa_id);
    params.push(pol.empresa_id);
  }
  params.push.apply(params, fCli.params);
  if (q) {
    sql += ' AND (c.nombre LIKE ? OR c.identificacion LIKE ? OR c.telefono LIKE ?)';
    const like = '%' + q + '%';
    params.push(like, like, like);
  }
  sql += ' ORDER BY c.nombre COLLATE NOCASE ASC LIMIT 300';
  const filas = db.prepare(sql).all(...params);
  return { filas: filas, cantidad: filas.length };
}

function obtenerClienteVehiculos(db, clienteId) {
  const pol = politicaActiva(db);
  const cli = db.prepare('SELECT id, empresa_id FROM taller_clientes WHERE id = ?').get(clienteId);
  if (!cli) return [];
  asegurarEnScope(cli, pol.compartir_clientes, pol.empresa_id, 'Cliente no encontrado');
  let sql =
    `SELECT id, placa, marca, modelo, anio, color FROM taller_vehiculos
       WHERE cliente_id = ?`;
  let params = [clienteId];
  const filtrado = appendFiltroEmpresa(sql, params, pol.compartir_clientes, 'empresa_id', pol.empresa_id);
  filtrado.sql += ' ORDER BY placa';
  return db.prepare(filtrado.sql).all(...filtrado.params);
}

function normItemInventario(datos) {
  const num = function (v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };
  const ivaRaw = datos.iva;
  return {
    codigo: String(datos.codigo || '').trim(),
    nombre: String(datos.nombre || '').trim(),
    categoria: String(datos.categoria || '').trim(),
    proveedor: String(datos.proveedor || '').trim(),
    cantidad: num(datos.cantidad),
    stock_minimo: num(datos.stock_minimo),
    costo: num(datos.costo),
    precio: num(datos.precio),
    cabys: String(datos.cabys || '').replace(/\D/g, '').slice(0, 13),
    unidad_medida: String(datos.unidad_medida || 'Unid').trim() || 'Unid',
    iva: ivaRaw === undefined || ivaRaw === null || ivaRaw === '' ? 13 : num(ivaRaw)
  };
}

function listarInventario(db, query) {
  // Repuestos: misma lógica que clientes pero con la bandera compartir_inventario
  query = query || {};
  const pol = politicaActiva(db);
  const q = String(query.q || '').trim();
  let sql = 'SELECT * FROM taller_inventario WHERE activo = 1';
  let params = [];
  const filtrado = appendFiltroEmpresa(sql, params, pol.compartir_inventario, 'empresa_id', pol.empresa_id);
  sql = filtrado.sql;
  params = filtrado.params;
  if (q) {
    sql += ' AND (nombre LIKE ? OR codigo LIKE ? OR categoria LIKE ? OR proveedor LIKE ?)';
    const like = '%' + q + '%';
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY nombre COLLATE NOCASE ASC LIMIT 500';
  const filas = db.prepare(sql).all(...params);
  const bajos = filas.filter(function (i) {
    return Number(i.stock_minimo) > 0 && Number(i.cantidad) <= Number(i.stock_minimo);
  }).length;
  const valor_inventario = filas.reduce(function (s, i) {
    return s + Number(i.cantidad) * Number(i.costo);
  }, 0);
  return { filas: filas, cantidad: filas.length, bajos: bajos, valor_inventario: valor_inventario };
}

function crearItemInventario(db, datos) {
  const pol = politicaActiva(db);
  const it = normItemInventario(datos);
  if (!it.nombre) throw new Error('El nombre del repuesto es obligatorio');
  const empIdReg = empresaIdRegistro(pol.compartir_inventario, pol.empresa_id);
  const r = db
    .prepare(
      `INSERT INTO taller_inventario (codigo, nombre, categoria, proveedor, cantidad, stock_minimo, costo, precio, cabys, unidad_medida, iva, empresa_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(it.codigo, it.nombre, it.categoria, it.proveedor, it.cantidad, it.stock_minimo, it.costo, it.precio, it.cabys, it.unidad_medida, it.iva, empIdReg);
  return db.prepare('SELECT * FROM taller_inventario WHERE id = ?').get(r.lastInsertRowid);
}

function actualizarItemInventario(db, id, datos) {
  const pol = politicaActiva(db);
  const existente = db.prepare('SELECT * FROM taller_inventario WHERE id = ?').get(id);
  if (!existente) throw new Error('Repuesto no encontrado');
  asegurarEnScope(existente, pol.compartir_inventario, pol.empresa_id, 'Repuesto no encontrado');
  const it = normItemInventario(datos);
  if (!it.nombre) throw new Error('El nombre del repuesto es obligatorio');
  db.prepare(
    `UPDATE taller_inventario
     SET codigo = ?, nombre = ?, categoria = ?, proveedor = ?, cantidad = ?, stock_minimo = ?, costo = ?, precio = ?,
         cabys = ?, unidad_medida = ?, iva = ?,
         fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(it.codigo, it.nombre, it.categoria, it.proveedor, it.cantidad, it.stock_minimo, it.costo, it.precio, it.cabys, it.unidad_medida, it.iva, id);
  return db.prepare('SELECT * FROM taller_inventario WHERE id = ?').get(id);
}

function eliminarItemInventario(db, id) {
  const pol = politicaActiva(db);
  const existente = db.prepare('SELECT * FROM taller_inventario WHERE id = ?').get(id);
  if (!existente) throw new Error('Repuesto no encontrado');
  asegurarEnScope(existente, pol.compartir_inventario, pol.empresa_id, 'Repuesto no encontrado');
  db.prepare('UPDATE taller_inventario SET activo = 0 WHERE id = ?').run(id);
  return { ok: true };
}

function crearCliente(db, datos) {
  const pol = politicaActiva(db);
  const nombre = String(datos.nombre || '').trim();
  if (!nombre) throw new Error('El nombre del cliente es obligatorio');
  const empIdReg = empresaIdRegistro(pol.compartir_clientes, pol.empresa_id);
  const r = db
    .prepare(
      `INSERT INTO taller_clientes (nombre, identificacion, telefono, email, empresa_id) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      nombre,
      String(datos.identificacion || '').trim() || null,
      String(datos.telefono || '').trim() || null,
      String(datos.email || '').trim() || null,
      empIdReg
    );
  return db.prepare('SELECT * FROM taller_clientes WHERE id = ?').get(r.lastInsertRowid);
}

function actualizarCliente(db, id, datos) {
  const pol = politicaActiva(db);
  const existente = db.prepare('SELECT * FROM taller_clientes WHERE id = ?').get(id);
  if (!existente) throw new Error('Cliente no encontrado');
  asegurarEnScope(existente, pol.compartir_clientes, pol.empresa_id, 'Cliente no encontrado');
  const nombre = datos.nombre != null
    ? String(datos.nombre).trim()
    : String(existente.nombre || '').trim();
  if (!nombre) throw new Error('El nombre del cliente es obligatorio');
  const identificacion = datos.identificacion != null
    ? String(datos.identificacion).trim() || null
    : existente.identificacion;
  const telefono = datos.telefono != null
    ? String(datos.telefono).trim() || null
    : existente.telefono;
  const email = datos.email != null
    ? String(datos.email).trim() || null
    : existente.email;
  db.prepare(
    `UPDATE taller_clientes SET nombre = ?, identificacion = ?, telefono = ?, email = ? WHERE id = ?`
  ).run(nombre, identificacion, telefono, email, id);
  return db.prepare('SELECT * FROM taller_clientes WHERE id = ?').get(id);
}

function listarCuentasPagar(db, query) {
  // Cuentas por pagar solo se comparten si clientes E inventario se comparten
  query = query || {};
  const pol = politicaActiva(db);
  let sql = 'SELECT * FROM taller_cuentas_pagar WHERE 1=1';
  let params = [];
  const filtrado = appendFiltroEmpresa(sql, params, pol.compartir_finanzas, 'empresa_id', pol.empresa_id);
  sql = filtrado.sql;
  params = filtrado.params;
  if (query.estado === 'pendiente' || query.estado === 'pagado') {
    sql += ' AND estado = ?';
    params.push(query.estado);
  }
  sql += " ORDER BY CASE WHEN estado = 'pendiente' THEN 0 ELSE 1 END, " +
    'IFNULL(fecha_vencimiento, fecha_registro) ASC LIMIT 500';
  const filas = db.prepare(sql).all(...params);
  const pendiente = filas
    .filter(function (c) { return c.estado === 'pendiente'; })
    .reduce(function (s, c) { return s + (Number(c.monto) || 0); }, 0);
  return { filas: filas, cantidad: filas.length, total_pendiente: pendiente };
}

function crearCuentaPagar(db, datos) {
  const pol = politicaActiva(db);
  const proveedor = String(datos.proveedor || '').trim();
  if (!proveedor) throw new Error('El proveedor es obligatorio');
  const monto = parseFloat(datos.monto);
  const empIdReg = empresaIdRegistro(pol.compartir_finanzas, pol.empresa_id);
  const r = db
    .prepare(
      `INSERT INTO taller_cuentas_pagar (proveedor, descripcion, monto, fecha, fecha_vencimiento, estado, nota, empresa_id)
       VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?)`
    )
    .run(
      proveedor,
      String(datos.descripcion || '').trim() || null,
      isNaN(monto) ? 0 : monto,
      String(datos.fecha || '').trim() || null,
      String(datos.fecha_vencimiento || '').trim() || null,
      String(datos.nota || '').trim() || null,
      empIdReg
    );
  return db.prepare('SELECT * FROM taller_cuentas_pagar WHERE id = ?').get(r.lastInsertRowid);
}

function actualizarCuentaPagar(db, id, datos) {
  const pol = politicaActiva(db);
  const existente = db.prepare('SELECT * FROM taller_cuentas_pagar WHERE id = ?').get(id);
  if (!existente) throw new Error('Cuenta no encontrada');
  asegurarEnScope(existente, pol.compartir_finanzas, pol.empresa_id, 'Cuenta no encontrada');
  if (datos.estado === 'pagado') {
    db.prepare(
      "UPDATE taller_cuentas_pagar SET estado = 'pagado', fecha_pago = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(id);
  } else if (datos.estado === 'pendiente') {
    db.prepare(
      "UPDATE taller_cuentas_pagar SET estado = 'pendiente', fecha_pago = NULL WHERE id = ?"
    ).run(id);
  }
  return db.prepare('SELECT * FROM taller_cuentas_pagar WHERE id = ?').get(id);
}

function eliminarCuentaPagar(db, id) {
  const pol = politicaActiva(db);
  const existente = db.prepare('SELECT * FROM taller_cuentas_pagar WHERE id = ?').get(id);
  if (!existente) throw new Error('Cuenta no encontrada');
  asegurarEnScope(existente, pol.compartir_finanzas, pol.empresa_id, 'Cuenta no encontrada');
  db.prepare('DELETE FROM taller_cuentas_pagar WHERE id = ?').run(id);
  return { ok: true };
}

function rutaArchivoFoto(ordenId, nombreArchivo) {
  const safe = path.basename(String(nombreArchivo || ''));
  const full = path.join(FOTOS_DIR, String(ordenId), safe);
  if (!full.startsWith(FOTOS_DIR) || !fs.existsSync(full)) {
    return null;
  }
  return full;
}

module.exports = {
  ESTADOS_ORDEN,
  FOTOS_DIR,
  listarOrdenes,
  obtenerOrden,
  crearOrden,
  actualizarOrden,
  agregarLinea,
  eliminarLinea,
  reemplazarLineasOrden,
  facturarDesdeProforma,
  agregarFoto,
  cobrarOrden,
  registrarAbono,
  listarPendientesCobro,
  resumenHoy,
  buscarVehiculos,
  obtenerVehiculoPorPlaca,
  prepararDatosTicket,
  rutaArchivoFoto,
  urlFoto,
  listarClientes,
  obtenerClienteVehiculos,
  crearCliente,
  actualizarCliente,
  listarInventario,
  crearItemInventario,
  actualizarItemInventario,
  eliminarItemInventario,
  listarCuentasPagar,
  crearCuentaPagar,
  actualizarCuentaPagar,
  eliminarCuentaPagar
};
