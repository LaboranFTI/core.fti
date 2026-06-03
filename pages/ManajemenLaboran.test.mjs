import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const pageSource = readFileSync(new URL('./ManajemenLaboran.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../backend/routes/system.routes.js', import.meta.url), 'utf8');

test('laboran management supports nullable staff notes and lab PIC assignment', () => {
  assert.match(pageSource, /keterangan\?:\s*string/);
  assert.match(pageSource, /assignedLabIds\?:\s*string\[\]/);
  assert.match(pageSource, /Lab Komputer yang Diampu/);
  assert.match(pageSource, /textarea[\s\S]*Keterangan/);
  assert.match(routeSource, /keterangan/);
  assert.match(routeSource, /labRoomIds/);
  assert.match(routeSource, /category\s*=\s*'Laboratorium Komputer'/);
  assert.match(routeSource, /pic_id\s*=\s*NULL/);
  assert.match(pageSource, /positionStartDate\?:\s*string/);
  assert.match(pageSource, /positionPeriods\?:\s*StaffPositionPeriod\[\]/);
  assert.match(pageSource, /Tanggal Mulai Menjabat/);
  assert.match(pageSource, /Tanggal Berhenti Menjabat/);
  assert.match(pageSource, /Riwayat Periode Jabatan/);
  assert.match(pageSource, /usePagination\(filteredStaff,\s*10\)/);
  assert.match(pageSource, /<Pagination/);
  assert.match(pageSource, /useState<'All' \| 'Aktif' \| 'Non-Aktif'>\('Aktif'\)/);
  assert.match(pageSource, /whitespace-nowrap/);
  assert.match(pageSource, /Identifier \(NIM\/NIP\)/);
});
