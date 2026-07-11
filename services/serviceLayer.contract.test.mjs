import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const apiBarrelSource = read('./api.ts');
const httpClientSource = read('./httpClient.ts');
const inventoryServiceSource = read('./inventoryService.ts');
const loanServiceSource = read('./loanService.ts');
const staffServiceSource = read('./staffService.ts');
const pklServiceSource = read('./pklService.ts');
const useInventorySource = read('../hooks/useInventory.ts');
const inventoryPageSource = read('../pages/Inventaris.tsx');
const loansPageSource = read('../pages/PeminjamanBarang.tsx');
const staffPageSource = read('../pages/ManajemenLaboran.tsx');
const pklPageSource = read('../pages/ManajemenPKL.tsx');

describe('service layer contracts', () => {
  it('keeps services/api as a compatibility barrel over the shared HTTP client', () => {
    assert.match(apiBarrelSource, /export \{ api, default \} from '\.\/httpClient'/);
    assert.match(apiBarrelSource, /export \{ loansApi \} from '\.\/loanService'/);
    assert.match(apiBarrelSource, /export \{ inventoryApi \} from '\.\/inventoryService'/);
    assert.match(apiBarrelSource, /export \{ staffApi \} from '\.\/staffService'/);
    assert.match(apiBarrelSource, /export \{ pklApi \} from '\.\/pklService'/);

    assert.doesNotMatch(apiBarrelSource, /API_BASE_URL/);
    assert.doesNotMatch(apiBarrelSource, /refreshPromise/);
    assert.match(httpClientSource, /API_BASE_URL/);
    assert.match(httpClientSource, /auth:unauthorized/);
    assert.match(httpClientSource, /data instanceof FormData/);
  });

  it('preserves inventory, loan, staff, and PKL endpoint contracts', () => {
    assert.match(inventoryServiceSource, /list:\s*\(\)\s*=>\s*api\('\/api\/inventory'\)/);
    assert.match(inventoryServiceSource, /create:\s*\(data:[\s\S]*api\('\/api\/inventory',\s*\{\s*method:\s*'POST',\s*data\s*\}\)/);
    assert.match(inventoryServiceSource, /api\(`\/api\/inventory\/\$\{id\}`,\s*\{\s*method:\s*'PUT',\s*data\s*\}\)/);
    assert.match(inventoryServiceSource, /api\(`\/api\/inventory\/\$\{id\}`,\s*\{\s*method:\s*'DELETE'\s*\}\)/);

    assert.match(loanServiceSource, /list:\s*\(\)\s*=>\s*api\('\/api\/loans'\)/);
    assert.match(loanServiceSource, /api\(`\/api\/loans\/group\/\$\{transactionId\}`,\s*\{\s*method:\s*'PUT',\s*data\s*\}\)/);
    assert.match(loanServiceSource, /api\('\/api\/loans\/return',\s*\{\s*method:\s*'PUT',\s*data\s*\}\)/);
    assert.match(loanServiceSource, /type DeleteLoansPayload = string\[\] \| \{ loanIds: string\[\] \}/);
    assert.match(loanServiceSource, /Array\.isArray\(payload\)/);
    assert.match(loanServiceSource, /api\('\/api\/loans\/group',\s*\{\s*method:\s*'DELETE',\s*data:\s*\{\s*loanIds\s*\}\s*\}\)/);

    assert.match(staffServiceSource, /list:\s*\(\)\s*=>\s*api\('\/api\/staff'\)/);
    assert.match(staffServiceSource, /listRoomsForAssignment:\s*\(\)\s*=>\s*api\('\/api\/rooms\?exclude_image=true'\)/);
    assert.match(staffServiceSource, /api\(`\/api\/staff\/\$\{id\}`,\s*\{\s*method:\s*'PUT',\s*data\s*\}\)/);
    assert.match(staffServiceSource, /api\('\/api\/staff',\s*\{\s*method:\s*'POST',\s*data\s*\}\)/);
    assert.match(staffServiceSource, /api\(`\/api\/staff\/\$\{id\}`,\s*\{\s*method:\s*'DELETE'\s*\}\)/);

    assert.match(pklServiceSource, /list:\s*\(\)\s*=>\s*api\('\/api\/pkl'\)/);
    assert.match(pklServiceSource, /api\('\/api\/pkl',\s*\{\s*method:\s*'POST',\s*data:\s*\{\s*students\s*\}\s*\}\)/);
    assert.match(pklServiceSource, /api\(`\/api\/pkl\/\$\{id\}`,\s*\{\s*method:\s*'PUT',\s*data\s*\}\)/);
    assert.match(pklServiceSource, /api\(`\/api\/pkl\/\$\{id\}`,\s*\{\s*method:\s*'DELETE'\s*\}\)/);
    assert.match(pklServiceSource, /api\(`\/api\/pkl\/\$\{id\}\/document`\)/);
  });

  it('routes migrated inventory, loan, staff, and PKL screens through domain services', () => {
    for (const source of [
      useInventorySource,
      inventoryPageSource,
      loansPageSource,
      staffPageSource,
      pklPageSource,
    ]) {
      assert.doesNotMatch(source, /services\/api/);
    }

    assert.match(useInventorySource, /inventoryApi\.list\(\)/);
    assert.match(inventoryPageSource, /inventoryApi\.(create|update|delete)/);
    assert.match(loansPageSource, /loansApi\.(list|create|updateGroup|returnBulk|deleteGroup)/);
    assert.match(loansPageSource, /staffApi\.list\(\)/);
    assert.match(staffPageSource, /staffApi\.(list|listRoomsForAssignment|create|update|delete)/);
    assert.match(pklPageSource, /pklApi\.(list|create|update|delete|downloadDocument)/);
    assert.match(pklPageSource, /staffApi\.list\(\)/);
  });
});
