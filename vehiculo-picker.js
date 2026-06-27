/**

 * Selector modal marca / modelo — solo modelos de la marca elegida.

 */

(function () {

  var pickerModo = 'marca';

  var pickerMarcaActiva = '';



  function escPicker(s) {

    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  }



  function escAttr(s) {

    return String(s || '')

      .replace(/&/g, '&amp;')

      .replace(/"/g, '&quot;')

      .replace(/</g, '&lt;');

  }



  function catalogoListo() {

    return typeof window.listarMarcasVehiculo === 'function' &&

      typeof window.listarModelosVehiculo === 'function';

  }



  function resolverMarca(marca) {

    if (typeof window.resolverMarcaVehiculo === 'function') {

      return window.resolverMarcaVehiculo(marca) || '';

    }

    return String(marca || '').trim();

  }



  function renderLista() {

    var cont = document.getElementById('picker-vehiculo-lista');

    var buscar = document.getElementById('picker-vehiculo-buscar');

    if (!cont) return;

    var filtro = buscar ? buscar.value.trim() : '';



    if (pickerModo === 'marca') {

      var marcas = window.listarMarcasVehiculo(filtro);

      if (!marcas.length) {

        cont.innerHTML = '<div class="picker-vacio">Sin coincidencias</div>';

        return;

      }

      cont.innerHTML = marcas.map(function (item) {

        return '<div class="picker-item" data-picker-valor="' + escAttr(item) + '">' +

          escPicker(item) +

          '<span style="float:right;color:#94a3b8;font-size:12px;">ver modelos →</span></div>';

      }).join('');

      return;

    }



    if (!pickerMarcaActiva) {

      cont.innerHTML = '<div class="picker-vacio">Seleccione una marca primero.</div>';

      return;

    }



    var modelos = window.listarModelosVehiculo(pickerMarcaActiva, filtro);

    if (window.VEHICULOS_MARCAS) {

      var keysMarcas = Object.keys(window.VEHICULOS_MARCAS);

      modelos = modelos.filter(function (m) {

        return keysMarcas.indexOf(m) < 0;

      });

    }

    if (!modelos.length) {

      cont.innerHTML = '<div class="picker-vacio">Sin modelos para esta búsqueda</div>';

      return;

    }

    cont.innerHTML = modelos.map(function (item) {

      return '<div class="picker-item" data-picker-valor="' + escAttr(item) + '">' +

        escPicker(item) + '</div>';

    }).join('');

  }



  function mostrarModelosDeMarca(marca) {

    var canon = resolverMarca(marca);

    if (!canon) return;

    pickerMarcaActiva = canon;

    pickerModo = 'modelo';



    var inputMarca = document.getElementById('n-marca');

    var inputModelo = document.getElementById('n-modelo');

    if (inputMarca) inputMarca.value = canon;

    if (inputModelo) inputModelo.value = '';



    var titulo = document.getElementById('picker-vehiculo-titulo');

    if (titulo) titulo.textContent = 'Seleccionar modelo';

    var sub = document.getElementById('picker-vehiculo-sub');

    if (sub) {

      sub.style.display = 'block';

      sub.textContent = 'Solo modelos de: ' + canon;

    }

    var btnVolver = document.getElementById('picker-btn-volver-marca');

    if (btnVolver) btnVolver.style.display = 'inline-block';

    var buscar = document.getElementById('picker-vehiculo-buscar');

    if (buscar) {

      buscar.value = '';

      buscar.placeholder = 'Buscar modelo...';

    }

    renderLista();

    setTimeout(function () {

      if (buscar) buscar.focus();

    }, 50);

  }



  function seleccionarPickerVehiculo(valor) {

    if (pickerModo === 'marca') {

      mostrarModelosDeMarca(valor);

      return;

    }

    var inputModelo = document.getElementById('n-modelo');

    if (inputModelo) inputModelo.value = valor;

    window.cerrarPickerVehiculo();

  }



  function initPickerLista() {

    var lista = document.getElementById('picker-vehiculo-lista');

    if (!lista || lista._pickerBound) return;

    lista._pickerBound = true;

    lista.addEventListener('mousedown', function (e) {

      if (e.target.closest('.picker-item')) e.preventDefault();

    });

    lista.addEventListener('click', function (e) {

      var item = e.target.closest('.picker-item');

      if (!item) return;

      e.preventDefault();

      e.stopPropagation();

      var valor = item.getAttribute('data-picker-valor');

      if (valor) seleccionarPickerVehiculo(valor);

    });

  }



  window.abrirPickerMarca = function () {

    if (!catalogoListo()) {

      alert('Catálogo no cargado. Recargue la página (Ctrl+F5).');

      return;

    }

    pickerModo = 'marca';

    pickerMarcaActiva = '';

    var titulo = document.getElementById('picker-vehiculo-titulo');

    if (titulo) titulo.textContent = '🚗 Seleccionar marca';

    var sub = document.getElementById('picker-vehiculo-sub');

    if (sub) sub.style.display = 'none';

    var btnVolver = document.getElementById('picker-btn-volver-marca');

    if (btnVolver) btnVolver.style.display = 'none';

    var buscar = document.getElementById('picker-vehiculo-buscar');

    var inputMarca = document.getElementById('n-marca');

    if (buscar) {

      buscar.placeholder = 'Buscar marca...';

      buscar.value = inputMarca ? inputMarca.value.trim() : '';

    }

    renderLista();

    var modal = document.getElementById('modal-picker-vehiculo');

    if (modal) modal.classList.add('activa');

    setTimeout(function () {

      if (buscar) buscar.focus();

    }, 80);

  };



  window.abrirPickerModelo = function () {

    if (!catalogoListo()) {

      alert('Catálogo no cargado. Recargue la página (Ctrl+F5).');

      return;

    }

    var inputMarca = document.getElementById('n-marca');

    var marca = inputMarca ? inputMarca.value.trim() : '';

    var canon = resolverMarca(marca);

    if (!canon) {

      alert('Primero seleccione una marca (botón ▼ en Marca).');

      window.abrirPickerMarca();

      return;

    }

    var modal = document.getElementById('modal-picker-vehiculo');

    if (modal) modal.classList.add('activa');

    mostrarModelosDeMarca(canon);

  };



  window.cerrarPickerVehiculo = function () {

    var modal = document.getElementById('modal-picker-vehiculo');

    if (modal) modal.classList.remove('activa');

    pickerModo = 'marca';

    pickerMarcaActiva = '';

    var btnVolver = document.getElementById('picker-btn-volver-marca');

    if (btnVolver) btnVolver.style.display = 'none';

    var sub = document.getElementById('picker-vehiculo-sub');

    if (sub) sub.style.display = 'none';

  };



  window.volverPickerMarca = function () {

    pickerModo = 'marca';

    pickerMarcaActiva = '';

    var titulo = document.getElementById('picker-vehiculo-titulo');

    if (titulo) titulo.textContent = '🚗 Seleccionar marca';

    var sub = document.getElementById('picker-vehiculo-sub');

    if (sub) sub.style.display = 'none';

    var btnVolver = document.getElementById('picker-btn-volver-marca');

    if (btnVolver) btnVolver.style.display = 'none';

    var buscar = document.getElementById('picker-vehiculo-buscar');

    if (buscar) {

      buscar.placeholder = 'Buscar marca...';

      var inputMarca = document.getElementById('n-marca');

      buscar.value = inputMarca ? inputMarca.value.trim() : '';

    }

    renderLista();

    setTimeout(function () {

      if (buscar) buscar.focus();

    }, 50);

  };



  window.filtrarPickerVehiculo = function () {

    renderLista();

  };



  window.seleccionarPickerVehiculo = seleccionarPickerVehiculo;



  window.ocultarSugerenciasVehiculo = function () {

    window.cerrarPickerVehiculo();

  };



  window.mostrarMarcasVehiculo = function () {

    window.abrirPickerMarca();

  };



  window.mostrarModelosVehiculo = function () {

    window.abrirPickerModelo();

  };



  initPickerLista();

})();


