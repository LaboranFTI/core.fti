// Domain resmi untuk Production
const productionOrigins = [
  'https://core.fti.uksw.edu',
  'http://core.fti.uksw.edu',
  'https://core.fti.edu',
  'http://core.fti.edu',
  'https://arsip-fti.forion.my.id',
  'http://arsip-fti.forion.my.id',
];

// Domain & IP lokal untuk Development
const developmentOrigins = [
  'http://localhost:5173', 
  'http://localhost:3000',
  'https://localhost:5173',
  'https://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://localhost:5001',
  'https://localhost:5001',
  'http://127.0.0.1:5001',
  // IP LAN / Network
  'http://192.168.68.197:5173', 'https://192.168.68.197:5173',
  'http://192.168.68.246',      'https://192.168.68.246',
  'http://192.168.229.201',     'https://192.168.229.201',
  'http://192.168.229.201:5173','https://192.168.229.201:5173',
  'http://192.168.229.201:5001','https://192.168.229.201:5001',
];

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? productionOrigins 
  : [...productionOrigins, ...developmentOrigins];

export { allowedOrigins };
