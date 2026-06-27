/**
 * Adaptadores de payload para proveedores de factura electrónica (Costa Rica).
 * Modo "generico": envía el JSON estándar de Sanmy Taller.
 * Modo "almendro": mapea al formato voucher de Almendro (fe.almendro.cr).
 */

const PROVEEDORES = {
  pendiente: { label: 'Sin proveedor (solo simulación)', url: '', sandbox: '' },
  generico: {
    label: 'API genérica (JSON Sanmy)',
    url: 'https://api.su-proveedor.com/facturas',
    sandbox: ''
  },
  almendro: {
    label: 'Almendro (fe.almendro.cr)',
    url: 'https://fe.almendro.cr/api/v1/public/vouchers',
    sandbox: 'https://sandbox.fe.almendro.cr/api/v1/public/vouchers'
  },
  factun: {
    label: 'Factun (factun.com/cr)',
    url: 'https://api.factun.com/v1/comprobantes',
    sandbox: ''
  }
};

function getProveedorInfo(id) {
  return PROVEEDORES[id] || PROVEEDORES.generico;
}

function resolveApiUrl(cfg) {
  const sandbox = cfg.fe_sandbox === '1' || cfg.fe_sandbox === true;
  if (sandbox && cfg.fe_api_url_sandbox) {
    return String(cfg.fe_api_url_sandbox).replace(/\/$/, '');
  }
  const info = getProveedorInfo(cfg.fe_proveedor);
  if (sandbox && info.sandbox) {
    return info.sandbox;
  }
  const url = (cfg.fe_api_url || '').replace(/\/$/, '');
  if (!url && info.url && cfg.fe_proveedor !== 'pendiente' && cfg.fe_proveedor !== 'generico') {
    return info.url;
  }
  return url;
}

function limpiarId(id) {
  return String(id || '').replace(/\D/g, '');
}

function adaptAlmendro(payload) {
  return {
    document_type: 'invoice',
    sale_condition: payload.condicion_venta || '01',
    payment_method: payload.medio_pago || '01',
    consecutive: payload.consecutivo,
    external_reference: payload.referencia_interna,
    issuer: {
      identification_type: '02',
      identification: limpiarId(payload.emisor && payload.emisor.identificacion),
      name: (payload.emisor && payload.emisor.nombre) || '',
      email: (payload.emisor && payload.emisor.email) || '',
      economic_activity: (payload.emisor && payload.emisor.actividad_economica) || '',
      branch: (payload.emisor && payload.emisor.sucursal) || '001',
      terminal: (payload.emisor && payload.emisor.terminal) || '001'
    },
    receiver: {
      identification_type: (payload.receptor && payload.receptor.tipo_identificacion) || '01',
      identification: limpiarId(payload.receptor && payload.receptor.identificacion),
      name: (payload.receptor && payload.receptor.nombre) || '',
      email: (payload.receptor && payload.receptor.email) || ''
    },
    lines: (payload.lineas || []).map(function (l) {
      return {
        line_number: l.numero_linea,
        cabys_code: l.codigo_cabys,
        description: l.descripcion,
        quantity: l.cantidad,
        unit: l.unidad_medida || 'Unid',
        unit_price: l.precio_unitario,
        subtotal: l.subtotal,
        tax: l.impuesto,
        tax_rate_code: l.tarifa_iva,
        total: l.total_linea
      };
    }),
    totals: payload.totales || {},
    metadata: { source: 'sanmy-taller', orden_id: payload.orden_id, abono_id: payload.abono_id }
  };
}

function adaptPayload(cfg, payload) {
  const prov = cfg.fe_proveedor || 'pendiente';
  if (prov === 'almendro') {
    return adaptAlmendro(payload);
  }
  return payload;
}

module.exports = {
  PROVEEDORES,
  getProveedorInfo,
  resolveApiUrl,
  adaptPayload
};
