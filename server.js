const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { initDatabase, DB_PATH } = require('./db/database');
const apiRoutes = require('./api/routes');

const PORT = process.env.PORT || 3020;
const ROOT = path.join(__dirname);

initDatabase();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(function (req, res, next) {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  next();
});

app.use('/api', apiRoutes);

app.use(function (req, res, next) {
  const p = (req.path || '').toLowerCase();
  if (p.indexOf('generador-licencias') >= 0 || p.indexOf('herramientas-vendedor') >= 0) {
    return res.status(404).type('text/plain').send('No encontrado');
  }
  next();
});

function iconosPwa() {
  return [
    {
      src: '/img/app/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: '/img/app/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any'
    }
  ];
}

app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json');
  res.json({
    id: '/',
    name: 'Sanmy Taller Mecánico',
    short_name: 'Sanmy Taller',
    description: 'Órdenes de trabajo, vehículos y cobro — taller mecánico',
    start_url: '/abrir.html',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#1e3a5f',
    theme_color: '#1e3a5f',
    lang: 'es',
    icons: iconosPwa()
  });
});

app.get('/manifest-app.webmanifest', (req, res) => {
  res.type('application/manifest+json');
  res.json({
    id: '/app.html',
    name: 'Sanmy Taller',
    short_name: 'Sanmy Taller',
    description: 'Conecte el celular al taller por QR e instale el icono en la pantalla de inicio',
    start_url: '/app.html?fuente=icono',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#1e3a5f',
    theme_color: '#1e3a5f',
    lang: 'es',
    icons: iconosPwa(),
    categories: ['business', 'productivity'],
    prefer_related_applications: false
  });
});

app.use(
  express.static(ROOT, {
    index: 'index.html',
    extensions: ['html']
  })
);

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'abrir.html'));
});

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  Object.values(interfaces).forEach((iface) => {
    iface.forEach((addr) => {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    });
  });
  return ips;
}

app.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('  SANMY TALLER MECÁNICO');
  console.log('  =====================');
  console.log(`  Local:   http://localhost:${PORT}`);
  ips.forEach((ip) => {
    console.log(`  Red:     http://${ip}:${PORT}`);
  });
  console.log(`  BD:      ${DB_PATH}`);
  console.log('');
}).on('error', (err) => {
  console.error('');
  console.error('  ERROR al iniciar Sanmy Taller:');
  console.error('  ' + err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('  El puerto ' + PORT + ' ya está en uso.');
  }
  console.error('');
  process.exit(1);
});
