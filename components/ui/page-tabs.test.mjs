import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./page-tabs.tsx', import.meta.url), 'utf8');

describe('PageTabs reusable navigation tabs', () => {
  it('renders tab items through the shared Tabs primitives', () => {
    assert.match(source, /export interface PageTabItem/);
    assert.match(source, /TabsList/);
    assert.match(source, /TabsTrigger/);
    assert.match(source, /items\.map/);
  });

  it('provides a reusable active tab summary component', () => {
    assert.match(source, /export function PageTabSummary/);
    assert.match(source, /title/);
    assert.match(source, /description/);
  });
});
