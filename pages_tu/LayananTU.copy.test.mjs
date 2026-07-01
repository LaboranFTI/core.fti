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

  it('groups letter cards into Tata Usaha and Tugas Akhir category tabs', () => {
    assert.match(source, /type LetterCategoryId = 'tata-usaha' \| 'tugas-akhir'/);
    assert.match(source, /Surat Tata Usaha/);
    assert.match(source, /Surat Tugas Akhir/);
    assert.match(source, /category: 'tata-usaha'/);
    assert.match(source, /category: 'tugas-akhir'/);
    assert.match(source, /renderLetterCategoryGrid/);
  });

  it('prepares future final-project letters as disabled cards', () => {
    assert.match(source, /Permohonan Wawancara/);
    assert.match(source, /Surat Perizinan/);
    assert.match(source, /status: 'soon'/);
    assert.match(source, /disabled=\{isComingSoon\}/);
    assert.match(source, /Segera tersedia/);
  });

  it('opens selected services in a detail page with a back button to the card menu', () => {
    assert.match(source, /Kembali ke menu surat/);
    assert.match(source, /onClick=\{\(\) => setActiveServiceId\(null\)\}/);
    assert.match(source, /renderActiveService\(\)/);
  });

  it('keeps admin TU tools outside the letter category tabs', () => {
    assert.match(source, /PageTabs/);
    assert.match(source, /adminMainTabs: PageTabItem\[\] = \[/);
    assert.match(source, /\{ value: 'surat', label: 'Surat'/);
    assert.match(source, /\{ value: 'permohonan', label: 'Kelola Permohonan'/);
    assert.match(source, /\{ value: 'arsip', label: 'Arsip Surat'/);
    assert.match(source, /\{ value: 'konfigurasi', label: 'Konfigurasi Surat'/);
    assert.doesNotMatch(source, /data-\[state=active\]/);
  });
});
