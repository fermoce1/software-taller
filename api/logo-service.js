/**
 * Logo por empresa — archivos en data/logos/empresa-{id}.{ext}
 */
const fs = require('fs');
const path = require('path');

const LOGO_DIR = path.join(__dirname, '..', 'data', 'logos');
const MAX_BYTES = 2 * 1024 * 1024;

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
};

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function asegurarDir() {
  if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });
}

function buscarArchivo(id) {
  asegurarDir();
  const prefix = 'empresa-' + id + '.';
  const files = fs.readdirSync(LOGO_DIR).filter(function (f) {
    return f.indexOf(prefix) === 0;
  });
  return files.length ? path.join(LOGO_DIR, files[0]) : null;
}

function existeLogo(id) {
  return !!buscarArchivo(id);
}

function mimeDesdeRuta(filePath) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function urlLogo(id) {
  const p = buscarArchivo(id);
  if (!p) return null;
  const t = Math.floor(fs.statSync(p).mtimeMs);
  return '/api/taller/logo?empresa_id=' + id + '&t=' + t;
}

function eliminarLogo(id) {
  const p = buscarArchivo(id);
  if (p) fs.unlinkSync(p);
  return { ok: true };
}

function guardarLogo(id, buffer, mimeType) {
  const ext = EXT_BY_MIME[String(mimeType || '').toLowerCase()];
  if (!ext) {
    throw new Error('Formato no permitido. Use PNG, JPG, GIF, WebP o SVG.');
  }
  if (!buffer || !buffer.length) throw new Error('Imagen vacía');
  if (buffer.length > MAX_BYTES) throw new Error('La imagen no puede superar 2 MB');

  asegurarDir();
  eliminarLogo(id);
  const dest = path.join(LOGO_DIR, 'empresa-' + id + '.' + ext);
  fs.writeFileSync(dest, buffer);
  return { ok: true, url: urlLogo(id) };
}

function guardarLogoBase64(id, dataUrlOrBase64, mimeHint) {
  var mime = mimeHint;
  var b64 = dataUrlOrBase64;
  if (typeof dataUrlOrBase64 === 'string' && dataUrlOrBase64.indexOf('data:') === 0) {
    var m = dataUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('Imagen inválida');
    mime = m[1];
    b64 = m[2];
  }
  return guardarLogo(id, Buffer.from(b64, 'base64'), mime);
}

function leerLogo(id) {
  const p = buscarArchivo(id);
  if (!p) return null;
  return { path: p, mime: mimeDesdeRuta(p) };
}

module.exports = {
  existeLogo,
  urlLogo,
  guardarLogo,
  guardarLogoBase64,
  leerLogo,
  eliminarLogo
};
