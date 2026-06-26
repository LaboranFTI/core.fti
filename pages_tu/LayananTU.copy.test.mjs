import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./LayananTU.tsx', import.meta.url), 'utf8');

describe('LayananTU active student copy', () => {
  it('does not mention the retired transcript upload flow', () => {
    assert.doesNotMatch(source, /upload transkrip/i);
    assert.match(source, /Form pengajuan surat keterangan status mahasiswa aktif/);
  });

  it('uses card-based letter selection instead of the retired letter tab list', () => {
    assert.match(source, /useState<LetterServiceId \| null>\(null\)/);
    assert.match(source, /letterServiceCards/);
    assert.match(source, /renderServiceCard/);
    assert.match(source, /aria-pressed/);
    assert.match(source, /const isServiceMenuOpen = !selectedService/);
    assert.doesNotMatch(source, /const serviceTabs/);
    assert.doesNotMatch(source, /onValueChange=\{\(value\) => setActiveTab/);
  });

  it('opens selected services in a detail page with a back button to the card menu', () => {
    assert.match(source, /Kembali ke menu surat/);
    assert.match(source, /onClick=\{\(\) => setActiveServiceId\(null\)\}/);
    assert.match(source, /renderActiveService\(\)/);
  });

  it('keeps admin TU under a single Surat tab with admin tools listed as cards', () => {
    assert.match(source, /PageTabs/);
    assert.match(source, /adminMainTabs: PageTabItem\[\] = \[\{ value: 'surat', label: 'Surat'/);
    assert.match(source, /adminToolCards/);
    assert.match(source, /Pengelolaan Admin TU/);
    assert.doesNotMatch(source, /data-\[state=active\]/);
  });
});
