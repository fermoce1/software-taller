const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'respaldos');
const DB_PATH = path.join(DATA_DIR, 'sanmy-taller.db');

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function stampLocal(d) {
  const p = function (n) {
    return String(n).padStart(2, '0');
  };
  return (
    d.getFullYear() +
    '-' +
    p(d.getMonth() + 1) +
    '-' +
    p(d.getDate()) +
    '_' +
    p(d.getHours()) +
    '-' +
    p(d.getMinutes()) +
    '-' +
    p(d.getSeconds())
  );
}

function asegurarCarpeta() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function crearRespaldo(database) {
  asegurarCarpeta();
  const nombre = 'sanmy-taller-' + stampLocal(new Date()) + '.db';
  const dest = path.join(BACKUPS_DIR, nombre);
  const destSql = dest.replace(/\\/g, '/').replace(/'/g, "''");
  database.exec("VACUUM INTO '" + destSql + "'");
  const stat = fs.statSync(dest);
  return {
    nombre: nombre,
    tamano: stat.size,
    tamano_legible: formatBytes(stat.size),
    fecha: stat.mtime.toISOString()
  };
}

function listarRespaldos() {
  asegurarCarpeta();
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter(function (f) {
      return f.toLowerCase().endsWith('.db');
    })
    .map(function (f) {
      const full = path.join(BACKUPS_DIR, f);
      const st = fs.statSync(full);
      return {
        nombre: f,
        tamano: st.size,
        tamano_legible: formatBytes(st.size),
        fecha: st.mtime.toISOString()
      };
    })
    .sort(function (a, b) {
      return b.fecha.localeCompare(a.fecha);
    });
}

function rutaRespaldoSegura(nombre) {
  const base = path.basename(String(nombre || ''));
  if (!base || base !== nombre || !base.toLowerCase().endsWith('.db')) {
    return null;
  }
  if (!/^[a-zA-Z0-9._-]+\.db$/.test(base)) {
    return null;
  }
  const full = path.join(BACKUPS_DIR, base);
  if (!fs.existsSync(full)) return null;
  return full;
}

function esSqliteValido(ruta) {
  const fd = fs.openSync(ruta, 'r');
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  return buf.toString('utf8', 0, 15) === 'SQLite format 3';
}

function quitarWalShm(dbPath) {
  [dbPath + '-wal', dbPath + '-shm'].forEach(function (f) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
}

function restaurarDesdeArchivo(origenPath, database, dbPath, closeDb, reopenDb) {
  if (!fs.existsSync(origenPath)) throw new Error('Archivo de respaldo no encontrado.');
  if (!esSqliteValido(origenPath)) throw new Error('El archivo no es una base de datos Sanmy válida.');
  const respaldoPrevio = crearRespaldo(database);
  closeDb();
  try {
    quitarWalShm(dbPath);
    fs.copyFileSync(origenPath, dbPath);
    reopenDb();
  } catch (e) {
    try {
      reopenDb();
    } catch (e2) {
      /* ignore */
    }
    throw new Error('No se pudo restaurar: ' + e.message);
  }
  return { respaldo_previo: respaldoPrevio };
}

function guardarArchivoTemporal(base64, nombre) {
  asegurarCarpeta();
  let b64 = String(base64 || '');
  const m = b64.match(/^data:[^;]+;base64,(.+)$/);
  if (m) b64 = m[1];
  if (!b64) throw new Error('No se recibió el archivo de respaldo.');
  const tmp = path.join(BACKUPS_DIR, 'tmp-restore-' + Date.now() + '.db');
  fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
  if (!esSqliteValido(tmp)) {
    fs.unlinkSync(tmp);
    throw new Error('El archivo «' + (nombre || 'respaldo') + '» no es una base de datos .db válida.');
  }
  return tmp;
}

module.exports = {
  BACKUPS_DIR,
  DB_PATH,
  formatBytes,
  crearRespaldo,
  listarRespaldos,
  rutaRespaldoSegura,
  restaurarDesdeArchivo,
  guardarArchivoTemporal
};
