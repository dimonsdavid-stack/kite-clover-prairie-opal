import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOrigin, assertRole } from './access-policy.ts';
test('wallet/user identity never grants operator, treasury, guardian or agent authority', () => {
  for (const role of ['operator','treasury','guardian','agent'] as const) assert.throws(() => assertRole(role,'wallet:0x1',[]));
  assert.doesNotThrow(() => assertRole('user','verified-user',[]));
  assert.throws(() => assertRole('user',null,[]));
  assert.throws(() => assertRole('treasury','operator',['operator']));
});
test('cross-site, sibling-origin and originless cookie mutations are rejected', () => {
  for (const headers of [{origin:'https://evil.example'}, {'sec-fetch-site':'cross-site'}, {cookie:'session=1'}]) {
    assert.throws(() => assertOrigin(new Request('https://arclenos.com/api',{method:'POST',headers: Object.fromEntries(Object.entries(headers).filter(([,v]) => typeof v === 'string')) as Record<string,string>})));
  }
  assert.doesNotThrow(() => assertOrigin(new Request('https://arclenos.com/api',{method:'POST',headers:{origin:'https://arclenos.com'}})));
});
