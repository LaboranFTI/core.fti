const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('dist/assets').filter(f => f.endsWith('.js'));
let found = [];
for (const f of files) {
  const content = fs.readFileSync(path.join('dist/assets', f), 'utf8');
  if (content.includes('core.fti.uksw.edu') || content.includes('192.168.229')) {
    found.push(f);
  }
}
if (found.length === 0) {
  console.log('BERSIH: Tidak ada URL lama di dist');
} else {
  console.log('DITEMUKAN URL LAMA di:', found.join(', '));
}
