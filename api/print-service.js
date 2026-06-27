const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ticketService = require('./ticket-service');

const ESC = 0x1b;
const GS = 0x1d;

function lineWidth(anchoMm) {
  return anchoMm <= 58 ? 32 : 48;
}

function buildPlainTextTicket(tipo, datos, config, opciones) {
  const ticketCfg = (config && config.ticket) || {};
  return ticketService.buildPlainTextTicket(tipo, datos, ticketCfg, opciones || {});
}

function buildEscPosBuffer(plainText) {
  const chunks = [];
  chunks.push(Buffer.from([ESC, 0x40]));
  chunks.push(Buffer.from(plainText, 'utf8'));
  chunks.push(Buffer.from('\n\n\n', 'utf8'));
  chunks.push(Buffer.from([GS, 0x56, 0x42, 0x00]));
  return Buffer.concat(chunks);
}

function printNetwork(ip, port, buffer, timeoutMs) {
  timeoutMs = timeoutMs || 8000;
  return new Promise(function (resolve, reject) {
    if (!ip) {
      reject(new Error('IP de impresora no configurada'));
      return;
    }
    const socket = new net.Socket();
    let settled = false;

    function finish(err) {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch (e) {
        /* ignore */
      }
      if (err) reject(err);
      else resolve();
    }

    socket.setTimeout(timeoutMs);
    socket.on('timeout', function () {
      finish(new Error('Tiempo de espera agotado al conectar con ' + ip));
    });
    socket.on('error', function (err) {
      finish(new Error('No se pudo conectar a ' + ip + ':' + port + ' — ' + err.message));
    });
    socket.connect(port, ip, function () {
      socket.write(buffer, function (err) {
        if (err) {
          finish(err);
          return;
        }
        socket.end();
        finish(null);
      });
    });
  });
}

function printWindows(nombreSistema, plainText) {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, 'sanmy-print-' + Date.now() + '.txt');
  fs.writeFileSync(tmpFile, plainText, 'utf8');

  try {
    const psScript = [
      '$ErrorActionPreference = "Stop"',
      '$path = ' + JSON.stringify(tmpFile),
      '$content = Get-Content -LiteralPath $path -Raw -Encoding UTF8',
      nombreSistema
        ? 'Out-Printer -InputObject $content -Name ' + JSON.stringify(nombreSistema)
        : 'Out-Printer -InputObject $content'
    ].join('; ');

    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      { encoding: 'utf8', timeout: 20000, windowsHide: true }
    );
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch (e) {
      /* ignore */
    }
  }
}

function mapImpresoraConfig(imp) {
  return {
    id: imp.id,
    nombre: imp.nombre,
    rol: imp.rol,
    conexion: imp.conexion,
    nombre_sistema: imp.nombre_sistema || '',
    ip: imp.ip || '',
    puerto: imp.puerto || 9100,
    ancho_mm: imp.ancho_mm || 80,
    copias: imp.copias || 1,
    activa: imp.activa === 1 || imp.activa === true,
    predeterminada: imp.predeterminada === 1 || imp.predeterminada === true
  };
}

function resolveImpresora(db, impresoraId, inlineImpresora) {
  if (inlineImpresora && inlineImpresora.conexion) {
    return mapImpresoraConfig({
      id: inlineImpresora.id || 0,
      nombre: inlineImpresora.nombre || 'Prueba',
      rol: inlineImpresora.rol || 'recibo',
      conexion: inlineImpresora.conexion,
      nombre_sistema: inlineImpresora.nombre_sistema || '',
      ip: inlineImpresora.ip || '',
      puerto: inlineImpresora.puerto || 9100,
      ancho_mm: inlineImpresora.ancho_mm || 80,
      copias: inlineImpresora.copias || 1,
      activa: 1
    });
  }
  if (!impresoraId) {
    throw new Error('Impresora no especificada');
  }
  const row = db.prepare('SELECT * FROM impresoras WHERE id = ?').get(impresoraId);
  if (!row) {
    throw new Error('Impresora no encontrada');
  }
  return mapImpresoraConfig(row);
}

function pickImpresoraPorRol(db, rol) {
  const rows = db
    .prepare('SELECT * FROM impresoras WHERE activa = 1 ORDER BY orden, id')
    .all();
  const mapped = rows.map(mapImpresoraConfig);
  return (
    mapped.find(function (p) {
      return p.rol === rol;
    }) ||
    mapped.find(function (p) {
      return p.rol === 'general';
    }) ||
    mapped.find(function (p) {
      return p.predeterminada;
    }) ||
    mapped[0] ||
    null
  );
}

function getPrintConfig(db) {
  const ticket = ticketService.getTicketConfig(db);
  return {
    nombre_negocio: ticket.nombre_negocio,
    pie_ticket: ticket.pie,
    ticket: ticket
  };
}

function rolParaTipo(tipo) {
  if (tipo === 'factura') return 'factura';
  if (tipo === 'cocina') return 'cocina';
  if (tipo === 'bar') return 'bar';
  if (tipo === 'taller') return 'recibo';
  return 'recibo';
}

async function imprimirTicket(db, payload) {
  const tipo = payload.tipo || 'recibo';
  const datos = payload.datos || {};
  const config = payload.config || getPrintConfig(db);
  const prueba = !!payload.prueba;
  const copiasReq =
    payload.copias !== undefined
      ? Math.max(1, parseInt(payload.copias, 10) || 1)
      : null;

  let imp = null;
  if (payload.impresora_id || payload.impresora) {
    imp = resolveImpresora(db, payload.impresora_id, payload.impresora);
  } else {
    imp = pickImpresoraPorRol(db, rolParaTipo(tipo));
  }

  if (!imp) {
    throw new Error('No hay impresora activa configurada para ' + tipo);
  }
  if (!imp.activa && !prueba) {
    throw new Error('La impresora "' + imp.nombre + '" esta inactiva');
  }

  if (imp.conexion === 'red' && !imp.ip) {
    throw new Error('Configure la IP de la impresora de red');
  }

  const plain = buildPlainTextTicket(tipo, datos, config, {
    anchoMm: imp.ancho_mm,
    prueba: prueba
  });
  const buffer = buildEscPosBuffer(plain);
  const veces = copiasReq !== null ? copiasReq : imp.copias || 1;

  for (let i = 0; i < veces; i++) {
    if (imp.conexion === 'red') {
      await printNetwork(imp.ip, imp.puerto || 9100, buffer);
    } else if (process.platform === 'win32') {
      printWindows(imp.nombre_sistema, plain);
    } else {
      throw new Error('Impresion Windows solo disponible en el servidor PC');
    }
  }

  return { ok: true, impresora: imp.nombre, copias: veces };
}

function datosPrueba() {
  return ticketService.datosPruebaTicket();
}

async function imprimirPrueba(db, payload) {
  const imp = resolveImpresora(
    db,
    payload.impresora_id,
    payload.impresora
  );
  const tipo =
    imp.rol === 'factura'
      ? 'factura'
      : imp.rol === 'cocina'
        ? 'cocina'
        : imp.rol === 'bar'
          ? 'bar'
          : 'recibo';

  return imprimirTicket(db, {
    tipo: tipo,
    datos: datosPrueba(),
    impresora: imp,
    prueba: true,
    copias: 1
  });
}

module.exports = {
  buildPlainTextTicket,
  imprimirTicket,
  imprimirPrueba,
  pickImpresoraPorRol,
  getPrintConfig
};
