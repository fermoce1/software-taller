const path = require('path');
process.chdir(path.join(__dirname, '..'));
const { getDb } = require('../db/database');

const db = getDb();
const antes = db.prepare(
  "SELECT id, nombre, usuario, rol, CASE WHEN password_hash IS NULL OR password_hash = '' THEN 0 ELSE 1 END AS tiene_clave FROM usuarios"
).all();
console.log('Antes:', JSON.stringify(antes, null, 2));

db.prepare('UPDATE usuarios SET password_hash = NULL').run();

try {
  db.prepare(
    "INSERT INTO configuracion (clave, valor) VALUES ('usuarios_entrada_sin_clave', '1') ON CONFLICT(clave) DO UPDATE SET valor = '1'"
  ).run();
} catch (e) {
  const row = db.prepare("SELECT 1 FROM configuracion WHERE clave = 'usuarios_entrada_sin_clave'").get();
  if (row) {
    db.prepare("UPDATE configuracion SET valor = '1' WHERE clave = 'usuarios_entrada_sin_clave'").run();
  } else {
    db.prepare("INSERT INTO configuracion (clave, valor) VALUES ('usuarios_entrada_sin_clave', '1')").run();
  }
}

const despues = db.prepare(
  "SELECT id, nombre, usuario, rol, CASE WHEN password_hash IS NULL OR password_hash = '' THEN 0 ELSE 1 END AS tiene_clave FROM usuarios"
).all();
console.log('Después:', JSON.stringify(despues, null, 2));
console.log('OK: contraseñas eliminadas');
