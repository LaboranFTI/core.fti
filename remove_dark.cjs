const fs = require('fs');
const files = [
  'pages_tu/PublicValidationHome.tsx',
  'pages_tu/PublicLetterValidation.tsx',
  'components/QRScannerModal.tsx'
];

files.forEach(f => {
  const p = 'f:/Silab FTI/core.fti/' + f;
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    c = c.replace(/dark:[^\s"'\`{}]+/g, '');
    fs.writeFileSync(p, c);
    console.log('Removed dark mode from ' + f);
  }
});
