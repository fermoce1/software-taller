/**
 * SANMY — Motor de licencias universal (TPV, Taller, Conta…)
 * Formato: SANMY-YYYYMMDD-CCCC-MMMM-SSSS · HMAC-SHA256 + PCID
 */
const SanmyLicencia = (function () {
    'use strict';

    const CFG = {
        PERMITIR_PRUEBA_GRATIS: false,
        DIAS_PRUEBA: 15,
        REQUIERE_ID_EQUIPO: true,
        CLAVE_SECRETA: ['Sanmy', 'TPV', '_', 'Tecnosur', '_', '2026', '_', 'SK', 'v1'].join(''),
        FECHA_PERPETUA: '99991231',
        STORAGE_ID_EQUIPO: 'sanmy_id_equipo',
        STORAGE_LICENCIA_INFO: 'sanmy_licencia_info'
    };

    const CFG_LEGACY_TALLER = {
        CLAVE_SECRETA: ['Sanmy', 'Taller', '_', 'Tecnosur', '_', '2026', '_', 'SK', 'v1'].join(''),
        PREFIJO_FIRMA: 'SANMYT',
        FORMATO: /^SANMYT-(\d{8})-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/
    };

    const FORMATO = /^SANMY-(\d{8})-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/;

    function obtenerClaveSecreta() {
        return CFG.CLAVE_SECRETA;
    }

    function permitirPruebaGratis() {
        return CFG.PERMITIR_PRUEBA_GRATIS;
    }

    function requiereIdEquipo() {
        return CFG.REQUIERE_ID_EQUIPO;
    }

    function sha256(m) {
        const K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        const rotr = (n, x) => (x >>> n) | (x << (32 - n));
        const ch = (x, y, z) => (x & y) ^ (~x & z);
        const maj = (x, y, z) => (x & y) ^ (x & z) ^ (y & z);
        const s0 = x => rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
        const s1 = x => rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
        const g0 = x => rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
        const g1 = x => rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);

        let bytes = new TextEncoder().encode(m);
        const bitLen = bytes.length * 8;
        bytes = new Uint8Array([...bytes, 0x80]);
        while ((bytes.length % 64) !== 56) bytes = new Uint8Array([...bytes, 0]);
        const dv = new DataView(new ArrayBuffer(8));
        dv.setUint32(0, Math.floor(bitLen / 0x100000000));
        dv.setUint32(4, bitLen);
        bytes = new Uint8Array([...bytes, ...new Uint8Array(dv.buffer)]);

        let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

        for (let i = 0; i < bytes.length; i += 64) {
            const w = new Array(64);
            for (let t = 0; t < 16; t++) {
                w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
            }
            for (let t = 16; t < 64; t++) w[t] = (g1(w[t - 2]) + w[t - 7] + g0(w[t - 15]) + w[t - 16]) >>> 0;
            let [a, b, c, d, e, f, g, h0] = h;
            for (let t = 0; t < 64; t++) {
                const t1 = (h0 + s1(e) + ch(e, f, g) + K[t] + w[t]) >>> 0;
                const t2 = (s0(a) + maj(a, b, c)) >>> 0;
                h0 = g; g = f; f = e; e = (d + t1) >>> 0;
                d = c; c = b; b = a; a = (t1 + t2) >>> 0;
            }
            h = [a + h[0], b + h[1], c + h[2], d + h[3], e + h[4], f + h[5], g + h[6], h0 + h[7]].map(x => x >>> 0);
        }
        return h.map(x => x.toString(16).padStart(8, '0')).join('');
    }

    function hmacSha256(key, message) {
        const blockSize = 64;
        let keyBytes = new TextEncoder().encode(key);
        if (keyBytes.length > blockSize) {
            const hash = sha256(key);
            keyBytes = new Uint8Array(hash.match(/.{2}/g).map(b => parseInt(b, 16)));
        }
        if (keyBytes.length < blockSize) {
            keyBytes = new Uint8Array([...keyBytes, ...new Array(blockSize - keyBytes.length).fill(0)]);
        }
        const oKey = keyBytes.map(b => b ^ 0x5c);
        const iKey = keyBytes.map(b => b ^ 0x36);
        const inner = sha256(String.fromCharCode(...iKey) + message);
        const innerBytes = new Uint8Array(inner.match(/.{2}/g).map(b => parseInt(b, 16)));
        return sha256(String.fromCharCode(...oKey) + String.fromCharCode(...innerBytes));
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

        const lineas = String(texto).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const linea of lineas) {
            const etiqueta = linea.match(/(?:PCID|ID|EQUIPO|SERIAL|CODIGO|CODE|LICENSE|LICENCIA|M[AÁ]QUINA|PROGRAMA)[:\s=-]*([A-Z0-9-]{4,})/i);
            if (etiqueta) return normalizarIdEquipo(etiqueta[1]);
            if (/^[0-9A-F]{4}(-[0-9A-F]{4}){3,}$/i.test(linea)) return normalizarIdEquipo(linea);
            if (/^[A-Z0-9-]{8,}$/i.test(linea)) return normalizarIdEquipo(linea);
        }
        return normalizarIdEquipo(lineas[lineas.length - 1] || '');
    }

    function formatearCodigoPCID(idNorm) {
        if (!idNorm || idNorm.length !== 32) return idNorm || '';
        return idNorm.match(/.{1,4}/g).join('-');
    }

    function codigoEquipoConClave(idEquipo, claveSecreta) {
        const idNorm = normalizarIdEquipo(idEquipo);
        if (!idNorm) return 'XXXX';
        return hmacSha256(claveSecreta, 'EQ|' + idNorm).substring(0, 4).toUpperCase();
    }

    function codigoEquipoEnLicencia(idEquipo) {
        return codigoEquipoConClave(idEquipo, obtenerClaveSecreta());
    }

    function calcularFirmaConPrefijo(prefijoFirma, claveSecreta, fechaExpiracion, codigoCliente, tipo, idEquipo) {
        const idNorm = normalizarIdEquipo(idEquipo);
        const mensaje = `${prefijoFirma}|${fechaExpiracion}|${codigoCliente}|${tipo}|${idNorm}`;
        return hmacSha256(claveSecreta, mensaje).substring(0, 4).toUpperCase();
    }

    function calcularFirma(fechaExpiracion, codigoCliente, tipo, idEquipo) {
        return calcularFirmaConPrefijo('SANMY', CFG.CLAVE_SECRETA, fechaExpiracion, codigoCliente, tipo, idEquipo);
    }

    function normalizarCodigoCliente(codigo) {
        return String(codigo || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .substring(0, 4)
            .padEnd(4, 'X');
    }

    function codigoDesdeNombre(nombre) {
        const limpio = String(nombre || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (limpio.length >= 4) return limpio.substring(0, 4);
        let hash = 0;
        const s = limpio || 'SANMY';
        for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
        const base = Math.abs(hash).toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '');
        return (base + 'SANM').substring(0, 4);
    }

    function fechaYYYYMMDD(fecha) {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    }

    function parsearFechaYYYYMMDD(str) {
        const y = parseInt(str.substring(0, 4), 10);
        const m = parseInt(str.substring(4, 6), 10) - 1;
        const d = parseInt(str.substring(6, 8), 10);
        return new Date(y, m, d, 23, 59, 59);
    }

    function guardarIdEquipoLocal(idEquipo) {
        const idNorm = normalizarIdEquipo(idEquipo);
        if (idNorm) {
            localStorage.setItem(CFG.STORAGE_ID_EQUIPO, idNorm);
        }
        return idNorm;
    }

    function obtenerIdEquipoLocal() {
        return localStorage.getItem(CFG.STORAGE_ID_EQUIPO) || '';
    }

    function guardarLicenciaLocal(resultado) {
        if (!resultado || !resultado.valida) return;
        const payload = JSON.stringify({
            clave: resultado.clave,
            codigoCliente: resultado.codigoCliente,
            tipo: resultado.tipo,
            fechaExpiracion: resultado.fechaExpiracion,
            fechaExpiracionISO: resultado.fechaExpiracionISO,
            idEquipo: resultado.idEquipo
        });
        localStorage.setItem(CFG.STORAGE_LICENCIA_INFO, payload);
        try {
            localStorage.setItem('sanmy_taller_licencia_info', payload);
        } catch (e) { /* ignore */ }
    }

    function leerIdEquipoDesdeUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const desdeQuery = params.get('equipo') || params.get('id');
            if (desdeQuery) return guardarIdEquipoLocal(desdeQuery);

            const hash = window.location.hash.replace(/^#/, '');
            if (hash.startsWith('equipo=')) {
                return guardarIdEquipoLocal(decodeURIComponent(hash.substring(7)));
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    async function cargarIdEquipoDesdeArchivo() {
        const rutas = ['id_equipo.txt', 'ID.txt', 'id.txt'];
        for (const ruta of rutas) {
            try {
                const resp = await fetch(ruta + '?t=' + Date.now());
                if (!resp.ok) continue;
                const texto = await resp.text();
                const id = extraerIdDesdeTextoGetID(texto);
                if (id) return guardarIdEquipoLocal(id);
            } catch (e) { /* file:// puede bloquear fetch */ }
        }
        return '';
    }

    async function detectarIdEquipo() {
        let id = leerIdEquipoDesdeUrl();
        if (id) return id;

        id = obtenerIdEquipoLocal();
        if (id) return id;

        id = await cargarIdEquipoDesdeArchivo();
        return id || '';
    }

    function generar(opciones) {
        const nombreCliente = String(opciones.nombreCliente || '').trim();
        const codigoCliente = normalizarCodigoCliente(opciones.codigoCliente || codigoDesdeNombre(nombreCliente));
        const idEquipo = normalizarIdEquipo(opciones.idEquipo);

        if (CFG.REQUIERE_ID_EQUIPO && !idEquipo) {
            throw new Error('Debe pegar el CODE de PCID del cliente.');
        }

        let fechaExpiracion;
        let tipoFirma;

        if (opciones.tipo === 'perpetua') {
            fechaExpiracion = CFG.FECHA_PERPETUA;
            tipoFirma = 'P';
        } else if (opciones.tipo === 'prueba') {
            const f = new Date();
            f.setDate(f.getDate() + (opciones.dias || CFG.DIAS_PRUEBA));
            fechaExpiracion = fechaYYYYMMDD(f);
            tipoFirma = 'T';
        } else if (opciones.fechaExpiracion) {
            fechaExpiracion = String(opciones.fechaExpiracion).replace(/-/g, '');
            tipoFirma = fechaExpiracion === CFG.FECHA_PERPETUA ? 'P' : 'A';
        } else {
            const f = new Date();
            f.setFullYear(f.getFullYear() + 1);
            fechaExpiracion = fechaYYYYMMDD(f);
            tipoFirma = 'A';
        }

        const codigoEquipo = codigoEquipoEnLicencia(idEquipo);
        const firma = calcularFirma(fechaExpiracion, codigoCliente, tipoFirma, idEquipo);
        const clave = `SANMY-${fechaExpiracion}-${codigoCliente}-${codigoEquipo}-${firma}`;

        return {
            clave,
            nombreCliente,
            codigoCliente,
            idEquipo,
            codigoEquipo,
            fechaExpiracion,
            fechaExpiracionISO: parsearFechaYYYYMMDD(fechaExpiracion).toISOString(),
            tipo: tipoFirma === 'P' ? 'perpetua' : (tipoFirma === 'T' ? 'trial' : 'anual'),
            creadaEn: new Date().toISOString()
        };
    }

    function validarConReglas(clave, idEquipoActual, reglas) {
        const match = clave.match(reglas.FORMATO);
        if (!match) {
            return { valida: false, error: reglas.errorFormato };
        }

        const fechaExpiracion = match[1];
        const codigoCliente = match[2];
        const codigoEquipoLicencia = match[3];
        const firmaIngresada = match[4];

        const idNorm = normalizarIdEquipo(idEquipoActual || obtenerIdEquipoLocal());
        if (CFG.REQUIERE_ID_EQUIPO && !idNorm) {
            return { valida: false, error: 'No se detectó el CODE de PCID. Ejecute OBTENER-ID-EQUIPO.bat y pegue el CODE.' };
        }

        if (codigoEquipoConClave(idNorm, reglas.CLAVE_SECRETA) !== codigoEquipoLicencia) {
            return { valida: false, error: 'Esta licencia no corresponde a este equipo (ID distinto).' };
        }

        let tipo = 'anual';
        let firmaValida = false;

        if (fechaExpiracion === CFG.FECHA_PERPETUA) {
            firmaValida = firmaIngresada === calcularFirmaConPrefijo(reglas.PREFIJO_FIRMA, reglas.CLAVE_SECRETA, fechaExpiracion, codigoCliente, 'P', idNorm);
            tipo = 'perpetua';
        } else {
            const esTrial = firmaIngresada === calcularFirmaConPrefijo(reglas.PREFIJO_FIRMA, reglas.CLAVE_SECRETA, fechaExpiracion, codigoCliente, 'T', idNorm);
            const esAnual = firmaIngresada === calcularFirmaConPrefijo(reglas.PREFIJO_FIRMA, reglas.CLAVE_SECRETA, fechaExpiracion, codigoCliente, 'A', idNorm);
            if (esTrial) { firmaValida = true; tipo = 'trial'; }
            else if (esAnual) { firmaValida = true; tipo = 'anual'; }
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

    function validar(claveRaw, idEquipoActual) {
        const clave = String(claveRaw || '').trim().toUpperCase();
        if (clave.indexOf('SANMYT-') === 0) {
            return validarConReglas(clave, idEquipoActual, {
                FORMATO: CFG_LEGACY_TALLER.FORMATO,
                CLAVE_SECRETA: CFG_LEGACY_TALLER.CLAVE_SECRETA,
                PREFIJO_FIRMA: CFG_LEGACY_TALLER.PREFIJO_FIRMA,
                errorFormato: 'Formato legacy SANMYT. Use una licencia SANMY- nueva del generador universal.'
            });
        }
        return validarConReglas(clave, idEquipoActual, {
            FORMATO: FORMATO,
            CLAVE_SECRETA: CFG.CLAVE_SECRETA,
            PREFIJO_FIRMA: 'SANMY',
            errorFormato: 'Formato inválido. Use: SANMY-YYYYMMDD-CCCC-MMMM-SSSS'
        });
    }

    function generarClavePruebaInterna(idEquipo) {
        if (!CFG.PERMITIR_PRUEBA_GRATIS) return null;
        return generar({ tipo: 'prueba', nombreCliente: 'PRUEBA', codigoCliente: 'TEST', idEquipo: idEquipo || 'PRUEBA000' });
    }

    return {
        CFG,
        generar,
        validar,
        permitirPruebaGratis,
        requiereIdEquipo,
        generarClavePruebaInterna,
        codigoDesdeNombre,
        normalizarCodigoCliente,
        normalizarIdEquipo,
        extraerIdDesdeTextoGetID,
        extraerCodigoPCID,
        formatearCodigoPCID,
        codigoEquipoEnLicencia,
        detectarIdEquipo,
        cargarIdEquipoDesdeArchivo,
        guardarIdEquipoLocal,
        obtenerIdEquipoLocal,
        guardarLicenciaLocal,
        fechaYYYYMMDD
    };
})();
