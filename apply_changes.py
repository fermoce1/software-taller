#!/usr/bin/env python3
"""Apply two replacements to caja.html"""

import re

FILE = r'C:\Users\tecnosur\taller-prototipo\caja.html'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# ==== CHANGE 1: Replace CSS block ====

old_css_start = """    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }"""

old_css_end = """        @media (max-width: 380px) {
            .tab-caja { font-size: 11px; padding: 8px 8px; min-width: 84px; }
        }
    </style>"""

# Build old CSS block by extracting from content
# Find the exact old CSS block boundaries
style_start_idx = content.find(old_css_start)
style_end_tag = "    </style>"
style_end_idx = content.find(style_end_tag, style_start_idx)
if style_start_idx == -1 or style_end_idx == -1:
    print("ERROR: Could not find old CSS block")
    exit(1)

old_css_block = content[style_start_idx:style_end_idx + len(style_end_tag)]

new_css = """    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
        html { height: 100%; height: 100dvh; }
        body {
            height: 100dvh; overflow: hidden; display: flex; flex-direction: column;
            background: #f0f4f8; color: #1e293b;
        }

        .topnav { background: linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%); padding: 8px clamp(8px,1.5vw,18px);
            display: flex; gap: clamp(4px,0.7vw,9px); align-items: stretch; flex-wrap: nowrap; flex-shrink: 0;
            overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
        .nav-item { flex: 0 0 auto; min-width: clamp(64px, 11vw, 88px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
            background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: clamp(5px,0.7vw,8px) 6px;
            color: rgba(255,255,255,0.8); font-weight: 500; font-size: clamp(9px,0.85vw,11px); text-align: center; text-decoration: none; cursor: pointer; }
        .nav-item .ico { font-size: clamp(15px,1.6vw,20px); line-height: 1; }
        .nav-item:hover { background: rgba(255,255,255,0.15); color: #fff; }
        .nav-item.activo { background: linear-gradient(135deg,#f97316,#c2410c); border-color: #ea580c; color: #fff; box-shadow: 0 4px 14px rgba(249,115,22,0.35); }

        .encabezado {
            flex-shrink: 0; background: #fff; border-bottom: 1px solid #e2e8f0;
            padding: 8px 16px; display: flex; align-items: center; justify-content: space-between;
            gap: 12px; flex-wrap: wrap;
        }
        .enc-logo img { max-height: 40px; max-width: 160px; object-fit: contain; display: block; }
        .encabezado .barra-orden { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-left: auto; }
        .encabezado select, .encabezado input[type=search] {
            padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; min-width: 130px; background: #f8fafc;
            font-family: inherit; transition: border 0.2s;
        }
        .encabezado select:focus, .encabezado input[type=search]:focus { outline: none; border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30,58,95,0.1); }

        .caja-workspace {
            flex: 1; min-height: 0; display: flex; flex-direction: column;
            padding: 0;
        }

        .factura-card {
            flex: 1; min-height: 0; display: flex; flex-direction: column;
            width: 100%; max-width: none; margin: 0;
            background: #fff; border: none; border-radius: 0;
            box-shadow: none; overflow: hidden;
        }

        .banner-factura {
            flex-shrink: 0; background: linear-gradient(135deg,#1e3a5f,#2563eb); color: #fff;
            font-weight: 700; font-size: clamp(15px,1.3vw,18px);
            letter-spacing: .04em; padding: 10px 20px;
        }

        .factura-top {
            flex: 1; min-height: 180px; display: grid;
            grid-template-columns: minmax(260px, 30%) minmax(0, 1fr);
        }

        .sec-cliente, .sec-orden {
            padding: 14px 16px; min-height: 0; display: flex; flex-direction: column;
            background: #fff;
        }
        .sec-cliente { border-right: 1px solid #e2e8f0; }
        .sec-titulo {
            font-size: 13px; font-weight: 700; color: #0f172a;
            margin-bottom: 12px; letter-spacing: .02em;
        }

        .campo { margin-bottom: 8px; }
        .campo-busca-caja { position: relative; }
        .sugerencias-caja {
            position: absolute; left: 0; right: 0; top: 100%; z-index: 60;
            background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.1); max-height: 220px;
            overflow-y: auto; margin-top: 4px;
        }
        .sugerencias-caja .sug-item {
            padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;
            font-size: 12px; line-height: 1.35;
        }
        .sugerencias-caja .sug-item:hover { background: #f1f5f9; }
        .sugerencias-caja .sug-item strong { color: #1e3a5f; }
        .sugerencias-caja .sug-item .sug-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
        .sugerencias-caja .sug-vacio {
            padding: 12px; font-size: 12px; color: #94a3b8; text-align: center;
        }
        .campo input, .campo select {
            width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 10px;
            font-size: 13px; font-family: inherit; background: #fff; transition: border 0.2s;
        }
        .campo input:focus { outline: none; border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30,58,95,0.1); }
        .campo input:read-only {
            background: #f8fafc;
            color: #1e293b;
            cursor: default;
            border-color: #e2e8f0;
        }
        .campo-busca-caja input { background: #fff; border: 2px solid #1e3a5f; font-weight: 500; }
        .campo-busca-caja input:focus { box-shadow: 0 0 0 3px rgba(30,58,95,0.15); }
        .campo-doble { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .campo-extra { margin-top: 4px; }
        .campo-extra summary {
            font-size: 11px; color: #64748b; cursor: pointer; margin-bottom: 6px; font-weight: 500;
        }

        .tabla-lineas-wrap { flex: 1; min-height: 0; overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
        .tabla-lineas { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tabla-lineas thead th {
            text-align: left; padding: 10px 10px; background: #f8fafc; border-bottom: 2px solid #e2e8f0;
            font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;
        }
        .tabla-lineas tbody td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .tabla-lineas tbody tr:hover td { background: #f8fafc; }
        .tabla-lineas .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .tabla-lineas .acc { text-align: center; width: 52px; }
        .btn-icon { border: none; background: none; cursor: pointer; font-size: 14px; padding: 0 4px; }

        .pie-lineas {
            margin-top: 10px; display: flex; justify-content: space-between; align-items: center;
            flex-wrap: wrap; gap: 8px;
        }
        .pie-lineas .orden-id { font-size: 12px; color: #64748b; }
        .pie-btns { display: flex; gap: 8px; }
        .btn-add {
            border: none; background: linear-gradient(135deg,#dbeafe,#bfdbfe); color: #1d4ed8;
            border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
            font-family: inherit; transition: all 0.2s;
        }
        .btn-add:hover { box-shadow: 0 4px 12px rgba(30,64,175,0.15); }
        .btn-add:active { transform: scale(0.97); }

        .factura-bottom {
            flex-shrink: 0; display: grid;
            grid-template-columns: minmax(300px, 1fr) minmax(300px, 360px);
            gap: 0; min-height: 210px;
            border-top: 1px solid #e2e8f0;
        }
        .col-imp-pago, .col-totales {
            padding: 14px 18px; display: flex; flex-direction: column; gap: 14px;
            background: #fff;
        }
        .col-imp-pago { border-right: 1px solid #e2e8f0; }
        .factura-bottom-izq {
            padding: 14px 18px; display: flex; flex-direction: column; gap: 12px;
            border-right: 1px solid #e2e8f0;
        }
        .bloque-tit {
            font-size: 11px; font-weight: 700; color: #64748b;
            text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px;
        }

        .imp-fila { display: flex; gap: 8px; flex-wrap: wrap; }
        .imp-tile {
            width: 80px; min-height: 56px; border: 1px solid #e2e8f0; border-radius: 10px;
            background: #fff; display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 4px; font-size: 10px; font-weight: 600;
            color: #475569; cursor: pointer; text-align: center; padding: 8px 4px; transition: all 0.2s;
        }
        .imp-tile .ico-tile { font-size: 20px; line-height: 1; }
        .imp-tile:hover { border-color: #1e3a5f; background: #f8fafc; }
        .imp-tile:has(input:checked), .imp-tile.activo { border-color: #1e3a5f; background: #eff6ff; color: #1e3a5f; }
        .imp-tile input { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }

        #pagos-container { display: flex; gap: 8px; flex-wrap: wrap; }
        .pago-opt {
            min-width: 90px; width: 90px; min-height: 56px; border: 1px solid #e2e8f0; border-radius: 10px;
            background: #fff; display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 4px; font-size: 10px; font-weight: 600;
            color: #475569; cursor: pointer; text-align: center; padding: 8px 4px; margin: 0; transition: all 0.2s;
        }
        .pago-opt .ico-pago { font-size: 22px; line-height: 1; }
        .pago-opt > span:last-child { font-size: 9px; line-height: 1.2; max-width: 80px; }
        .pago-opt:hover { border-color: #1e3a5f; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .pago-opt:has(input:checked) { border-color: #16a34a; background: #f0fdf4; color: #16a34a; }
        .pago-opt input { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }

        .tipo-doc-fila { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .tipo-doc-mini {
            border: 1px solid #e2e8f0; background: #fff; border-radius: 999px;
            padding: 7px 16px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; font-family: inherit; transition: all 0.2s;
        }
        .tipo-doc-mini:hover { border-color: #1e3a5f; color: #1e3a5f; }
        .tipo-doc-mini.activo { background: linear-gradient(135deg,#1e3a5f,#2563eb); color: #fff; border-color: #1e3a5f; }

        .col-totales {
            background: #fff; display: flex; flex-direction: column; justify-content: center;
        }
        .factura-bottom-der {
            padding: 14px 18px; display: flex; flex-direction: column; gap: 12px;
            background: #fff;
        }
        .totales-box {
            background: linear-gradient(135deg, #0f172a, #1e3a5f);
            border-radius: 16px; padding: 20px; color: #fff;
        }
        .totales-box .fila {
            display: flex; justify-content: space-between; padding: 5px 0;
            font-size: 14px;
        }
        .totales-box .fila .lbl { color: rgba(255,255,255,0.65); }
        .totales-box .fila .val { font-weight: 700; color: #fff; }
        .totales-box .fila.grande {
            margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.15);
        }
        .totales-box .fila.grande .lbl { font-size: 15px; font-weight: 700; }
        .totales-box .fila.grande .val { font-size: clamp(22px,2.4vw,30px); font-weight: 800; color: #fbbf24; }

        .acciones-caja { display: flex; flex-direction: column; gap: 8px; }
        .btn-acc {
            width: 100%; border: none; border-radius: 12px; padding: 14px 10px;
            font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s;
        }
        .btn-acc:disabled { opacity: .5; cursor: not-allowed; }
        .btn-acc:active { transform: scale(0.97); }
        .btn-factura { background: linear-gradient(135deg,#16a34a,#22c55e); color: #fff; }
        .btn-factura:hover { box-shadow: 0 6px 20px rgba(22,163,74,0.3); }
        .btn-reimprimir-mini, .btn-nueva-mini {
            width: 100%; border: 1px solid #e2e8f0; background: #fff; color: #475569;
            border-radius: 10px; padding: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s;
        }
        .btn-reimprimir-mini:hover, .btn-nueva-mini:hover { border-color: #1e3a5f; background: #f8fafc; }

        .fe-mini { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
        .fe-mini label.chk { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; cursor: pointer; color: #1e293b; font-weight: 600; }
        .fe-mini input[type=checkbox] { accent-color: #1e3a5f; width: 18px; height: 18px; }
        .fe-campos { display: none; margin-top: 8px; }
        .fe-campos.visible { display: block; }
        .fe-campos input, .fe-campos select {
            width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; margin-bottom: 6px; font-family: inherit;
        }
        .fe-campos input:focus, .fe-campos select:focus { outline: none; border-color: #1e3a5f; }
        .fe-alerta { display: none; margin-top: 6px; padding: 8px; border-radius: 8px; font-size: 11px;
            background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; }

        .wa-mini { display: none; }
        .estado-cerrada {
            background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
            border-radius: 10px; padding: 8px 10px; font-size: 12px; margin-bottom: 10px;
        }
        .vacio-lineas { text-align: center; color: #94a3b8; padding: 24px; font-size: 13px; }

        .panel-cliente, .panel-lineas, .panel-cobro { }

        .btn-nueva-mini { display: none; }

        .modal-overlay {
            display: none; position: fixed; inset: 0; background: rgba(15,23,42,.45);
            z-index: 200; align-items: center; justify-content: center; padding: 16px;
        }
        .modal-overlay.activa { display: flex; }
        .modal-box {
            background: #fff; border-radius: 14px; padding: 22px; width: min(440px, 100%);
            box-shadow: 0 20px 50px rgba(0,0,0,.25);
        }
        .modal-box h3 { margin-bottom: 14px; color: #1e3a5f; font-size: 18px; }
        .modal-box label { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 4px; display: block; }
        .modal-box .campo { margin-bottom: 10px; }
        .modal-acc { display: flex; gap: 10px; margin-top: 18px; }
        .modal-acc button { flex: 1; padding: 12px; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 13px; }
        .modal-ok { background: #2563eb; color: #fff; }
        .modal-ok:hover { box-shadow: 0 4px 14px rgba(37,99,235,0.3); }
        .modal-no { background: #f1f5f9; color: #475569; }

        #toast-caja {
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(80px);
            background: #1e293b; color: #fff; padding: 12px 20px; border-radius: 999px; font-size: 14px;
            z-index: 300; opacity: 0; transition: transform .25s, opacity .25s; pointer-events: none;
        }
        #toast-caja.visible { transform: translateX(-50%) translateY(0); opacity: 1; }

        .tabs-caja {
            display: none; flex-shrink: 0; gap: 6px; padding: 8px clamp(10px, 2vw, 16px);
            background: #fff; border-bottom: 1px solid #e2e8f0; overflow-x: auto;
        }
        .tab-caja {
            flex: 1 1 0; min-width: 96px; border: 1px solid #e2e8f0; background: #fff;
            border-radius: 999px; padding: 10px 14px; font-size: 12px; font-weight: 600;
            color: #475569; cursor: pointer; white-space: nowrap; text-align: center; font-family: inherit; transition: all 0.2s;
        }
        .tab-caja:hover { border-color: #1e3a5f; color: #1e3a5f; }
        .tab-caja.activo { background: linear-gradient(135deg, #1e3a5f, #2563eb); color: #fff; border-color: #1e3a5f; }

        @media (max-width: 1200px) {
            .factura-bottom { grid-template-columns: 1fr; }
            .col-totales, .factura-bottom-der { border-top: 1px solid #e2e8f0; }
            .col-imp-pago { border-right: none; }
        }

        @media (max-width: 900px) {
            body { height: auto; min-height: 100dvh; overflow: auto; }
            .tabs-caja { display: flex; position: sticky; top: 0; z-index: 50; }
            .factura-top { grid-template-columns: 1fr; }
            .sec-cliente { border-right: none; border-bottom: 1px solid #e2e8f0; }
            .factura-top .sec-cliente,
            .factura-top .sec-orden,
            .factura-bottom { display: none; }
            .factura-top .sec-cliente.activo-movil,
            .factura-top .sec-orden.activo-movil,
            .factura-bottom.activo-movil { display: flex; flex-direction: column; }
            .factura-bottom.activo-movil { display: grid; }
            #pagos-container { flex-wrap: wrap; }
        }

        @media (max-width: 600px) {
            .tabla-lineas thead { display: none; }
            .tabla-lineas tbody tr {
                display: block; border: 1px solid #e2e8f0; border-radius: 10px;
                margin-bottom: 8px; padding: 4px 10px 8px; background: #fff;
            }
            .tabla-lineas tbody tr:hover td { background: transparent; }
            .tabla-lineas tbody td {
                display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
                padding: 5px 0; border: none;
            }
            .tabla-lineas tbody td::before {
                content: attr(data-label); font-weight: 600; font-size: 10px;
                color: #64748b; text-transform: uppercase; flex-shrink: 0;
            }
            .tabla-lineas tbody td.acc { justify-content: flex-end; padding-top: 4px; }
            .tabla-lineas tbody td.acc::before { display: none; }
            .tabla-lineas tbody td.vacio-lineas { display: block; text-align: center; }
            .tabla-lineas tbody td.vacio-lineas::before { display: none; }
            .pie-lineas { flex-direction: column; align-items: stretch; }
            .pie-btns { width: 100%; }
            .pie-btns .btn-add { flex: 1; text-align: center; }
        }

        @media (max-width: 380px) {
            .tab-caja { font-size: 11px; padding: 8px 8px; min-width: 84px; }
        }
    </style>"""

