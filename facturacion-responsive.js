/* ==========================================================================
   FACTURACIÓN RESPONSIVE — Lógica de la pantalla
   Este archivo es autónomo (no requiere el servidor Node encendido) para que
   puedas revisar el diseño abriendo el HTML con doble clic. Los datos de
   clientes de ejemplo están al inicio, en CLIENTES_DEMO: cuando conectes
   este módulo a tu backend real, solo tienes que cambiar las funciones
   marcadas con "// CONECTAR BACKEND AQUÍ" por un fetch() a tu API.
   ========================================================================== */

const $ = (id) => document.getElementById(id);

/* ---------- Datos de ejemplo (bórralos cuando conectes tu API real) ---------- */
const CLIENTES_DEMO = [
    { id: 1, nombre: 'Juan García Rojas', telefono: '8888-1234', email: 'juan@correo.com',
      cedula: '1-2345-6789', placa: 'BCD-123', marca: 'Toyota', modelo: 'Corolla 2019' },
    { id: 2, nombre: 'María Fernández Solís', telefono: '7777-5678', email: 'maria@correo.com',
      cedula: '2-3456-7890', placa: 'CFH-456', marca: 'Hyundai', modelo: 'Tucson 2021' }
];
const PRODUCTOS_DEMO = [
    { id: 1, nombre: 'Filtro de aceite', precio: 6500 },
    { id: 2, nombre: 'Pastillas de freno (juego)', precio: 24000 },
    { id: 3, nombre: 'Aceite motor 5W30 (litro)', precio: 8500 }
];

/* ---------- Estado de la orden actual ---------- */
let lineasActuales = [];
let clienteActual = null;
let ordenFacturada = false;
let tipoDocActual = 'orden';

/* ---------- Utilidades ---------- */
function formatoColones(n) {
    return '₡' + Math.round(n).toLocaleString('es-CR');
}

function toast(mensaje) {
    const el = $('toast');
    el.textContent = mensaje;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2800);
}

/* ---------- Render de líneas y totales ---------- */
function renderLineas() {
    const tbody = $('tbody-lineas');
    if (!lineasActuales.length) {
        tbody.innerHTML = '<tr class="fila-vacia"><td colspan="6">Sin líneas — añada un servicio, repuesto o producto libre</td></tr>';
        actualizarTotales();
        return;
    }
    tbody.innerHTML = lineasActuales.map((l, i) => {
        const subtotal = l.cantidad * l.precio;
        return `<tr>
            <td data-label="Item">${l.descripcion}</td>
            <td data-label="Cant." class="num">${l.cantidad}</td>
            <td data-label="Precio" class="num">${formatoColones(l.precio)}</td>
            <td data-label="IVA %" class="num">${(l.iva * 100).toFixed(0)}%</td>
            <td data-label="Subtotal" class="num">${formatoColones(subtotal)}</td>
            <td data-label="" class="acc">
                ${ordenFacturada ? '' : `<button type="button" class="btn-quitar-linea" data-idx="${i}" title="Quitar">✕</button>`}
            </td>
        </tr>`;
    }).join('');
    actualizarTotales();
}

function actualizarTotales() {
    let subtotal = 0, iva = 0;
    lineasActuales.forEach(l => {
        const st = l.cantidad * l.precio;
        subtotal += st;
        iva += st * l.iva;
    });
    $('t-sub').textContent = formatoColones(subtotal);
    $('t-iva').textContent = formatoColones(iva);
    $('t-total').textContent = formatoColones(subtotal + iva);
    $('txt-cant-lineas').textContent = lineasActuales.length + (lineasActuales.length === 1 ? ' línea' : ' líneas');
}

/* ---------- Modal: añadir línea ---------- */
let tipoLineaActual = 'servicio';
const TITULOS_MODAL = { servicio: '🔧 Añadir servicio', repuesto: '📦 Añadir repuesto', libre: '✏️ Producto libre' };

function abrirModalLinea(tipo) {
    if (ordenFacturada) { toast('Esta orden ya fue facturada'); return; }
    tipoLineaActual = tipo;
    $('modal-linea-titulo').textContent = TITULOS_MODAL[tipo] || 'Añadir línea';
    $('m-desc').value = '';
    $('m-cant').value = '1';
    $('m-precio').value = '0';
    $('campo-inv').hidden = tipo !== 'repuesto';

    if (tipo === 'repuesto') {
        // CONECTAR BACKEND AQUÍ: reemplazar PRODUCTOS_DEMO por tu inventario real
        const sel = $('m-inventario');
        sel.innerHTML = '<option value="">— Seleccionar repuesto —</option>' +
            PRODUCTOS_DEMO.map(p => `<option value="${p.id}" data-precio="${p.precio}" data-nombre="${p.nombre}">${p.nombre} · ${formatoColones(p.precio)}</option>`).join('');
        sel.onchange = () => {
            const opt = sel.selectedOptions[0];
            if (opt && opt.value) {
                $('m-desc').value = opt.dataset.nombre;
                $('m-precio').value = opt.dataset.precio;
            }
        };
    }
    $('modal-linea').hidden = false;
}

