/**
 * SANMY Taller — validación de licencias en el servidor (HMAC-SHA256 + PCID)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getConfig, setConfig } = require('../db/database');

const CFG = {
  CLAVE_SECRETA: ['Sanmy', 'TPV', '_', 'Tecnosur', '_', '2026', '_', 'SK', 'v1'].join(''),
  FECHA_PERPETUA: '99991231',
  FORMATO: /^SANMY-(\d{8})-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/,
  PREFIJO_FIRMA: 'SANMY'
};

const CFG_LEGACY_TALLER = {
  CLAVE_SECRETA: ['Sanmy', 'Taller', '_', 'Tecnosur', '_', '2026', '_', 'SK', 'v1'].join(''),
  FORMATO: /^SANMYT-(\d{8})-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/,
  PREFIJO_FIRMA: 'SANMYT'
};

const APP_ROOT = path.join(__dirname, '..');
const ARCHIVO_SKIP_LOCAL = path.join(APP_ROOT, 'skip-licencia.local');

function licenciaOmitida() {
  if (process.env.SANMY_SKIP_LICENCIA === '1') return true;
  try {
    return fs.existsSync(ARCHIVO_SKIP_LOCAL);
  } catch (e) {
    return false;
  }
}

function hmacSha256(key, message) {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

function normalizarIdEquipo(idRaw) {
  return String(idRaw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function extraerCodigoPCID(texto) {
  if (!texto) return '';
  const bloqueCode = texto.match(/---CODE---\s*[\r\n]+([0-9A-F-]{20,})/i);
  if (bloqueCode) return normalizarIdEquipo(bloqueCode[1]);
  const enLinea = texto.match(/---CODE---\s*([0-9A-F-]{20,})/i);
  if (enLinea) return normalizarIdEquipo(enLinea[1]);
  const patronPcid = texto.match(/\b([0-9A-F]{4}(?:-[0-9A-F]{4}){7})\b/i);
  if (patronPcid) return normalizarIdEquipo(patronPcid[1]);
  return '';
}

function extraerIdDesdeTextoGetID(texto) {
  if (!texto) return '';
  const codePcid = extraerCodigoPCID(texto);
  if (codePcid) return codePcid;
  const lineas = String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const linea of lineas) {
    const etiqueta = linea.match(
      /(?:PCID|ID|EQUIPO|SERIAL|CODIGO|CODE|LICENSE|LICENCIA|M[AÁ]QUINA|PROGRAMA)[:\s=-]*([A-Z0-9-]{4,})/i
    );
    if (etiqueta) return normalizarIdEquipo(etiqueta[1]);
    if (/^[0-9A-F]{4}(-[0-9A-F]{4}){3,}$/i.test(linea)) return normalizarIdEquipo(linea);
    if (/^[A-Z0-9-]{8,}$/i.test(linea)) return normalizarIdEquipo(linea);
  }
  return normalizarIdEquipo(lineas[lineas.length - 1] || '');
}

function codigoEquipoConClave(idEquipo, claveSecreta) {
  const idNorm = normalizarIdEquipo(idEquipo);
  if (!idNorm) return 'XXXX';
  return hmacSha256(claveSecreta, 'EQ|' + idNorm).substring(0, 4).toUpperCase();
}

function calcularFirmaConPrefijo(prefijo, claveSecreta, fechaExpiracion, codigoCliente, tipo, idEquipo) {
  const idNorm = normalizarIdEquipo(idEquipo);
  const mensaje = `${prefijo}|${fechaExpiracion}|${codigoCliente}|${tipo}|${idNorm}`;
  return hmacSha256(claveSecreta, mensaje).substring(0, 4).toUpperCase();
}

function parsearFechaYYYYMMDD(str) {
  const y = parseInt(str.substring(0, 4), 10);
  const m = parseInt(str.substring(4, 6), 10) - 1;
  const d = parseInt(str.substring(6, 8), 10);
  return new Date(y, m, d, 23, 59, 59);
}

function validarLicenciaConReglas(clave, idEquipoActual, reglas) {
  const match = clave.match(reglas.FORMATO);
  if (!match) {
    return { valida: false, error: reglas.errorFormato };
  }

  const fechaExpiracion = match[1];
  const codigoCliente = match[2];
  const codigoEquipoLicencia = match[3];
  const firmaIngresada = match[4];
  const idNorm = normalizarIdEquipo(idEquipoActual);

  if (!idNorm) {
    return {
      valida: false,
      error: 'No se detectó el CODE de PCID. Ejecute OBTENER-ID-EQUIPO.bat y pegue el CODE.'
    };
  }

  if (codigoEquipoConClave(idNorm, reglas.CLAVE_SECRETA) !== codigoEquipoLicencia) {
    return { valida: false, error: 'Esta licencia no corresponde a este equipo (ID distinto).' };
  }

  let tipo = 'anual';
  let firmaValida = false;

  if (fechaExpiracion === CFG.FECHA_PERPETUA) {
    firmaValida =
      firmaIngresada ===
      calcularFirmaConPrefijo(reglas.PREFIJO_FIRMA, reglas.CLAVE_SECRETA, fechaExpiracion, codigoCliente, 'P', idNorm);
    tipo = 'perpetua';
  } else {
    const esTrial =
      firmaIngresada ===
      calcularFirmaConPrefijo(reglas.PREFIJO_FIRMA, reglas.CLAVE_SECRETA, fechaExpiracion, codigoCliente, 'T', idNorm);
    const esAnual =
      firmaIngresada ===
      calcularFirmaConPrefijo(reglas.PREFIJO_FIRMA, reglas.CLAVE_SECRETA, fechaExpiracion, codigoCliente, 'A', idNorm);
    if (esTrial) {
      firmaValida = true;
      tipo = 'trial';
    } else if (esAnual) {
      firmaValida = true;
      tipo = 'anual';
    }
  }

  if (!firmaValida) {
    return { valida: false, error: 'Firma de licencia incorrecta. Clave no autorizada.' };
  }

  if (fechaExpiracion !== CFG.FECHA_PERPETUA) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const expira = parsearFechaYYYYMMDD(fechaExpiracion);
    expira.setHours(0, 0, 0, 0);
    if (expira < hoy) {
      return { valida: false, error: 'Licencia expirada.' };
    }
  }

  return {
    valida: true,
    clave,
    codigoCliente,
    codigoEquipo: codigoEquipoLicencia,
    idEquipo: idNorm,
    fechaExpiracion,
    fechaExpiracionISO: parsearFechaYYYYMMDD(fechaExpiracion).toISOString(),
    tipo,
    error: null
  };
}

function validarLicencia(claveRaw, idEquipoActual) {
  const clave = String(claveRaw || '').trim().toUpperCase();
  if (clave.indexOf('SANMYT-') === 0) {
    return validarLicenciaConReglas(clave, idEquipoActual, {
      FORMATO: CFG_LEGACY_TALLER.FORMATO,
      CLAVE_SECRETA: CFG_LEGACY_TALLER.CLAVE_SECRETA,
      PREFIJO_FIRMA: CFG_LEGACY_TALLER.PREFIJO_FIRMA,
      errorFormato: 'Formato legacy SANMYT. Solicite licencia SANMY- universal.'
    });
  }
  return validarLicenciaConReglas(clave, idEquipoActual, {
    FORMATO: CFG.FORMATO,
    CLAVE_SECRETA: CFG.CLAVE_SECRETA,
    PREFIJO_FIRMA: CFG.PREFIJO_FIRMA,
    errorFormato: 'Formato inválido. Use: SANMY-YYYYMMDD-CCCC-MMMM-SSSS'
  });
}

function leerIdEquipoDesdeDisco(root) {
  const rutas = ['id_equipo.txt', 'ID.txt', 'id.txt'];
  for (const nombre of rutas) {
    const p = path.join(root, nombre);
    try {
      if (!fs.existsSync(p)) continue;
      const texto = fs.readFileSync(p, 'utf8');
      const id = extraerIdDesdeTextoGetID(texto);
      if (id) return id;
    } catch (e) {
      /* ignore */
    }
  }
  return '';
}