if old_css_block not in content:
    print("ERROR: old CSS block not found in content")
    exit(1)

content = content.replace(old_css_block, new_css, 1)
print("Change 1 (CSS) applied successfully")

# ==== CHANGE 2: Replace factura-bottom HTML block ====

old_html = """            <div class="factura-bottom panel-cobro activo-movil">
                <div class="col-imp-pago" style="border-right:1px solid #ccc;">
                    <div>
                        <div class="bloque-tit">Impresión</div>
                        <div class="imp-fila">
                            <label class="imp-tile">
                                <input type="checkbox" id="chk-imprimir-ticket" checked onchange="guardarPrefImpresionCaja()">
                                <span class="ico-tile">🖨️</span> Ticket
                            </label>
                        </div>
                    </div>
                    <div>
                        <div class="bloque-tit">Forma de pago</div>
                        <div id="pagos-container"></div>
                    </div>
                    <div>
                        <div class="bloque-tit">Tipo de documento</div>
                        <div class="tipo-doc-fila">
                            <button type="button" class="tipo-doc-mini" data-tipo="presupuesto" onclick="seleccionarTipoDoc('presupuesto')">Proforma</button>
                            <button type="button" class="tipo-doc-mini" data-tipo="orden" onclick="seleccionarTipoDoc('orden')">Orden</button>
                        </div>
                    </div>
                </div>

                <div class="col-totales">
                    <div class="acciones-caja">
                        <button type="button" class="btn-reimprimir-mini" id="btn-reimprimir" style="display:none;" onclick="reimprimirTicketCaja()">🖨️ Reimprimir</button>
                        <button type="button" class="btn-nueva-mini" onclick="nuevaOrden()">➕ Nueva orden</button>
                    </div>
                </div>
            </div>"""

