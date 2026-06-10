import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summarizeSoapResponse } from './siasatDiagnostics.js';

test('summarizeSoapResponse identifies an empty successful ASMX response', () => {
  const parsedBody = {
    'soap:Envelope': {
      'soap:Body': {
        GetNamaMhsResponse: '',
      },
    },
  };

  const summary = summarizeSoapResponse({
    xmlText: '<soap:Envelope><soap:Body><GetNamaMhsResponse /></soap:Body></soap:Envelope>',
    parsedBody,
    operation: 'GetNamaMhs',
    resultNodeName: 'GetNamaMhsResult',
    dataNodeName: 'listmhs',
  });

  assert.equal(summary.operationResponsePresent, true);
  assert.equal(summary.resultNode.type, 'missing');
  assert.equal(summary.dataNode.type, 'missing');
  assert.equal(summary.isEmptySuccessResponse, true);
  assert.equal(summary.hasSoapFault, false);
});

test('summarizeSoapResponse reports result and row shape without exposing values', () => {
  const parsedBody = {
    'soap:Envelope': {
      'soap:Body': {
        GetKartuStudiResponse: {
          GetKartuStudiResult: {
            'diffgr:diffgram': {
              datakst: {
                listmhskst: [
                  { kodemkl: 'IN123', namamkl: 'Private course name' },
                  { kodemkl: 'IN456', namamkl: 'Another private course name' },
                ],
              },
            },
          },
        },
      },
    },
  };

  const summary = summarizeSoapResponse({
    xmlText: '<xml>private values</xml>',
    parsedBody,
    operation: 'GetKartuStudi',
    resultNodeName: 'GetKartuStudiResult',
    dataNodeName: 'listmhskst',
  });

  assert.equal(summary.isEmptySuccessResponse, false);
  assert.equal(summary.dataNode.type, 'array');
  assert.equal(summary.dataNode.count, 2);
  assert.deepEqual(summary.dataNode.itemKeys, ['kodemkl', 'namamkl']);
  assert.equal(JSON.stringify(summary).includes('Private course name'), false);
});