function cerrarModalLinea() { $('modal-linea').hidden = true; }

function confirmarModalLinea() {
    const desc = $('m-desc').value.trim();
    if (!desc) { toast('Escriba una descripción'); return; }
    const cantidad = parseFloat($('m-cant').value) || 1;
    const precio = parseFloat($('m-precio').value) || 0;
    lineasActuales.push({ descripcion: desc, cantidad, precio, iva: 0.13 });
    renderLineas();
    cerrarModalLinea();
}

/* ---------- Búsqueda de cliente ---------- */
function poblarCliente(c) {
    clienteActual = c;
    $('c-nombre').value = c.nombre || '';
    $('c-tel').value = c.telefono || '';
    $('c-email').value = c.email || '';
    $('c-cedula').value = c.cedula || '';
    $('c-placa').value = c.placa || '';
    $('c-marca').value = c.marca || '';
    $('c-modelo').value = c.modelo || '';
    actualizarBotonEnvio();
}

function buscarClientes(texto) {
    // CONECTAR BACKEND AQUÍ: cambiar por fetch(API_URL + '/clientes?buscar=' + texto)
    const t = texto.trim().toLowerCase();
    if (!t) return [];
    return CLIENTES_DEMO.filter(c =>
        c.nombre.toLowerCase().includes(t) || (c.placa || '').toLowerCase().includes(t)
    );
}

function iniciarBuscadorCliente() {
    const input = $('buscar-caja');
    const caja = $('sugerencias-caja');
    let timer = null;

    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const resultados = buscarClientes(input.value);
            if (!resultados.length) { caja.hidden = true; return; }
            caja.innerHTML = resultados.map(c =>
                `<div class="sug-item" data-id="${c.id}" style="padding:.6em .9em;cursor:pointer;border-bottom:1px solid #f1f5f9;">
                    <strong>${c.nombre}</strong> · ${c.telefono}${c.placa ? ' · <em>' + c.placa + '</em>' : ''}
                </div>`).join('');
            caja.hidden = false;
        }, 150);
    });

    caja.addEventListener('click', (e) => {
        const item = e.target.closest('.sug-item');
        if (!item) return;
        const cliente = CLIENTES_DEMO.find(c => String(c.id) === item.dataset.id);
        if (cliente) poblarCliente(cliente);
        caja.hidden = true;
        input.value = '';
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const resultados = buscarClientes(input.value);
            if (resultados.length === 1) { poblarCliente(resultados[0]); input.value = ''; caja.hidden = true; }
            else if (!resultados.length) toast('Cliente no encontrado');
        }
    });

    document.addEventListener('click', (e) => {
        if (!caja.contains(e.target) && e.target !== input) caja.hidden = true;
    });
}

/* ---------- Forma de pago ---------- */
function renderMetodosPago() {
    const cont = $('pagos-container');
    ['Efectivo', 'Tarjeta', 'SINPE Móvil'].forEach((m, i) => {
        const label = document.createElement('label');
        label.className = 'chip';
        label.innerHTML = `<input type="radio" name="metodo-pago" value="${m}" ${i === 0 ? 'checked' : ''}> ${m}`;
        cont.appendChild(label);
    });
}

/* ---------- Tipo de documento ---------- */
function iniciarTipoDocumento() {
    document.querySelectorAll('.chip-doc').forEach(btn => {
        btn.addEventListener('click', () => {
            tipoDocActual = btn.dataset.tipo;
            document.querySelectorAll('.chip-doc').forEach(b => b.classList.toggle('activo', b === btn));
        });
    });
}

/* ---------- Factura electrónica ---------- */
function iniciarToggleFE() {
    $('chk-fe').addEventListener('change', (e) => {
        $('fe-campos').hidden = !e.target.checked;
    });
}

/* ---------- WhatsApp ---------- */
function actualizarBotonEnvio() {
    const tel = ($('c-tel').value || '').trim();
    $('btn-enviar-cliente').disabled = !tel;
}

function enviarPorWhatsapp() {
    const tel = ($('c-tel').value || '').replace(/\D/g, '');
    if (tel.length < 8) { toast('Teléfono inválido'); return; }
    const msg = encodeURIComponent('🔧 Sanmy Taller - Aquí tiene su documento.');
    window.open('https://wa.me/506' + tel + '?text=' + msg, '_blank');
}

