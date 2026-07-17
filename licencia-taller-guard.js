/**
 * Redirige a activar-licencia.html si no hay licencia válida (servidor o caché local).
 */
(function () {
    'use strict';

    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('activar-licencia') >= 0) return;
    if (path.indexOf('herramientas-vendedor') >= 0) return;

    function redirigir() {
        var ret = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace('/activar-licencia.html?return=' + ret);
    }

    function apiUrl() {
        if (typeof TallerAPI !== 'undefined' && TallerAPI.getLicenciaEstadoUrl) {
            return TallerAPI.getLicenciaEstadoUrl();
        }
        if (window.location.protocol === 'file:') {
            var ip = 'localhost';
            try {
                ip = (localStorage.getItem('sanmy_taller_server_ip') || 'localhost').trim() || 'localhost';
            } catch (e) { /* ignore */ }
            return 'http://' + ip + ':3020/api/licencia/estado';
        }
        return '/api/licencia/estado';
    }

    function verificarLocal() {
        if (typeof SanmyLicencia === 'undefined') {
            return Promise.resolve(false);
        }
        var info = null;
        try {
            info = JSON.parse(localStorage.getItem('sanmy_licencia_info') || 'null');
            if (!info || !info.clave) {
                info = JSON.parse(localStorage.getItem('sanmy_taller_licencia_info') || 'null');
            }
        } catch (e) {
            return Promise.resolve(false);
        }
        if (!info || !info.clave) {
            return Promise.resolve(false);
        }
        return SanmyLicencia.detectarIdEquipo().then(function (id) {
            var r = SanmyLicencia.validar(info.clave, id);
            if (r.valida) {
                SanmyLicencia.guardarLicenciaLocal(r);
            }
            return r.valida;
        });
    }

    function manejarSinLicencia() {
        verificarLocal().then(function (ok) {
            if (!ok) redirigir();
        });
    }

    fetch(apiUrl())
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data && data.valida) {
                if (data.clave) {
                    var payload = JSON.stringify(data);
                    localStorage.setItem('sanmy_licencia_info', payload);
                    localStorage.setItem('sanmy_taller_licencia_info', payload);
                }
                return;
            }
            manejarSinLicencia();
        })
        .catch(function () {
            manejarSinLicencia();
        });
})();
