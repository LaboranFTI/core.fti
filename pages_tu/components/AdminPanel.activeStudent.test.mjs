import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./AdminPanel.tsx', import.meta.url), 'utf8');
const previewDataSource = readFileSync(new URL('../lib/letterPreviewData.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../lib/letterSettings.ts', import.meta.url), 'utf8');

describe('AdminPanel active student detail layout', () => {
  it('removes the unused transcript panel from the active student process view', () => {
    assert.doesNotMatch(source, /Transkrip Nilai/);
    assert.doesNotMatch(source, /selectedRequest\.transcriptBase64/);
    assert.doesNotMatch(source, /title="Transkrip Nilai"/);
  });

  it('uses the available width for the active student letter preview', () => {
    assert.match(source, /grid-cols-1/);
    assert.match(source, /gap-6/);
    assert.match(source, /print:block print:w-full/);
    assert.match(source, /print:m-0 print:p-0/);
    assert.doesNotMatch(source, /xl:grid-cols-12/);
    assert.doesNotMatch(source, /xl:col-span-5/);
    assert.doesNotMatch(source, /xl:col-span-7/);
  });

  it('provides a focused margin editor with live preview for the selected letter type', () => {
    assert.match(source, /selectedLayoutConfigKey/);
    assert.match(source, /setSelectedLayoutConfigKey/);
    assert.match(source, /Margin Area Tulisan \(mm\)/);
    assert.match(source, /Pratinjau Layout Margin Resmi/);
  });

  it('includes research letters in margin configuration and renders the research preview type', () => {
    assert.match(settingsSource, /type LetterLayoutKey = 'activeStudent' \| 'observation' \| 'counseling' \| 'research' \| 'interview' \| 'permission' \| 'suRek'/);
    assert.match(settingsSource, /key:\s*'research'/);
    assert.match(settingsSource, /title:\s*'Surat Penelitian'/);
    assert.match(settingsSource, /description:\s*'Atur batas area tulisan untuk template surat rekomendasi penelitian\.'/);
    assert.match(settingsSource, /research:\s*getDefaultLetterLayout\('research'\)/);
    assert.match(settingsSource, /research:\s*\{\s*\.\.\.getDefaultLetterLayout\('research'\),\s*\.\.\.layouts\?\.research\s*\}/);
    assert.match(source, /selectedPreviewType/);
    assert.match(source, /type=\{selectedPreviewType\}/);
  });

  it('keeps research assignment and advisor labels as admin-managed defaults', () => {
    assert.match(source, /DEFAULT_RESEARCH_ASSIGNMENT_TYPE/);
    assert.match(source, /tempResearchAssignmentType/);
    assert.match(source, /tempResearchAdvisorTitle/);
    assert.match(source, /tempResearchAdvisorTitleFirst/);
    assert.match(source, /tempResearchAdvisorTitleSecond/);
    assert.match(source, /id="researchAssignmentType"/);
    assert.match(source, /id="researchAdvisorTitle"/);
    assert.match(source, /id="researchAdvisorTitleFirst"/);
    assert.match(source, /id="researchAdvisorTitleSecond"/);
    assert.match(source, /researchAssignmentType:\s*tempResearchAssignmentType/);
    assert.match(source, /researchAdvisorTitle:\s*tempResearchAdvisorTitle/);
  });

  it('places background settings beside semester and separates margin preview into its own card', () => {
    assert.match(source, /Semester Berjalan/);
    assert.match(source, /Background Surat/);
    assert.match(source, /xl:col-span-2/);
    assert.match(source, /Pengaturan & Pratinjau Margin Surat/);
    assert.match(source, /Atur batas area tulisan, konten default surat, dan tembusan sambil melihat preview surat/);
    assert.match(source, /Pilih jenis surat/);
  });

  it('keeps default recommendation carbon copy editing inside the margin configuration panel', () => {
    assert.match(source, /selectedLayoutConfigKey === 'suRek'/);
    assert.match(source, /Tembusan Default/);
    assert.match(source, /tempSuRekTembusan/);
    assert.match(source, /Tembusan ini otomatis masuk ke pengajuan rekomendasi baru dan tampil di preview/);
  });

  it('keeps recommendation content settings in the same recommendation layout panel', () => {
    assert.match(source, /Konten Surat Rekomendasi/);
    assert.match(source, /Nilai default ini dipakai pada pengajuan rekomendasi baru dan langsung terlihat di preview/);
    assert.match(source, /id="suRekYangTerhormat"/);
    assert.match(source, /id="suRekBerdasarkanNo"/);
    assert.match(source, /id="suRekLampiran"/);
    assert.match(source, /id="suRekPerihal"/);
    assert.doesNotMatch(source, />\s*Konfigurasi Surat Rekomendasi\s*</);
  });

  it('uses official preview letter numbers and developer sample identities in margin preview', () => {
    assert.match(previewDataSource, /formatPreviewLetterNumber/);
    assert.match(previewDataSource, /Firmandez Febrian Afandy/);
    assert.match(previewDataSource, /682022013/);
    assert.match(previewDataSource, /Nauval Caesaro Premana/);
    assert.match(previewDataSource, /682021062/);
    assert.doesNotMatch(previewDataSource, /Dean\/FTI/);
  });
});
