/*!
 * Acceso directo a la boleta.
 * Mi cuenta con #mi-boleta (o #my-ticket, en inglés) al final de la dirección:
 *  - sin sesión: el formulario de entrada de siempre, con una nota arriba (también en el paso del código);
 *  - con una orden: abre su código QR;
 *  - con varias: deja elegir cuál;
 *  - sin órdenes: lo dice y ofrece comprar.
 * Sin esa marca no hace nada. Recuerda la marca solo en esta pestaña (sessionStorage), 30 minutos.
 */
(function () {
  'use strict';
  var w = window;
  var d = document;
  var raiz = d.documentElement;
  if (w.__mbListo) return;
  w.__mbListo = true;
  try { if (w.top !== w.self) return; } catch (e) { return; }

  var CLAVE = 'mb.estado';
  var VIDA = 30 * 60 * 1000;
  var ESPERA_MAX = 9000;
  var CUENTA = '/myaccount.asp?gifrompage=1&gitopage=1';
  var COMPRAR = '/eventperformances.asp?evt=952';
  // Fechas de las funciones como las escribe la lista de la cuenta (MM/DD/AAAA; por si acaso, también DD/MM)
  var FECHAS = ['12/11/2026', '12/12/2026', '11/12/2026'];
  var ENTRADA = /^#(mi-boleta|my-ticket)$/i;

  var ruta = location.pathname.toLowerCase();
  var pagina = /\/myaccount\.asp$/.test(ruta) ? 'cuenta'
    : /\/login\.asp$/.test(ruta) ? 'login'
    : /\/orderdetail\.asp$/.test(ruta) ? 'orden'
    : /\/mobile\//.test(ruta) ? 'qr'
    : 'otra';
  if (pagina === 'qr') return;

  var estado = leer();
  var entrada = ENTRADA.exec(location.hash);
  if (entrada) {
    estado = { i: /^#my/i.test(entrada[0]) ? 'en' : 'es', p: 0 };
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* queda el # */ }
  }
  if (!estado) return;
  guardar(estado);
  if (entrada && pagina !== 'cuenta' && pagina !== 'login') {
    location.replace(CUENTA);
    return;
  }

  var T = estado.i === 'en' ? {
    marca: 'My ticket',
    abriendo: 'Opening your ticket…',
    entrarTitulo: 'Sign in to see your ticket',
    entrarTexto: 'Use the email and password of the account you bought with. Then we take you straight to your QR code.',
    codigoTitulo: 'Check your email',
    codigoTexto: 'We sent you a verification code. Type your password again and the code, then tap «Ingresar».',
    variasTitulo: 'Your tickets',
    unaTitulo: 'Your ticket',
    elegirTexto: 'Tap the order you want to see.',
    orden: 'Order ',
    verQr: 'See QR',
    notaQr: 'The QR code shows up 24 to 48 hours before the event.',
    ningunaTitulo: 'No tickets in this account',
    ningunaTexto: 'Did you buy with another email? Sign in with that account.',
    comprar: 'Buy tickets',
    sinQrTitulo: 'This order has no QR code',
    sinQrTexto: 'Its delivery method isn’t «Mobile Delivery». Check your purchase email.',
    verOrden: 'See the order',
    volver: 'Back to my tickets',
    cuenta: 'Go to my account',
    verBoleta: 'See my ticket',
    cerrar: 'Close'
  } : {
    marca: 'Mi boleta',
    abriendo: 'Abriendo tu boleta…',
    entrarTitulo: 'Entra para ver tu boleta',
    entrarTexto: 'Usa el correo y la contraseña de la cuenta con la que compraste. Al entrar te llevamos directo a tu código QR.',
    codigoTitulo: 'Revisa tu correo',
    codigoTexto: 'Te enviamos un código de verificación. Escribe otra vez tu contraseña y el código, y toca «Ingresar».',
    variasTitulo: 'Tus boletas',
    unaTitulo: 'Tu boleta',
    elegirTexto: 'Toca la orden que quieres ver.',
    orden: 'Orden ',
    verQr: 'Ver QR',
    notaQr: 'El código QR aparece entre 24 y 48 horas antes del evento.',
    ningunaTitulo: 'No tienes boletas en esta cuenta',
    ningunaTexto: '¿Compraste con otro correo? Entra con esa cuenta.',
    comprar: 'Comprar boletas',
    sinQrTitulo: 'Esta orden no tiene código QR',
    sinQrTexto: 'Su forma de entrega no es «Mobile Delivery». Revisa el correo de tu compra.',
    verOrden: 'Ver la orden',
    volver: 'Volver a mis boletas',
    cuenta: 'Ir a mi cuenta',
    verBoleta: 'Ver mi boleta',
    cerrar: 'Cerrar'
  };

  raiz.classList.add('mb-on');
  if (pagina === 'login') raiz.classList.add('mb-login');
  // Mi cuenta (y la orden que se abre sola) quedan tapadas hasta saber qué mostrar
  if (pagina === 'cuenta' || (pagina === 'orden' && estado.v && estado.v === idDe(location.href))) {
    raiz.classList.add('mb-tapa');
    if (d.body) espera();
  }

  listo(function () {
    if (d.getElementById('loginfrm')) return entrar(d.getElementById('loginfrm'));
    if (pagina === 'cuenta') return cuenta();
    if (pagina === 'orden') return orden();
    if (pagina === 'otra' && !estado.p && /^\/(default\.asp|eventperformances\.asp)?$/.test(ruta)) barra();
  });

  // Al volver con «Atrás» desde el QR, la página puede salir de la caché tal como quedó (cargando)
  w.addEventListener('pageshow', function (ev) {
    if (!ev.persisted || pagina !== 'cuenta' || d.getElementById('loginfrm')) return;
    estado = leer();
    if (estado && d.getElementById('mb')) seguro(cuenta);
  });

  /* ------------------------------------------------------------------ Páginas */

  function entrar(form) {
    destapar();
    // Mi cuenta sin sesión trae el mismo formulario que login.asp: que se vea igual que allá
    raiz.classList.add('mb-login', 'paco-pg-login');
    if (d.getElementById('mb-nota')) return;
    var codigo = !!d.getElementById('AutenticationCode')
      || !!d.querySelector('#loginfrm input[name="isAuthCodeSent"][value="True" i]');
    var nota = el('div', { id: 'mb-nota', role: 'note' }, [
      el('span', { 'class': 'mb-kicker' }, T.marca),
      el('strong', {}, codigo ? T.codigoTitulo : T.entrarTitulo),
      el('p', {}, codigo ? T.codigoTexto : T.entrarTexto)
    ]);
    if (codigo) nota.className = 'mb-nota--codigo';
    form.parentNode.insertBefore(nota, form);
  }

  function cuenta() {
    var conSesion = d.querySelector('.myaccount-layout, .account-recent-orders, [onclick*="logoff.asp" i], a[href*="logoff.asp" i]');
    if (!conSesion) return destapar();
    var ordenes = leerOrdenes(d, location.href);
    var delEvento = ordenes.filter(function (o) { return o.delEvento; });
    if (!ordenes.length) return ninguna();
    if (delEvento.length === 1 && !estado.p) return abrir(delEvento[0], true);
    elegir(delEvento.length ? delEvento : ordenes);
  }

  function orden() {
    if (!estado.v || estado.v !== idDe(location.href)) return;
    var qr = qrDe(d, location.href);
    delete estado.v;
    if (qr) {
      estado.p = 1;
      guardar(estado);
      espera();
      location.replace(qr);
      return;
    }
    guardar(estado);
    panel([
      titulo(T.sinQrTitulo),
      el('p', {}, T.sinQrTexto),
      boton(T.verOrden, destapar, 'mb-boton'),
      enlace(T.volver, CUENTA, 'mb-boton mb-boton--2')
    ]);
  }

  // Sola (una orden): el QR reemplaza a Mi cuenta, así «Atrás» no vuelve a una página que salta.
  // Elegida en la lista: queda en el historial para volver a la lista.
  function abrir(o, sola) {
    var ir = function (url) { if (sola) location.replace(url); else location.assign(url); };
    espera();
    buscarQr(o.url).then(function (qr) {
      estado.p = 1;
      delete estado.v;
      guardar(estado);
      ir(qr);
    }, function () {
      // Sin poder leer la orden desde aquí: se abre la orden y ella salta al QR
      estado.v = o.id;
      guardar(estado);
      ir(o.url);
    });
  }

  function elegir(lista) {
    var filas = lista.map(function (o) {
      var b = el('button', { type: 'button', 'class': 'mb-orden' }, [
        el('span', { 'class': 'mb-orden__num' }, T.orden + o.id),
        el('strong', { 'class': 'mb-orden__nombre' }, o.nombre || T.orden + o.id),
        el('span', { 'class': 'mb-orden__ir' }, [icono(), el('span', {}, T.verQr), el('span', { 'aria-hidden': 'true' }, '›')])
      ]);
      b.addEventListener('click', function () { abrir(o, false); });
      return b;
    });
    panel([
      titulo(lista.length === 1 ? T.unaTitulo : T.variasTitulo),
      el('p', {}, T.elegirTexto)
    ].concat(filas, [
      el('p', { 'class': 'mb-nota-qr' }, T.notaQr),
      pie()
    ]));
  }

  function ninguna() {
    panel([
      titulo(T.ningunaTitulo),
      el('p', {}, T.ningunaTexto),
      boton(T.comprar, function () { salir(); location.assign(COMPRAR); }, 'mb-boton'),
      pie()
    ]);
  }

  function barra() {
    if (d.getElementById('mb-barra')) return;
    var x = boton('×', salir, 'mb-barra__x');
    x.setAttribute('aria-label', T.cerrar);
    raiz.appendChild(el('div', { id: 'mb-barra' }, [enlace(T.verBoleta + ' ›', CUENTA, 'mb-barra__ir'), x]));
  }

  /* ------------------------------------------------------------------ Piezas */

  function panel(hijos) {
    var viejo = d.getElementById('mb');
    if (viejo) viejo.parentNode.removeChild(viejo);
    var p = el('div', { id: 'mb', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mb-t' }, [
      el('div', { 'class': 'mb-caja' }, [el('span', { 'class': 'mb-kicker' }, T.marca)].concat(hijos))
    ]);
    raiz.classList.add('mb-tapa');
    // Fuera de <body>: el sitio reacomoda lo que cuelga de <body>
    raiz.appendChild(p);
    var h = d.getElementById('mb-t');
    if (h && h.focus) try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    return p;
  }

  function espera() {
    var p = panel([el('div', { 'class': 'mb-giro', 'aria-hidden': 'true' }), titulo(T.abriendo)]);
    p.setAttribute('aria-busy', 'true');
    p.className = 'mb-cargando';
  }

  function pie() {
    return el('div', { 'class': 'mb-pie' }, [boton(T.cuenta, salir, 'mb-link')]);
  }

  function titulo(texto) {
    return el('h1', { id: 'mb-t', tabindex: '-1' }, texto);
  }

  function destapar() {
    var p = d.getElementById('mb');
    if (p) p.parentNode.removeChild(p);
    raiz.classList.remove('mb-tapa');
  }

  function salir() {
    guardar(null);
    destapar();
    var b = d.getElementById('mb-barra');
    if (b) b.parentNode.removeChild(b);
    raiz.classList.remove('mb-on', 'mb-login');
  }

  function icono() {
    var s = d.createElement('span');
    s.className = 'mb-icono';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/>'
      + '<path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 19.5V20M19.5 14h.5"/></svg>';
    return s;
  }

  /* ------------------------------------------------------------------ Datos */

  function leerOrdenes(doc, base) {
    var vistos = {};
    var out = [];
    var enlaces = doc.querySelectorAll('a[href*="orderdetail.asp" i]');
    for (var i = 0; i < enlaces.length; i++) {
      var a = enlaces[i];
      var href = a.getAttribute('href') || '';
      var id = idDe(href);
      var url = mismoSitio(href, base);
      if (!id || !url || vistos[id]) continue;
      vistos[id] = true;
      var caja = a.closest('.clear-order') || a.closest('li, tr') || a.parentNode;
      var datos = caja.querySelectorAll('.PerformanceInfoBox');
      var fecha = datos.length ? limpio(datos[0].textContent) : '';
      var nombre = limpio((caja.querySelector('.PerformanceNameSpan') || {}).textContent || '');
      out.push({
        id: id,
        url: url.split('#')[0],
        nombre: nombre.split('|').pop().trim() || nombre,
        delEvento: FECHAS.indexOf(fecha) !== -1
      });
    }
    return out;
  }

  function buscarQr(url) {
    if (!w.fetch || !w.DOMParser) return Promise.reject(new Error('sin fetch'));
    var pedido = fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }).then(function (html) {
      var qr = qrDe(new DOMParser().parseFromString(html, 'text/html'), url);
      if (!qr) throw new Error('sin qr');
      return qr;
    });
    var tope = new Promise(function (_, no) { setTimeout(function () { no(new Error('tiempo')); }, ESPERA_MAX); });
    return Promise.race([pedido, tope]);
  }

  function qrDe(doc, base) {
    var a = doc.querySelector('a.mobile-tickets-button') || doc.querySelector('a[href*="/mobile/tickets.asp" i]');
    var url = a ? mismoSitio(a.getAttribute('href') || '', base) : null;
    return url && /^\/mobile\/tickets\.asp$/i.test(new URL(url).pathname) ? url.split('#')[0] : null;
  }

  function idDe(href) {
    var m = /orderdetail\.asp\?(?:[^#]*&)?id=(\d+)/i.exec(href || '');
    return m ? m[1] : null;
  }

  function mismoSitio(href, base) {
    try {
      var u = new URL(href, base);
      return u.origin === location.origin ? u.href : null;
    } catch (e) { return null; }
  }

  function limpio(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

  /* ------------------------------------------------------------------ Estado */

  function leer() {
    var t = null;
    try { t = w.sessionStorage.getItem(CLAVE); } catch (e) { /* sin sessionStorage */ }
    if (t == null) {
      var m = /(?:^|;\s*)mb_e=([^;]*)/.exec(d.cookie);
      if (m) try { t = decodeURIComponent(m[1]); } catch (e) { t = null; }
    }
    try {
      var e = JSON.parse(t);
      if (e && typeof e.t === 'number' && Date.now() - e.t < VIDA && Date.now() >= e.t) return e;
    } catch (x) { /* nada guardado */ }
    return null;
  }

  function guardar(e) {
    var ok = false;
    try {
      if (e) {
        e.t = Date.now();
        w.sessionStorage.setItem(CLAVE, JSON.stringify(e));
      } else {
        w.sessionStorage.removeItem(CLAVE);
      }
      ok = true;
    } catch (x) { /* se usa la cookie */ }
    if (ok && e) return;
    var seg = location.protocol === 'https:' ? '; secure' : '';
    d.cookie = 'mb_e=' + (e && !ok ? encodeURIComponent(JSON.stringify(e)) + '; max-age=' + (VIDA / 1000) : '; max-age=0')
      + '; path=/; samesite=lax' + seg;
  }

  /* ------------------------------------------------------------------ Utilidades */

  function listo(fn) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { seguro(fn); });
    else seguro(fn);
  }

  function seguro(fn) {
    try { fn(); } catch (e) { destapar(); }
  }

  function el(etiqueta, atributos, hijos) {
    var e = d.createElement(etiqueta);
    for (var k in atributos) if (Object.prototype.hasOwnProperty.call(atributos, k)) e.setAttribute(k, atributos[k]);
    if (typeof hijos === 'string') e.textContent = hijos;
    else if (hijos) for (var i = 0; i < hijos.length; i++) if (hijos[i]) e.appendChild(hijos[i]);
    return e;
  }

  function enlace(texto, href, clase) { return el('a', { 'class': clase, href: href }, texto); }

  function boton(texto, fn, clase) {
    var b = el('button', { type: 'button', 'class': clase }, texto);
    b.addEventListener('click', fn);
    return b;
  }
})();