function leerLicenciaGuardada(db) {
  return {
    clave: getConfig(db, 'licencia_clave', ''),
    codigoCliente: getConfig(db, 'licencia_codigo_cliente', ''),
    nombreCliente: getConfig(db, 'licencia_nombre_cliente', ''),
    tipo: getConfig(db, 'licencia_tipo', ''),
    fechaExpiracion: getConfig(db, 'licencia_fecha_expiracion', ''),
    idEquipo: getConfig(db, 'licencia_id_equipo', '')
  };
}

function guardarLicencia(db, resultado, nombreCliente) {
  setConfig(db, 'licencia_clave', resultado.clave);
  setConfig(db, 'licencia_codigo_cliente', resultado.codigoCliente || '');
  setConfig(db, 'licencia_nombre_cliente', String(nombreCliente || '').trim());
  setConfig(db, 'licencia_tipo', resultado.tipo || '');
  setConfig(db, 'licencia_fecha_expiracion', resultado.fechaExpiracion || '');
  setConfig(db, 'licencia_id_equipo', resultado.idEquipo || '');
}

function obtenerEstado(db, root) {
  if (licenciaOmitida()) {
    return {
      valida: true,
      omitida: true,
      clave: '',
      tipo: 'desarrollo',
      mensaje: 'Validación de licencia desactivada (SANMY_SKIP_LICENCIA=1)'
    };
  }

  const guardada = leerLicenciaGuardada(db);
  if (!guardada.clave) {
    return { valida: false, error: 'Sin licencia activada en este equipo.' };
  }

  const idDisco = leerIdEquipoDesdeDisco(root);
  const idEquipo = idDisco || guardada.idEquipo;
  const resultado = validarLicencia(guardada.clave, idEquipo);

  if (!resultado.valida) {
    return {
      valida: false,
      error: resultado.error,
      clave: guardada.clave,
      codigoCliente: guardada.codigoCliente,
      nombreCliente: guardada.nombreCliente,
      tipo: guardada.tipo
    };
  }

  return {
    valida: true,
    clave: resultado.clave,
    codigoCliente: resultado.codigoCliente,
    nombreCliente: guardada.nombreCliente,
    tipo: resultado.tipo,
    fechaExpiracion: resultado.fechaExpiracion,
    fechaExpiracionISO: resultado.fechaExpiracionISO,
    idEquipo: resultado.idEquipo,
    idEquipoFormateado: formatearCodigoPCID(resultado.idEquipo)
  };
}