/* ---------- Generar factura ---------- */
function generarFactura() {
    if (!lineasActuales.length) { toast('Agregue al menos una línea a la orden'); return; }
    if (!$('c-nombre').value.trim()) { toast('Busque y seleccione un cliente'); return; }

    // CONECTAR BACKEND AQUÍ: reemplazar por un fetch POST a tu API de órdenes
    ordenFacturada = true;
    $('txt-num-orden').textContent = '#' + Math.floor(1000 + Math.random() * 9000);
    $('btn-factura').disabled = true;
    $('btn-reimprimir').hidden = false;
    bloquearFormulario(true);
    renderLineas();
    toast('Factura generada exitosamente');
}

function bloquearFormulario(bloqueado) {
    ['c-nombre', 'c-tel', 'c-email', 'c-cedula', 'c-placa', 'c-marca', 'c-modelo'].forEach(id => {
        $(id).readOnly = true; // siempre de solo lectura; se llenan por búsqueda
    });
    $('buscar-caja').disabled = bloqueado;
    ['btn-add-serv', 'btn-add-rep', 'btn-add-libre'].forEach(id => { $(id).disabled = bloqueado; });
    $('aviso-cerrada').hidden = !bloqueado;
}

/* ---------- Nueva orden ---------- */
function nuevaOrden() {
    lineasActuales = [];
    clienteActual = null;
    ordenFacturada = false;
    ['c-nombre', 'c-tel', 'c-email', 'c-cedula', 'c-placa', 'c-marca', 'c-modelo'].forEach(id => { $(id).value = ''; });
    $('txt-num-orden').textContent = '—';
    $('btn-factura').disabled = false;
    $('btn-reimprimir').hidden = true;
    bloquearFormulario(false);
    renderLineas();
    actualizarBotonEnvio();
    $('buscar-caja').focus();
}

/* ---------- Salir ---------- */
function salir() {
    const hayPendiente = lineasActuales.length > 0 && !ordenFacturada;
    if (hayPendiente && !confirm('Hay una orden sin facturar. ¿Desea salir de todos modos?')) return;
    // Cambia esta ruta por la de tu pantalla de inicio real (por ejemplo /abrir.html)
    window.location.href = 'abrir.html';
}

/* ---------- Tabs móvil ---------- */
function iniciarTabsMovil() {
    document.querySelectorAll('.tab-movil').forEach(tab => {
        tab.addEventListener('click', () => {
            const panel = tab.dataset.panel;
            document.querySelectorAll('.tab-movil').forEach(t => t.classList.toggle('activo', t === tab));
            document.querySelectorAll('.panel-movil').forEach(p => p.classList.toggle('activo', p.dataset.panel === panel));
        });
    });
}

/* ---------- Atajos de teclado F2 / F3 / F4 (F5 se deja libre para refrescar) ---------- */
function iniciarAtajosTeclado() {
    document.addEventListener('keydown', (e) => {
        if (!$('modal-linea').hidden) return;
        if (e.key === 'F2') { e.preventDefault(); abrirModalLinea('servicio'); }
        else if (e.key === 'F3') { e.preventDefault(); abrirModalLinea('repuesto'); }
        else if (e.key === 'F4') { e.preventDefault(); abrirModalLinea('libre'); }
    });
}

/* ---------- Conexión de eventos ---------- */
function iniciarEventos() {
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => abrirModalLinea(btn.dataset.tipo));
    });

    $('tbody-lineas').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-quitar-linea');
        if (!btn) return;
        lineasActuales.splice(Number(btn.dataset.idx), 1);
        renderLineas();
    });

    $('btn-cancelar-linea').addEventListener('click', cerrarModalLinea);
    $('btn-confirmar-linea').addEventListener('click', confirmarModalLinea);
    $('modal-linea').addEventListener('click', (e) => { if (e.target.id === 'modal-linea') cerrarModalLinea(); });

    $('c-tel').addEventListener('input', actualizarBotonEnvio);
    $('btn-enviar-cliente').addEventListener('click', enviarPorWhatsapp);
    $('btn-factura').addEventListener('click', generarFactura);
    $('btn-nueva-orden').addEventListener('click', nuevaOrden);
    $('btn-salir').addEventListener('click', salir);
}

/* ---------- Arranque ---------- */
document.addEventListener('DOMContentLoaded', () => {
    iniciarBuscadorCliente();
    renderMetodosPago();
    iniciarTipoDocumento();
    iniciarToggleFE();
    iniciarTabsMovil();
    iniciarAtajosTeclado();
    iniciarEventos();
    nuevaOrden();
});
