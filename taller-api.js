/**
 * Cliente API Sanmy Taller — sistema independiente (puerto 3020)
 */
const TallerAPI = (function () {
  const DEFAULT_PORT = 3020;
  const SERVER_IP_KEY = 'sanmy_taller_server_ip';

  function getStoredServerIp() {
    try {
      return (localStorage.getItem(SERVER_IP_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function getBaseUrl() {
    if (window.TALLER_API_URL) {
      return window.TALLER_API_URL.replace(/\/$/, '');
    }
    const storedIp = getStoredServerIp();
    if (window.location.protocol === 'file:') {
      if (storedIp) {
        return 'http://' + storedIp + ':' + DEFAULT_PORT + '/api';
      }
      return 'http://localhost:' + DEFAULT_PORT + '/api';
    }
    if (
      window.location.port === String(DEFAULT_PORT) ||
      window.location.hostname !== 'localhost'
    ) {
      return '/api';
    }
    return 'http://localhost:' + DEFAULT_PORT + '/api';
  }

  let baseUrl = getBaseUrl();
  let online = false;

  async function request(path, options) {
    options = options || {};
    const url = baseUrl + path;
    const config = {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    };
    const res = await fetch(url, config);
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      let errMsg = data.error || res.statusText || 'Error de API';
      // Si el servidor es viejo y no tiene rutas de empresas, avisamos cómo reiniciarlo
      if (res.status === 404 && path.indexOf('/taller/empresas') >= 0) {
        errMsg =
          'El servidor está desactualizado (falta módulo de empresas). Cierre y vuelva a abrir con INICIAR-SERVIDOR.bat.';
      }
      if (res.status === 404 && path.indexOf('/respaldo/') >= 0) {
        errMsg =
          'El servidor debe reiniciarse para usar respaldos. Cierre Sanmy Taller y ejecute ABRIR-SISTEMA.bat o INICIAR-SERVIDOR.bat.';
      }
      const err = new Error(errMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function checkHealth() {
    try {
      await request('/health');
      online = true;
      return true;
    } catch (e) {
      online = false;
      return false;
    }
  }

  return {
    getBaseUrl: function () {
      return baseUrl;
    },
    isOnline: function () {
      return online;
    },
    getStoredServerIp: getStoredServerIp,
    setStoredServerIp: function (ip) {
      const valor = String(ip || '')
        .trim()
        .replace(/^https?:\/\//, '')
        .split('/')[0];
      try {
        if (valor) {
          localStorage.setItem(SERVER_IP_KEY, valor);
          window.TALLER_API_URL = 'http://' + valor + ':' + DEFAULT_PORT + '/api';
          baseUrl = window.TALLER_API_URL;
        } else {
          localStorage.removeItem(SERVER_IP_KEY);
          delete window.TALLER_API_URL;
          baseUrl = getBaseUrl();
        }
      } catch (e) {
        /* ignore */
      }
    },
    checkHealth: checkHealth,
    getTallerOrdenes: function (params) {
      params = params || {};
      const q = new URLSearchParams();
      if (params.estado) q.set('estado', params.estado);
      if (params.q) q.set('q', params.q);
      if (params.placa) q.set('placa', params.placa);
      if (params.todos) q.set('todos', '1');
      if (params.pendientes) q.set('pendientes', '1');
      if (params.proforma) q.set('proforma', '1');
      const qs = q.toString();
      return request('/taller/ordenes' + (qs ? '?' + qs : ''));
    },
    getTallerOrden: function (id) {
      return request('/taller/ordenes/' + id);
    },
    crearTallerOrden: function (datos) {
      return request('/taller/ordenes', { method: 'POST', body: JSON.stringify(datos) });
    },
    actualizarTallerOrden: function (id, datos) {
      return request('/taller/ordenes/' + id, { method: 'PATCH', body: JSON.stringify(datos) });
    },
    agregarTallerLinea: function (ordenId, datos) {
      return request('/taller/ordenes/' + ordenId + '/lineas', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
    },
    eliminarTallerLinea: function (ordenId, lineaId) {
      return request('/taller/ordenes/' + ordenId + '/lineas/' + lineaId, { method: 'DELETE' });
    },
    agregarTallerFoto: function (ordenId, datos) {
      return request('/taller/ordenes/' + ordenId + '/fotos', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
    },
    cobrarTallerOrden: function (ordenId, datos) {
      return request('/taller/ordenes/' + ordenId + '/cobrar', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
    },
    facturarProforma: function (ordenId, datos) {
      return request('/taller/ordenes/' + ordenId + '/facturar', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
    },
    abonarTallerOrden: function (ordenId, datos) {
      return request('/taller/ordenes/' + ordenId + '/abono', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
    },
    getTallerResumenHoy: function () {
      return request('/taller/resumen-hoy');
    },
    getTallerPendientesCobro: function (tipo) {
      const qs = tipo ? '?tipo=' + encodeURIComponent(tipo) : '';
      return request('/taller/creditos/pendientes' + qs);
    },
    getTallerConfig: function () {
      return request('/taller/config');
    },
    getAccesoConfig: function () {
      return request('/taller/config/acceso');
    },
    getAccesoConfigUrl: function () {
      return getBaseUrl() + '/taller/config/acceso';
    },
    getLicenciaEstadoUrl: function () {
      return getBaseUrl() + '/licencia/estado';
    },
    getLicenciaEstado: function () {
      return request('/licencia/estado');
    },
    activarLicencia: function (datos) {
      return request('/licencia/activar', { method: 'POST', body: JSON.stringify(datos || {}) });
    },
    actualizarTallerConfig: function (datos) {
      return request('/taller/config', { method: 'PATCH', body: JSON.stringify(datos) });
    },
    getMetodosPago: function (todos) {
      var qs = todos ? '?todos=1' : '';
      return request('/taller/metodos-pago' + qs);
    },
    guardarMetodosPago: function (metodos) {
      return request('/taller/metodos-pago', {
        method: 'PUT',
        body: JSON.stringify({ metodos: metodos })
      });
    },
    getEmpresas: function () {
      return request('/taller/empresas');
    },
    getEmpresa: function (id) {
      return request('/taller/empresas/' + id);
    },
    /** Guarda una empresa nueva en el servidor (botón Guardar empresa en modo nueva). */
    crearEmpresa: function (datos) {
      return request('/taller/empresas', { method: 'POST', body: JSON.stringify(datos) });
    },
    /** Cambia nombre, cédula, modo compartido/aparte de una empresa ya creada. */
    actualizarEmpresa: function (id, datos) {
      return request('/taller/empresas/' + id, { method: 'PATCH', body: JSON.stringify(datos) });
    },
    /** Pone esta empresa como la activa (la que usa el taller en este momento). */
    activarEmpresa: function (id) {
      return request('/taller/empresas/' + id + '/activar', { method: 'POST', body: '{}' });
    },
    eliminarEmpresa: function (id) {
      return request('/taller/empresas/' + id, { method: 'DELETE' });
    },
    subirLogoEmpresa: function (id, imagenBase64, mime) {
      return request('/taller/empresas/' + id + '/logo', {
        method: 'POST',
        body: JSON.stringify({ imagen: imagenBase64, mime: mime || '' })
      });
    },
    eliminarLogoEmpresa: function (id) {
      return request('/taller/empresas/' + id + '/logo', { method: 'DELETE' });
    },
    buscarTallerVehiculos: function (q) {
      return request('/taller/vehiculos' + (q ? '?q=' + encodeURIComponent(q) : ''));
    },
    buscarTallerVehiculoPlaca: async function (placa) {
      const p = encodeURIComponent(String(placa || '').trim());
      const url = baseUrl + '/taller/vehiculos/placa?placa=' + p;
      const res = await fetch(url);
      const data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data.vehiculo;
    },
    imprimirTallerOrden: function (ordenId, datos) {
      datos = datos || {};
      return request('/taller/ordenes/' + ordenId + '/imprimir', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
    },
    pdfOrdenUrl: function (ordenId, tipo) {
      var t = encodeURIComponent(tipo || 'orden');
      return baseUrl + '/taller/ordenes/' + ordenId + '/pdf?tipo=' + t;
    },
    getWhatsAppOrden: function (ordenId, tipo) {
      var t = encodeURIComponent(tipo || 'orden');
      return request('/taller/ordenes/' + ordenId + '/whatsapp?tipo=' + t);
    },
    getTallerClientes: function (q) {
      return request('/taller/clientes' + (q ? '?q=' + encodeURIComponent(q) : ''));
    },
    getTallerClienteVehiculos: function (id) {
      return request('/taller/clientes/' + id + '/vehiculos');
    },
    crearCliente: function (datos) {
      return request('/taller/clientes', { method: 'POST', body: JSON.stringify(datos) });
    },
    actualizarCliente: function (id, datos) {
      return request('/taller/clientes/' + id, { method: 'PATCH', body: JSON.stringify(datos) });
    },
    getCuentasPagar: function (estado) {
      return request('/taller/cxp' + (estado ? '?estado=' + encodeURIComponent(estado) : ''));
    },
    crearCuentaPagar: function (datos) {
      return request('/taller/cxp', { method: 'POST', body: JSON.stringify(datos) });
    },
    actualizarCuentaPagar: function (id, datos) {
      return request('/taller/cxp/' + id, { method: 'PATCH', body: JSON.stringify(datos) });
    },
    eliminarCuentaPagar: function (id) {
      return request('/taller/cxp/' + id, { method: 'DELETE' });
    },
    getTallerInventario: function (q) {
      return request('/taller/inventario' + (q ? '?q=' + encodeURIComponent(q) : ''));
    },
    crearItemInventario: function (datos) {
      return request('/taller/inventario', { method: 'POST', body: JSON.stringify(datos) });
    },
    actualizarItemInventario: function (id, datos) {
      return request('/taller/inventario/' + id, { method: 'PATCH', body: JSON.stringify(datos) });
    },
    eliminarItemInventario: function (id) {
      return request('/taller/inventario/' + id, { method: 'DELETE' });
    },
    getFeConfig: function () {
      return request('/fe/config');
    },
    saveFeConfig: function (datos) {
      return request('/fe/config', { method: 'PUT', body: JSON.stringify(datos) });
    },
    probarFeConexion: function () {
      return request('/fe/probar', { method: 'POST', body: '{}' });
    },
    getTallerFacturasOrden: function (ordenId) {
      return request('/fe/orden/' + ordenId);
    },
    getGuiaTicoFactura: function (ordenId) {
      return request('/fe/guia-tico/' + ordenId);
    },
    getFeRecientes: function (limit, filtros) {
      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      filtros = filtros || {};
      if (filtros.q) params.set('q', filtros.q);
      if (filtros.estado) params.set('estado', filtros.estado);
      if (filtros.desde) params.set('desde', filtros.desde);
      if (filtros.hasta) params.set('hasta', filtros.hasta);
      if (filtros.tipo) params.set('tipo', filtros.tipo);
      const qs = params.toString();
      return request('/fe/recientes' + (qs ? '?' + qs : ''));
    },
    getFeResumen: function (filtros) {
      const params = new URLSearchParams();
      filtros = filtros || {};
      if (filtros.desde) params.set('desde', filtros.desde);
      if (filtros.hasta) params.set('hasta', filtros.hasta);
      if (filtros.estado) params.set('estado', filtros.estado);
      if (filtros.tipo) params.set('tipo', filtros.tipo);
      const qs = params.toString();
      return request('/fe/resumen' + (qs ? '?' + qs : ''));
    },
    exportFeCsvUrl: function (filtros) {
      filtros = filtros || {};
      const params = new URLSearchParams();
      if (filtros.desde) params.set('desde', filtros.desde);
      if (filtros.hasta) params.set('hasta', filtros.hasta);
      if (filtros.estado) params.set('estado', filtros.estado);
      if (filtros.tipo) params.set('tipo', filtros.tipo);
      if (filtros.q) params.set('q', filtros.q);
      const qs = params.toString();
      return baseUrl + '/fe/export' + (qs ? '?' + qs : '');
    },
    getFeDetalle: function (id) {
      return request('/fe/detalle/' + id);
    },
    validarOrdenFe: function (ordenId) {
      return request('/fe/validar-orden/' + ordenId);
    },
    registrarTicoFactura: function (datos) {
      return request('/fe/tico-registrar', { method: 'POST', body: JSON.stringify(datos || {}) });
    },
    enviarFacturaHacienda: function (id) {
      return request('/fe/' + id + '/enviar', { method: 'POST', body: '{}' });
    },
    getTicketConfig: function () {
      return request('/ticket/config');
    },
    saveTicketConfig: function (datos) {
      return request('/ticket/config', { method: 'PUT', body: JSON.stringify(datos) });
    },
    getTicketPreview: function (tipo, datos) {
      if (datos) {
        return request('/ticket/preview', { method: 'POST', body: JSON.stringify(Object.assign({ tipo: tipo || 'factura' }, datos)) });
      }
      var qs = tipo ? '?tipo=' + encodeURIComponent(tipo) : '';
      return request('/ticket/preview' + qs);
    },
    getImpresoras: function () {
      return request('/impresoras');
    },
    getImpresorasSistema: function () {
      return request('/impresoras/sistema');
    },
    crearImpresora: function (datos) {
      return request('/impresoras', { method: 'POST', body: JSON.stringify(datos) });
    },
    actualizarImpresora: function (id, datos) {
      return request('/impresoras/' + id, { method: 'PUT', body: JSON.stringify(datos) });
    },
    eliminarImpresora: function (id) {
      return request('/impresoras/' + id, { method: 'DELETE' });
    },
    probarImpresora: function (id) {
      return request('/impresoras/' + id + '/probar', { method: 'POST', body: '{}' });
    },
    getUsuarios: function (opts) {
      opts = opts || {};
      const q = new URLSearchParams();
      if (opts.todos) q.set('todos', '1');
      if (opts.q) q.set('q', opts.q);
      const qs = q.toString();
      return request('/usuarios' + (qs ? '?' + qs : ''));
    },
    getUsuario: function (id) {
      return request('/usuarios/' + id);
    },
    crearUsuario: function (datos) {
      return request('/usuarios', { method: 'POST', body: JSON.stringify(datos) });
    },
    actualizarUsuario: function (id, datos) {
      return request('/usuarios/' + id, { method: 'PATCH', body: JSON.stringify(datos) });
    },
    desactivarUsuario: function (id) {
      return request('/usuarios/' + id, { method: 'DELETE' });
    },
    loginUsuario: function (usuarioOrId, password) {
      var body;
      if (typeof usuarioOrId === 'object' && usuarioOrId !== null) {
        body = usuarioOrId;
      } else if (typeof usuarioOrId === 'number' || /^\d+$/.test(String(usuarioOrId || ''))) {
        body = { id: Number(usuarioOrId), password: password || '' };
      } else {
        body = { usuario: usuarioOrId, password: password || '' };
      }
      return request('/usuarios/login', {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    listarRespaldos: function () {
      return request('/respaldo/listar');
    },
    crearRespaldo: function () {
      return request('/respaldo/crear', { method: 'POST', body: '{}' });
    },
    descargarRespaldo: function (nombre) {
      window.location.href = getBaseUrl() + '/respaldo/descargar/' + encodeURIComponent(nombre);
    },
    eliminarRespaldo: function (nombre) {
      return request('/respaldo/' + encodeURIComponent(nombre), { method: 'DELETE' });
    },
    restaurarRespaldo: function (nombre) {
      return request('/respaldo/restaurar/' + encodeURIComponent(nombre), {
        method: 'POST',
        body: '{}'
      });
    },
    restaurarRespaldoArchivo: function (file) {
      return new Promise(function (resolve, reject) {
        if (!file) {
          reject(new Error('Seleccione un archivo .db de respaldo.'));
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          request('/respaldo/restaurar-archivo', {
            method: 'POST',
            body: JSON.stringify({
              nombre: file.name,
              contenido_base64: reader.result
            })
          }).then(resolve).catch(reject);
        };
        reader.onerror = function () {
          reject(new Error('No se pudo leer el archivo.'));
        };
        reader.readAsDataURL(file);
      });
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TallerAPI;
}