function formatearCodigoPCID(idNorm) {
  if (!idNorm || idNorm.length !== 32) return idNorm || '';
  return idNorm.match(/.{1,4}/g).join('-');
}

function activarLicencia(db, root, body) {
  const clave = String((body && body.clave) || '').trim();
  if (!clave) {
    throw new Error('Ingrese la clave de licencia');
  }

  let idEquipo = normalizarIdEquipo(body && body.idEquipo);
  if (!idEquipo) {
    idEquipo = leerIdEquipoDesdeDisco(root);
  }
  if (!idEquipo && body && body.textoPcid) {
    idEquipo = extraerIdDesdeTextoGetID(body.textoPcid);
  }
  if (!idEquipo) {
    throw new Error('No se detectó el CODE de PCID. Ejecute OBTENER-ID-EQUIPO.bat.');
  }

  const resultado = validarLicencia(clave, idEquipo);
  if (!resultado.valida) {
    throw new Error(resultado.error || 'Licencia inválida');
  }

  guardarLicencia(db, resultado, body && body.nombreCliente);

  const idFile = path.join(root, 'id_equipo.txt');
  if (!fs.existsSync(idFile)) {
    const texto =
      'Informacion PCID del Equipo:\n---CODE---\n' + formatearCodigoPCID(idEquipo) + '\n';
    fs.writeFileSync(idFile, texto, 'utf8');
  }

  return {
    ok: true,
    mensaje: 'Licencia activada correctamente',
    estado: obtenerEstado(db, root)
  };
}

module.exports = {
  CFG,
  licenciaOmitida,
  validarLicencia,
  leerIdEquipoDesdeDisco,
  obtenerEstado,
  activarLicencia,
  formatearCodigoPCID,
  extraerIdDesdeTextoGetID
};
