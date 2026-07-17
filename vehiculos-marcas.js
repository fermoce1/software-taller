/**
 * Catálogo de marcas y modelos de vehículos (común en Latinoamérica).
 */
var VEHICULOS_MARCAS = {
  'Acura': ['ILX', 'Integra', 'MDX', 'NSX', 'RDX', 'TL', 'TLX', 'TSX', 'ZDX'],
  'Alfa Romeo': ['4C', 'Giulia', 'Giulietta', 'Stelvio', 'Tonale'],
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'e-tron', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'R8', 'TT'],
  'BMW': ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'i3', 'i4', 'iX', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4'],
  'Buick': ['Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal'],
  'Cadillac': ['ATS', 'CT4', 'CT5', 'CT6', 'Escalade', 'SRX', 'XT4', 'XT5', 'XT6'],
  'Chevrolet': ['Aveo', 'Blazer', 'Camaro', 'Captiva', 'Colorado', 'Corvette', 'Cruze', 'Equinox', 'Express', 'Impala', 'Malibu', 'N300', 'Onix', 'Orlando', 'Silverado', 'Sonic', 'Spark', 'Suburban', 'Tahoe', 'Tracker', 'Trailblazer', 'Traverse', 'Trax'],
  'Chrysler': ['200', '300', 'Aspen', 'Pacifica', 'Sebring', 'Town & Country', 'Voyager'],
  'Citroën': ['Berlingo', 'C3', 'C4', 'C5', 'C-Elysée', 'Jumper', 'Jumpy', 'Xsara'],
  'Daewoo': ['Lanos', 'Matiz', 'Nubira'],
  'Dodge': ['Caliber', 'Challenger', 'Charger', 'Durango', 'Grand Caravan', 'Journey', 'Nitro', 'Ram 1500', 'Ram 2500', 'Ram 3500'],
  'Fiat': ['500', '500L', '500X', 'Argo', 'Cronos', 'Doblo', 'Fiorino', 'Mobi', 'Palio', 'Pulse', 'Strada', 'Toro', 'Uno'],
  'Ford': ['Bronco', 'EcoSport', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-250', 'F-350', 'Fiesta', 'Focus', 'Fusion', 'Maverick', 'Mustang', 'Ranger', 'Territory', 'Transit'],
  'GMC': ['Acadia', 'Canyon', 'Sierra 1500', 'Sierra 2500', 'Terrain', 'Yukon'],
  'Great Wall': ['Haval H6', 'Wingle'],
  'Hino': ['300', '500', '700'],
  'Honda': ['Accord', 'BR-V', 'Civic', 'CR-V', 'Fit', 'HR-V', 'Insight', 'Odyssey', 'Passport', 'Pilot', 'Ridgeline'],
  'Hyundai': ['Accent', 'Creta', 'Elantra', 'Grand i10', 'H-1', 'H100', 'i10', 'i20', 'i30', 'Ioniq', 'Ioniq 5', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson', 'Venue'],
  'Infiniti': ['EX', 'FX', 'G37', 'Q50', 'Q60', 'QX50', 'QX60', 'QX70', 'QX80'],
  'Isuzu': ['D-Max', 'NPR', 'NQR', 'Rodeo', 'Trooper'],
  'Jaguar': ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'S-Type', 'XE', 'XF', 'XJ'],
  'Jeep': ['Cherokee', 'Commander', 'Compass', 'Gladiator', 'Grand Cherokee', 'Patriot', 'Renegade', 'Wrangler'],
  'Kia': ['Carens', 'Cerato', 'Forte', 'K5', 'K2700', 'Niro', 'Optima', 'Picanto', 'Rio', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Freelander', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  'Lexus': ['CT', 'ES', 'GS', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'UX'],
  'Lincoln': ['Aviator', 'Continental', 'MKC', 'MKX', 'MKZ', 'Nautilus', 'Navigator'],
  'Mazda': ['2', '3', '5', '6', 'BT-50', 'CX-3', 'CX-5', 'CX-7', 'CX-9', 'CX-30', 'CX-50', 'CX-60', 'CX-90', 'MX-5', 'Tribute'],
  'Mercedes-Benz': ['A-Class', 'B-Class', 'C-Class', 'CLA', 'CLS', 'E-Class', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLK', 'GLS', 'ML', 'S-Class', 'Sprinter', 'Vito'],
  'Mini': ['Clubman', 'Countryman', 'Cooper', 'Paceman'],
  'Mitsubishi': ['ASX', 'Eclipse Cross', 'Galant', 'L200', 'Lancer', 'Mirage', 'Montero', 'Montero Sport', 'Outlander', 'Pajero', 'Pajero Sport', 'RVR'],
  'Nissan': ['Altima', 'Frontier', 'Juke', 'Kicks', 'Leaf', 'March', 'Maxima', 'Murano', 'Navara', 'Note', 'NP300', 'Pathfinder', 'Patrol', 'Qashqai', 'Rogue', 'Sentra', 'Tiida', 'Titan', 'Versa', 'X-Trail', 'Xterra'],
  'Peugeot': ['2008', '208', '3008', '301', '308', '408', '5008', 'Boxer', 'Partner', 'Rifter'],
  'Porsche': ['718', '911', 'Boxster', 'Cayenne', 'Cayman', 'Macan', 'Panamera', 'Taycan'],
  'Ram': ['1500', '2500', '3500', 'ProMaster'],
  'Renault': ['Captur', 'Clio', 'Duster', 'Fluence', 'Kangoo', 'Koleos', 'Logan', 'Megane', 'Oroch', 'Sandero', 'Scenic', 'Stepway', 'Symbol', 'Twingo'],
  'Scion': ['tC', 'xA', 'xB', 'xD'],
  'Seat': ['Arona', 'Ateca', 'Ibiza', 'Leon', 'Toledo'],
  'Skoda': ['Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Superb'],
  'Smart': ['Fortwo', 'Forfour'],
  'Subaru': ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Tribeca', 'WRX', 'XV'],
  'Suzuki': ['Baleno', 'Celerio', 'Ertiga', 'Grand Vitara', 'Ignis', 'Jimny', 'S-Cross', 'Swift', 'Vitara', 'XL7'],
  'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y'],
  'Toyota': ['4Runner', 'Avanza', 'Camry', 'Corolla', 'Corolla Cross', 'Fortuner', 'Hiace', 'Hilux', 'Land Cruiser', 'Prado', 'Prius', 'RAV4', 'Rush', 'Sequoia', 'Sienna', 'Tacoma', 'Tundra', 'Yaris', 'Yaris Cross'],
  'Volkswagen': ['Amarok', 'Beetle', 'Bora', 'Gol', 'Golf', 'Jetta', 'Passat', 'Polo', 'Saveiro', 'T-Cross', 'Taos', 'Tiguan', 'Touareg', 'Transporter', 'Vento', 'Virtus'],
  'Volvo': ['C30', 'C40', 'S40', 'S60', 'S80', 'S90', 'V40', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90']
};

function listarMarcasVehiculo(filtro) {
  var term = String(filtro || '').trim().toLowerCase();
  return Object.keys(VEHICULOS_MARCAS)
    .filter(function (m) {
      return !term || m.toLowerCase().indexOf(term) >= 0;
    })
    .sort(function (a, b) {
      return a.localeCompare(b, 'es');
    });
}

function listarModelosVehiculo(marca, filtro) {
  var key = resolverMarcaVehiculo(marca);
  if (!key) return [];
  var term = String(filtro || '').trim().toLowerCase();
  return VEHICULOS_MARCAS[key]
    .filter(function (mod) {
      return !term || mod.toLowerCase().indexOf(term) >= 0;
    })
    .sort(function (a, b) {
      return a.localeCompare(b, 'es');
    });
}

function resolverMarcaVehiculo(marca) {
  var m = String(marca || '').trim();
  if (!m) return '';
  if (VEHICULOS_MARCAS[m]) return m;
  var lower = m.toLowerCase();
  var keys = Object.keys(VEHICULOS_MARCAS);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) return keys[i];
  }
  return '';
}

