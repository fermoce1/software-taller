/**
 * Sesión local del usuario activo (localStorage).
 */
var UsuarioSesion = (function () {
  var KEY = 'sanmy_taller_usuario';

  function get() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function set(usuario) {
    try {
      if (!usuario || !usuario.id) {
        localStorage.removeItem(KEY);
        return null;
      }
      var data = {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido || '',
        nombre_completo: usuario.nombre_completo || (usuario.nombre + ' ' + (usuario.apellido || '')).trim(),
        usuario: usuario.usuario || '',
        rol: usuario.rol || 'tecnico'
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function esAdmin() {
    var u = get();
    return u && u.rol === 'admin';
  }

  function requiereLogin(redirigir) {
    if (get()) return get();
    if (redirigir !== false) {
      var dest = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = '/abrir.html?return=' + dest;
    }
    return null;
  }

  return {
    get: get,
    set: set,
    clear: clear,
    esAdmin: esAdmin,
    requiereLogin: requiereLogin
  };
})();
