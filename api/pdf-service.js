const PDFDocument = require('pdfkit');
const { formatearColones } = require('./whatsapp-service');

function tituloDocumento(tipo) {
  if (tipo === 'presupuesto') return 'PRESUPUESTO';
  if (tipo === 'factura') return 'FACTURA';
  return 'ORDEN DE TALLER';
}

function generarPdfOrden(datos, config, tipo, opciones) {
  opciones = opciones || {};
  var doc = new PDFDocument({ margin: 48, size: 'A4' });
  var chunks = [];

  doc.on('data', function (chunk) {
    chunks.push(chunk);
  });

  var negocio = (config && config.nombre_negocio) || 'Sanmy Taller Mecánico';
  var titulo = tituloDocumento(tipo);

  doc.fontSize(20).text(negocio, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(15).text(titulo, { align: 'center' });
  if (datos.fecha) {
    doc.fontSize(10).fillColor('#555555').text(datos.fecha, { align: 'center' });
  }
  doc.fillColor('#000000');
  doc.moveDown();

  if (tipo === 'presupuesto') {
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text('Estimación de trabajo — no constituye factura fiscal.', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(0.5);
  }

  doc.fontSize(11);
  if (datos.numero) doc.text('Orden #: ' + datos.numero);
  doc.text('Placa: ' + (datos.placa || '-'));
  doc.text('Vehículo: ' + (datos.vehiculo || '-'));
  if (datos.color) doc.text('Color: ' + datos.color);
  if (datos.kilometraje) doc.text('Kilometraje: ' + datos.kilometraje + ' km');
  doc.text('Cliente: ' + (datos.cliente || '-'));
  if (datos.telefono) doc.text('Teléfono: ' + datos.telefono);
  if (datos.empleado) doc.text('Atendió: ' + datos.empleado);
  if (datos.estado) doc.text('Estado: ' + datos.estado);

  if (datos.diagnostico) {
    doc.moveDown(0.5);
    doc.fontSize(10).text('Diagnóstico:', { underline: true });
    doc.fontSize(10).text(String(datos.diagnostico || ''));
  }

  doc.moveDown();
  doc.fontSize(10).text('Detalle', { underline: true });
  doc.moveDown(0.3);

  (datos.items || []).forEach(function (it) {
    var linea =
      String(it.cantidad || 1) + ' x ' + (it.nombre || '') + ' — ' + formatearColones(it.total);
    doc.fontSize(10).text(linea);
  });

  doc.moveDown();
  doc.fontSize(11);
  doc.text('Subtotal: ' + formatearColones(datos.subtotal));
  doc.text('IVA: ' + formatearColones(datos.iva));
  doc.fontSize(12).text('TOTAL: ' + formatearColones(datos.total), { underline: true });

  if (datos.metodo) {
    doc.moveDown(0.5);
    doc.fontSize(10).text('Método de pago: ' + datos.metodo);
    if (datos.montoPagado) {
      doc.text('Cobrado: ' + formatearColones(datos.montoPagado));
    }
  }

  if (tipo === 'factura' && opciones.facturaFe) {
    doc.moveDown();
    doc.fontSize(10).text('Factura electrónica (Hacienda CR)', { underline: true });
    if (opciones.facturaFe.consecutivo) {
      doc.text('Consecutivo: ' + opciones.facturaFe.consecutivo);
    }
    if (opciones.facturaFe.clave) {
      doc.text('Clave: ' + opciones.facturaFe.clave);
    }
    if (opciones.facturaFe.estado) {
      doc.text('Estado: ' + opciones.facturaFe.estado);
    }
    if (opciones.facturaFe.pdf_url) {
      doc.text('PDF oficial: ' + opciones.facturaFe.pdf_url);
    }
  }

  doc.moveDown(2);
  doc.fontSize(9).fillColor('#888888').text('Generado por Sanmy Taller', { align: 'center' });

  doc.end();

  return new Promise(function (resolve, reject) {
    doc.on('end', function () {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}

module.exports = {
  generarPdfOrden,
  tituloDocumento
};