/**
 * Llena un <select> de marcas. Conserva el valor actual si existe.
 * @param {HTMLSelectElement|string} selectEl
 * @param {string} [valorSeleccionado]
 */
function llenarSelectMarcas(selectEl, valorSeleccionado) {
  var sel = typeof selectEl === 'string' ? document.getElementById(selectEl) : selectEl;
  if (!sel) return;
  var actual = valorSeleccionado != null ? String(valorSeleccionado) : String(sel.value || '');
  var canon = resolverMarcaVehiculo(actual) || actual;
  var marcas = listarMarcasVehiculo();
  var html = '<option value="">— Marca —</option>';
  for (var i = 0; i < marcas.length; i++) {
    var m = marcas[i];
    html += '<option value="' + m.replace(/"/g, '&quot;') + '"' +
      (m === canon ? ' selected' : '') + '>' + m + '</option>';
  }
  if (canon && !resolverMarcaVehiculo(canon) && marcas.indexOf(canon) < 0) {
    html += '<option value="' + canon.replace(/"/g, '&quot;') + '" selected>' + canon + '</option>';
  }
  sel.innerHTML = html;
  if (canon) sel.value = canon;
}

/**
 * Llena un <select> de modelos según la marca elegida.
 * @param {HTMLSelectElement|string} selectMarcaEl
 * @param {HTMLSelectElement|string} selectModeloEl
 * @param {string} [modeloSeleccionado]
 */
function llenarSelectModelos(selectMarcaEl, selectModeloEl, modeloSeleccionado) {
  var selMarca = typeof selectMarcaEl === 'string' ? document.getElementById(selectMarcaEl) : selectMarcaEl;
  var selModelo = typeof selectModeloEl === 'string' ? document.getElementById(selectModeloEl) : selectModeloEl;
  if (!selModelo) return;
  var marca = selMarca ? String(selMarca.value || '').trim() : '';
  var actual = modeloSeleccionado != null ? String(modeloSeleccionado) : String(selModelo.value || '');
  var html = '<option value="">— Modelo —</option>';
  if (!marca) {
    selModelo.innerHTML = html;
    return;
  }
  var modelos = listarModelosVehiculo(marca);
  for (var i = 0; i < modelos.length; i++) {
    var mod = modelos[i];
    html += '<option value="' + mod.replace(/"/g, '&quot;') + '"' +
      (mod === actual ? ' selected' : '') + '>' + mod + '</option>';
  }
  if (actual && modelos.indexOf(actual) < 0) {
    html += '<option value="' + actual.replace(/"/g, '&quot;') + '" selected>' + actual + '</option>';
  }
  selModelo.innerHTML = html;
  if (actual) selModelo.value = actual;
}

/**
 * Conecta marca → modelos (onchange) en un par de selects.
 * @param {string} idMarca
 * @param {string} idModelo
 */
function enlazarSelectsMarcaModelo(idMarca, idModelo) {
  var selMarca = document.getElementById(idMarca);
  var selModelo = document.getElementById(idModelo);
  if (!selMarca || !selModelo || selMarca._marcaModeloBound) return;
  selMarca._marcaModeloBound = true;
  llenarSelectMarcas(selMarca);
  llenarSelectModelos(selMarca, selModelo);
  selMarca.addEventListener('change', function () {
    llenarSelectModelos(selMarca, selModelo, '');
  });
}

if (typeof window !== 'undefined') {
  window.VEHICULOS_MARCAS = VEHICULOS_MARCAS;
  window.listarMarcasVehiculo = listarMarcasVehiculo;
  window.listarModelosVehiculo = listarModelosVehiculo;
  window.resolverMarcaVehiculo = resolverMarcaVehiculo;
  window.llenarSelectMarcas = llenarSelectMarcas;
  window.llenarSelectModelos = llenarSelectModelos;
  window.enlazarSelectsMarcaModelo = enlazarSelectsMarcaModelo;
}
