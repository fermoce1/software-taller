/**

 * Bloquea todos los módulos hasta que el usuario inicie sesión en la pantalla de Inicio.

 * Incluir después de usuario-sesion.js (y taller-api.js si está disponible).

 */

(function () {

  if (typeof UsuarioSesion === 'undefined') return;

  if (UsuarioSesion.get()) return;



  var path = window.location.pathname || '';

  var libres = ['abrir.html', 'login.html', 'activar-licencia.html', 'generador-licencias.html'];

  for (var i = 0; i < libres.length; i++) {

    if (path.indexOf(libres[i]) >= 0) return;

  }



  var dest = encodeURIComponent(window.location.pathname + window.location.search);

  window.location.href = '/abrir.html?return=' + dest;

})();

