/**
 * WhatsApp vía wa.me (gratis, sin API de Meta).
 */

function formatearColones(valor) {
  return (
    '₡' +
    Number(valor || 0).toLocaleString('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
}

function normalizarTelefonoWa(telefono) {
  var d = String(telefono || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.indexOf('00') === 0) d = d.substring(2);
  if (d.length === 8) d = '506' + d;
  if (d.length === 10 && d.charAt(0) === '0') d = '506' + d.substring(1);
  if (d.length < 11) return '';
  return d;
}

function buildMensaje(tipo, datos, config, urls) {
  urls = urls || {};
  var negocio = (config && config.nombre_negocio) || 'Sanmy Taller';
  var lines = [];

  if (tipo === 'presupuesto') {
    lines.push('Presupuesto — ' + negocio);
  } else if (tipo === 'factura') {
    lines.push('Factura — ' + negocio);
  } else {
    lines.push('Orden de taller — ' + negocio);
  }

  lines.push('Orden #' + (datos.numero || ''));
  lines.push('Placa: ' + (datos.placa || '-'));
  if (datos.vehiculo) lines.push('Vehículo: ' + datos.vehiculo);
  if (datos.cliente) lines.push('Cliente: ' + datos.cliente);
  if (datos.fecha) lines.push('Fecha: ' + datos.fecha);
  lines.push('Total: ' + formatearColones(datos.total));

  if (tipo === 'presupuesto') {
    lines.push('');
    lines.push('Documento estimado, no es factura fiscal.');
  }

  if (tipo === 'factura' && urls.facturaFe) {
    if (urls.facturaFe.consecutivo) {
      lines.push('Consecutivo FE: ' + urls.facturaFe.consecutivo);
    }
    if (urls.facturaFe.clave) {
      lines.push('Clave: ' + urls.facturaFe.clave);
    }
    if (urls.facturaFe.pdf_url) {
      lines.push('PDF oficial Hacienda: ' + urls.facturaFe.pdf_url);
    }
  }

  if (urls.pdf_url) {
    lines.push('');
    lines.push('Descargar PDF:');
    lines.push(urls.pdf_url);
  }

  return lines.join('\n');
}

function buildWaUrl(telefono, mensaje) {
  var t = normalizarTelefonoWa(telefono);
  if (!t) return '';
  return 'https://wa.me/' + t + '?text=' + encodeURIComponent(mensaje);
}

module.exports = {
  normalizarTelefonoWa,
  buildMensaje,
  buildWaUrl,
  formatearColones
};
