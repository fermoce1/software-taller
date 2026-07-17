const crypto = require('crypto');

const ROLES = ['admin', 'gerente', 'recepcion', 'tecnico'];

const ROL_LABELS = {
  admin: 'Administrador',
  gerente: 'Gerente',
  recepcion: 'Recepción',
  tecnico: 'Técnico'
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const parts = String(stored).split(':');
  if (parts.length !== 2) return false;
  const hash2 = crypto.scryptSync(String(password), parts[0], 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(parts[1], 'hex'), Buffer.from(hash2, 'hex'));
  } catch (e) {
    return false;
  }
}

function normalizarUsuario(login) {
  return String(login || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function tienePasswordHash(row) {
  return !!(row && row.password_hash && String(row.password_hash).trim());
}

function mapUsuario(row, incluirInterno) {
  if (!row) return null;
  const u = {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido || '',
    nombre_completo: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
    usuario: row.usuario || '',
    rol: row.rol || 'tecnico',
    rol_label: ROL_LABELS[row.rol] || row.rol,
    email: row.email || '',
    telefono: row.telefono || '',
    activo: row.activo !== 0,
    tiene_password: tienePasswordHash(row),
    fecha_creacion: row.fecha_creacion || null,
    fecha_actualizacion: row.fecha_actualizacion || null
  };
  if (incluirInterno) {
    u.password_hash = row.password_hash;
  }
  return u;
}

function listarUsuarios(db, opts) {
  opts = opts || {};
  let sql =
    'SELECT id, nombre, apellido, usuario, rol, email, telefono, activo, password_hash, fecha_creacion, fecha_actualizacion FROM usuarios';
  const params = [];
  if (!opts.todos) {
    sql += ' WHERE activo = 1';
  }
  if (opts.q) {
    sql += (params.length || !opts.todos ? ' AND' : ' WHERE') + ' (LOWER(nombre) LIKE ? OR LOWER(apellido) LIKE ? OR LOWER(usuario) LIKE ?)';
    const like = '%' + String(opts.q).trim().toLowerCase() + '%';
    params.push(like, like, like);
  }
  sql += ' ORDER BY nombre, apellido';
  return db.prepare(sql).all(...params).map(function (r) {
    return mapUsuario(r);
  });
}

function obtenerUsuario(db, id) {
  const row = db
    .prepare(
      'SELECT id, nombre, apellido, usuario, rol, email, telefono, activo, fecha_creacion, fecha_actualizacion FROM usuarios WHERE id = ?'
    )
    .get(id);
  return mapUsuario(row);
}

function usuarioLoginExiste(db, login, excluirId) {
  const u = normalizarUsuario(login);
  if (!u) return false;
  let sql = 'SELECT id FROM usuarios WHERE LOWER(usuario) = ?';
  const params = [u];
  if (excluirId) {
    sql += ' AND id != ?';
    params.push(excluirId);
  }
  return !!db.prepare(sql).get(...params);
}

function crearUsuario(db, datos) {
  const nombre = String(datos.nombre || '').trim();
  const usuario = normalizarUsuario(datos.usuario);
  const password = String(datos.password || '').trim();
  const rol = ROLES.indexOf(datos.rol) >= 0 ? datos.rol : 'tecnico';

  if (!nombre) throw new Error('El nombre es obligatorio');
  if (!usuario) throw new Error('El usuario de acceso es obligatorio');
  if (usuario.length < 3) throw new Error('El usuario debe tener al menos 3 caracteres');
  if (password && password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres');
  if (usuarioLoginExiste(db, usuario)) throw new Error('Ese usuario de acceso ya existe');

  const result = db
    .prepare(
      `INSERT INTO usuarios (nombre, apellido, usuario, password_hash, rol, email, telefono, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nombre,
      String(datos.apellido || '').trim(),
      usuario,
      password ? hashPassword(password) : null,
      rol,
      String(datos.email || '').trim() || null,
      String(datos.telefono || '').trim() || null,
      datos.activo === false || datos.activo === 0 ? 0 : 1
    );

  return obtenerUsuario(db, result.lastInsertRowid);
}

function actualizarUsuario(db, id, datos) {
  const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!row) throw new Error('Usuario no encontrado');

  const campos = [];
  const params = [];

  if (datos.nombre != null) {
    const nombre = String(datos.nombre).trim();
    if (!nombre) throw new Error('El nombre es obligatorio');
    campos.push('nombre = ?');
    params.push(nombre);
  }
  if (datos.apellido != null) {
    campos.push('apellido = ?');
    params.push(String(datos.apellido).trim());
  }
  if (datos.usuario != null) {
    const usuario = normalizarUsuario(datos.usuario);
    if (!usuario) throw new Error('El usuario de acceso es obligatorio');
    if (usuarioLoginExiste(db, usuario, id)) throw new Error('Ese usuario de acceso ya existe');
    campos.push('usuario = ?');
    params.push(usuario);
  }
  if (datos.rol != null) {
    if (ROLES.indexOf(datos.rol) < 0) throw new Error('Rol no válido');
    campos.push('rol = ?');
    params.push(datos.rol);
  }
  if (datos.email != null) {
    campos.push('email = ?');
    params.push(String(datos.email).trim() || null);
  }
  if (datos.telefono != null) {
    campos.push('telefono = ?');
    params.push(String(datos.telefono).trim() || null);
  }
  if (datos.activo != null) {
    campos.push('activo = ?');
    params.push(datos.activo === false || datos.activo === 0 ? 0 : 1);
  }
  if (datos.password != null) {
    const password = String(datos.password).trim();
    if (!password) {
      campos.push('password_hash = ?');
      params.push(null);
    } else if (password.length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres');
    } else {
      campos.push('password_hash = ?');
      params.push(hashPassword(password));
    }
  }

  if (!campos.length) return obtenerUsuario(db, id);

  campos.push('fecha_actualizacion = CURRENT_TIMESTAMP');
  params.push(id);
  db.prepare('UPDATE usuarios SET ' + campos.join(', ') + ' WHERE id = ?').run(...params);
  return obtenerUsuario(db, id);
}

function desactivarUsuario(db, id) {
  const row = db.prepare('SELECT id, rol, activo FROM usuarios WHERE id = ?').get(id);
  if (!row) throw new Error('Usuario no encontrado');
  if (row.activo === 0) return { ok: true };

  const admins = db
    .prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1 AND id != ?")
    .get(id);
  if (row.rol === 'admin' && (admins.n || 0) < 1) {
    throw new Error('Debe quedar al menos un administrador activo');
  }

  db.prepare('UPDATE usuarios SET activo = 0, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  return { ok: true };
}

function loginUsuario(db, datos) {
  datos = datos || {};
  const password = String(datos.password || '');

  if (datos.id) {
    const row = db.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1').get(Number(datos.id));
    if (!row) throw new Error('Usuario no encontrado');
    if (tienePasswordHash(row)) {
      if (password && !verifyPassword(password, row.password_hash)) {
        throw new Error('Contraseña incorrecta');
      }
    }
    return mapUsuario(row);
  }

  const usuario = normalizarUsuario(datos.usuario);
  if (!usuario) throw new Error('Usuario es obligatorio');

  const row = db
    .prepare('SELECT * FROM usuarios WHERE LOWER(usuario) = ? AND activo = 1')
    .get(usuario);
  if (!row) throw new Error('Usuario o contraseña incorrectos');

  if (tienePasswordHash(row)) {
    if (password && !verifyPassword(password, row.password_hash)) {
      throw new Error('Usuario o contraseña incorrectos');
    }
  }

  return mapUsuario(row);
}

function seedDefaults(db) {
  const cols = db.prepare('PRAGMA table_info(usuarios)').all();
  const names = cols.map(function (c) {
    return c.name;
  });
  if (names.indexOf('usuario') < 0) {
    db.exec('ALTER TABLE usuarios ADD COLUMN usuario TEXT');
  }
  if (names.indexOf('password_hash') < 0) {
    db.exec('ALTER TABLE usuarios ADD COLUMN password_hash TEXT');
  }
  if (names.indexOf('rol') < 0) {
    db.exec("ALTER TABLE usuarios ADD COLUMN rol TEXT DEFAULT 'tecnico'");
  }
  if (names.indexOf('email') < 0) {
    db.exec('ALTER TABLE usuarios ADD COLUMN email TEXT');
  }
  if (names.indexOf('telefono') < 0) {
    db.exec('ALTER TABLE usuarios ADD COLUMN telefono TEXT');
  }
  if (names.indexOf('fecha_creacion') < 0) {
    db.exec('ALTER TABLE usuarios ADD COLUMN fecha_creacion DATETIME');
    db.exec("UPDATE usuarios SET fecha_creacion = CURRENT_TIMESTAMP WHERE fecha_creacion IS NULL");
  }
  if (names.indexOf('fecha_actualizacion') < 0) {
    db.exec('ALTER TABLE usuarios ADD COLUMN fecha_actualizacion DATETIME');
    db.exec("UPDATE usuarios SET fecha_actualizacion = CURRENT_TIMESTAMP WHERE fecha_actualizacion IS NULL");
  }

  const sinHash = db
    .prepare("SELECT * FROM usuarios WHERE password_hash IS NULL OR password_hash = ''")
    .all();
  const tieneAdmin = db.prepare("SELECT id FROM usuarios WHERE rol = 'admin' AND activo = 1 LIMIT 1").get();

  sinHash.forEach(function (u) {
    if (!u.usuario) {
      const login = String(u.nombre || 'usuario')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');
      db.prepare('UPDATE usuarios SET usuario = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?').run(
        login || 'usuario' + u.id,
        u.id
      );
    }
  });

  const admin = db.prepare("SELECT id FROM usuarios WHERE rol = 'admin' AND activo = 1 LIMIT 1").get();
  if (!admin) {
    db.prepare(
      `INSERT INTO usuarios (nombre, apellido, usuario, password_hash, rol, activo)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).run('Administrador', '', 'admin', null, 'admin');
  }
}

module.exports = {
  ROLES,
  ROL_LABELS,
  hashPassword,
  verifyPassword,
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  loginUsuario,
  seedDefaults,
  mapUsuario
};
