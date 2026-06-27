/**
 * Asistente de ayuda Sanmy Taller — respuestas escritas según la pregunta.
 */
(function (global) {
    var TEMAS = [
        {
            keys: ['factur', 'hacienda', 'electronica', 'electrónica', 'fe ', 'almendro', 'tico', 'tiquete', 'emitir'],
            titulo: 'Cómo facturar',
            texto:
                'Hay <strong>3 formas</strong> de facturar en Sanmy:<br><br>' +
                '<strong>1) Al cobrar una orden</strong><br>' +
                'Orden de trabajo → abra la orden → <strong>💵 Cobrar</strong>. ' +
                'Marque «Emitir factura electrónica» si usa Hacienda CR (nombre y cédula del cliente). ' +
                'Con Almendro configurado en Configuración, puede enviarse automático al confirmar el cobro.<br><br>' +
                '<strong>2) Desde una proforma</strong><br>' +
                'Proformas → elija la proforma → <strong>🧾 Convertir a factura</strong> → revise datos en Facturación → confirme.<br><br>' +
                '<strong>3) Módulo Facturación</strong><br>' +
                'Menú <strong>Facturación</strong> → pestaña «Desde proforma» o historial de facturas emitidas.<br><br>' +
                'Configure el emisor en <a href="/configuracion.html?sec=fe">⚙️ Configuración → Factura electrónica</a>.'
        },
        {
            keys: ['cliente', 'clientes', 'registrar', 'crear cliente', 'cedula', 'cédula', 'telefono', 'teléfono', 'nite'],
            titulo: 'Cómo registrar o llenar un cliente',
            texto:
                '<strong>Opción A — Al crear una orden</strong><br>' +
                'Orden de trabajo → complete <strong>Nombre</strong> y <strong>TLF</strong> en «Datos del Cliente» ' +
                '(NITE/cédula y email si los tiene). Al guardar la orden, el sistema crea o enlaza el cliente automáticamente.<br><br>' +
                '<strong>Opción B — Módulo Clientes</strong><br>' +
                'Menú <strong>Clientes</strong> → botón nuevo → nombre, identificación, teléfono, email y dirección. ' +
                'Desde Inicio también puede usar «Buscar / Crear Nuevo Cliente».<br><br>' +
                '<strong>Tip:</strong> el teléfono con 8 dígitos permite enviar PDF y WhatsApp desde la orden.'
        },
        {
            keys: ['orden', 'trabajo', 'vehiculo', 'vehículo', 'placa', 'matricula', 'matrícula', 'ingreso'],
            titulo: 'Cómo crear una orden de trabajo',
            texto:
                '1. Entre a <strong>Orden de trabajo</strong> (o Inicio → Entrar al taller).<br>' +
                '2. Complete cliente y <strong>matrícula</strong> del vehículo (marca/modelo).<br>' +
                '3. Pulse <strong>💾 Guardar orden</strong>.<br>' +
                '4. Use las pestañas <strong>F5 Productos</strong> (repuestos del inventario) o ' +
                '<strong>F6 Trabajo a realizar</strong> (mano de obra con precio).<br>' +
                '5. Cambie el estado: Ingreso → En revisión → En proceso → Listo.<br>' +
                '6. Cuando termine, <strong>💵 Cobrar</strong> para entregar el vehículo.'
        },
        {
            keys: ['proforma', 'presupuesto', 'cotiz', 'cotización'],
            titulo: 'Proformas y presupuestos',
            texto:
                'Menú <strong>Proformas</strong>:<br>' +
                '1. <strong>➕ Nueva proforma</strong> → datos de cliente y vehículo → Guardar.<br>' +
                '2. Agregue líneas con Productos / Servicios / Producto libre (F5, F6, F7).<br>' +
                '3. Envíe <strong>PDF</strong> o <strong>WhatsApp</strong> al cliente.<br>' +
                '4. Para facturar: <strong>🧾 Convertir a factura</strong> → abre Facturación con los datos cargados.'
        },
        {
            keys: ['cobr', 'pago', 'contado', 'credito', 'crédito', 'apartado', 'saldo', 'pendiente'],
            titulo: 'Cobros y pendientes',
            texto:
                '<strong>Cobrar una orden lista:</strong> abra la orden → <strong>💵 Cobrar</strong> → elija Contado, Apartado o Crédito → método de pago → Confirmar.<br><br>' +
                '<strong>Pendientes de cobro:</strong> Inicio → «Pendientes de Cobro» o Finanzas. ' +
                'Ahí ve apartados y créditos con saldo; puede registrar abonos.<br><br>' +
                'Al cobrar puede imprimir tiquete o emitir factura electrónica según la casilla en el modal.'
        },
        {
            keys: ['invent', 'repuesto', 'stock', 'producto'],
            titulo: 'Inventario de repuestos',
            texto:
                'Menú <strong>Repuestos (Inventario)</strong>:<br>' +
                '• Agregue productos con nombre, código, precio y cantidad en stock.<br>' +
                '• Al agregar un repuesto en una orden (F5), el stock se descuenta automáticamente.<br>' +
                '• Si elimina la línea de la orden, el repuesto vuelve al inventario.'
        },
        {
            keys: ['cambiar empresa', 'otra empresa', 'empresa activa', 'trabajar con', 'multiples empresas', 'múltiples empresas', 'cambio de empresa'],
            titulo: 'Cambiar de empresa',
            texto:
                'En <strong>Inicio</strong>, sección <strong>«Trabajar con»</strong> (debajo del nombre del taller):<br>' +
                '• Haga clic en la empresa que desea usar — la marcada con ✓ es la activa.<br>' +
                '• Cada empresa puede ser <strong>compartida</strong> (mismos clientes e inventario) o <strong>totalmente aparte</strong>.<br>' +
                '• Las órdenes nuevas, tickets, PDF y facturación usarán esa razón social.<br>' +
                '• Para crear o editar empresas y el modo de datos: enlace <strong>➕ Crear o editar empresas</strong> o Configuración → Empresas.'
        },
        {
            keys: ['config', 'impresor', 'impresora', 'red', 'iva', 'empresa', 'empresas', 'razon', 'razón'],
            titulo: 'Configuración del sistema',
            texto:
                'Menú <strong>⚙️ Configuración → Empresas</strong> (o botón en Inicio):<br>' +
                '• En <strong>Inicio</strong>, sección «Trabajar con», elija la empresa activa con un clic.<br>' +
                '• <strong>Modo de datos por empresa:</strong> compartido (clientes e inventario en común), totalmente aparte, o personalizado.<br>' +
                '• Si elige <strong>totalmente aparte</strong>, esa empresa tiene sus propios clientes, repuestos, finanzas, órdenes y facturas.<br>' +
                '• La <strong>empresa activa</strong> se usa en facturación electrónica, tickets, PDF y órdenes nuevas.<br>' +
                '• Factura electrónica (Hacienda CR): emisor por empresa, modo simulación o API (Almendro, etc.).<br><br>' +
                'Ejecute <strong>ABRIR-SISTEMA.bat</strong> si el servidor no responde.'
        },
        {
            keys: ['usuario', 'login', 'sesion', 'sesión', 'contraseña', 'password', 'acceso'],
            titulo: 'Usuarios y acceso',
            texto:
                '• <strong>Iniciar sesión:</strong> enlace en Inicio → usuario y contraseña.<br>' +
                '• <strong>Usuarios:</strong> menú Usuarios (admin) para crear técnicos/recepción.<br>' +
                '• La orden queda asociada al usuario que la atiende (columna Empleado).'
        },
        {
            keys: ['whatsapp', 'wa ', 'pdf', 'imprimir', 'enviar'],
            titulo: 'Enviar PDF o WhatsApp',
            texto:
                'Desde la orden o proforma use <strong>📱 WhatsApp</strong> o <strong>📄 PDF</strong>.<br>' +
                'Necesita teléfono del cliente (8 dígitos, ej. 88881234) en la ficha o en la orden.<br>' +
                'WhatsApp abre con un mensaje y enlace al documento (presupuesto, orden o factura).'
        },
        {
            keys: ['finanza', 'cxc', 'cxp', 'cuenta'],
            titulo: 'Finanzas',
            texto:
                'Menú <strong>Finanzas (CxC/CxP)</strong>: resumen de cuentas por cobrar y por pagar ' +
                'vinculadas a órdenes y créditos del taller.'
        },
        {
            keys: ['diagnost', 'revision', 'revisión', 'estado'],
            titulo: 'Diagnóstico y estados',
            texto:
                '• Menú <strong>Diagnóstico</strong> filtra órdenes «En revisión».<br>' +
                '• En la orden, pestaña <strong>F7 Texto libre / Observación</strong> guarda el motivo de ingreso.<br>' +
                '• Botones de estado abajo: Ingreso, En revisión, En proceso, Listo.'
        },
        {
            keys: ['hola', 'buenas', 'ayuda', 'como', 'cómo', 'que puedo', 'qué puedo'],
            titulo: '¿En qué le ayudo?',
            texto:
                'Puede preguntarme, por ejemplo:<br>' +
                '• «¿Cómo facturo?»<br>' +
                '• «¿Cómo registro un cliente?»<br>' +
                '• «¿Cómo creo una orden?»<br>' +
                '• «¿Qué es una proforma?»<br>' +
                '• «¿Cómo cobro?»<br><br>' +
                'Escriba su duda abajo y le respondo con los pasos.'
        }
    ];

    var SUGERENCIAS = [
        '¿Cómo facturo?',
        '¿Cómo registro un cliente?',
        '¿Cómo creo una orden?',
        '¿Cómo cambio de empresa?',
        '¿Qué es una proforma?'
    ];

    function normalizar(s) {
        return String(s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    function puntuarTema(preguntaNorm, tema) {
        var score = 0;
        tema.keys.forEach(function (k) {
            var kn = normalizar(k);
            if (preguntaNorm.indexOf(kn) >= 0) score += kn.length > 4 ? 3 : 2;
        });
        return score;
    }

    function escHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function responder(pregunta) {
        var q = normalizar(pregunta);
        if (!q) {
            return {
                titulo: 'Escriba una pregunta',
                texto: 'Use el cuadro de abajo. Por ejemplo: «¿Cómo facturo?» o «¿Cómo lleno un cliente?»'
            };
        }

        var mejor = null;
        var mejorScore = 0;
        TEMAS.forEach(function (tema) {
            var s = puntuarTema(q, tema);
            if (s > mejorScore) {
                mejorScore = s;
                mejor = tema;
            }
        });

        if (mejor && mejorScore >= 2) {
            return { titulo: mejor.titulo, texto: mejor.texto };
        }

        return {
            titulo: 'No encontré un tema exacto',
            texto:
                'Pruebe preguntar de otra forma, por ejemplo:<br>' +
                '• Facturación: «¿Cómo emitir factura?»<br>' +
                '• Clientes: «¿Cómo agregar un cliente nuevo?»<br>' +
                '• Órdenes: «¿Cómo ingreso un vehículo?»<br>' +
                '• Proformas: «¿Cómo hago un presupuesto?»<br><br>' +
                'O use los botones de sugerencias debajo del chat.'
        };
    }

    global.AyudaTaller = {
        responder: responder,
        sugerencias: SUGERENCIAS,
        mensajeBienvenida:
            '¡Hola! Soy la ayuda de <strong>Sanmy Taller</strong>. ' +
            'Escriba su pregunta (por ejemplo «¿Cómo facturo?» o «¿Cómo registro un cliente?») y le respondo con los pasos.'
    };
})(typeof window !== 'undefined' ? window : global);