new_html = """            <div class="factura-bottom panel-cobro activo-movil">
                <div class="col-imp-pago">
                    <div>
                        <div class="bloque-tit">Impresión</div>
                        <div class="imp-fila">
                            <label class="imp-tile">
                                <input type="checkbox" id="chk-imprimir-ticket" checked onchange="guardarPrefImpresionCaja()">
                                <span class="ico-tile">🖨️</span> Ticket
                            </label>
                        </div>
                    </div>
                    <div>
                        <div class="bloque-tit">Forma de pago</div>
                        <div id="pagos-container"></div>
                    </div>
                    <div>
                        <div class="bloque-tit">Tipo de documento</div>
                        <div class="tipo-doc-fila">
                            <button type="button" class="tipo-doc-mini" data-tipo="presupuesto" onclick="seleccionarTipoDoc('presupuesto')">Proforma</button>
                            <button type="button" class="tipo-doc-mini" data-tipo="orden" onclick="seleccionarTipoDoc('orden')">Orden</button>
                        </div>
                    </div>
                </div>

                <div class="col-totales">
                    <div class="totales-box">
                        <div class="fila"><span class="lbl">Subtotal:</span><span class="val" id="t-sub">CRC 0</span></div>
                        <div class="fila"><span class="lbl" id="lbl-iva">IVA (13%):</span><span class="val" id="t-iva">CRC 0</span></div>
                        <div class="fila grande"><span class="lbl">Total a Pagar:</span><span class="val" id="t-total">CRC 0</span></div>
                    </div>
                    <div class="acciones-caja">
                        <button type="button" class="btn-acc btn-factura" id="btn-factura" onclick="generarFactura()">✔ GENERAR FACTURA</button>
                        <button type="button" class="btn-reimprimir-mini" id="btn-reimprimir" style="display:none;" onclick="reimprimirTicketCaja()">🖨️ Reimprimir</button>
                        <button type="button" class="btn-nueva-mini" onclick="nuevaOrden()">➕ Nueva orden</button>
                    </div>
                </div>
            </div>"""

if old_html not in content:
    print("ERROR: old HTML block not found in content")
    exit(1)

content = content.replace(old_html, new_html, 1)
print("Change 2 (HTML) applied successfully")

# ==== Write result ====

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("File written successfully")
