import assert from 'node:assert/strict';
import test from 'node:test';
import { checkHandwrittenMath } from '../src/lib/checkHandwrittenMath.js';

test('handwritten LaTeX gets the missing middle term feedback', () => {
  const result = checkHandwrittenMath(String.raw`\left(x+y\right) ^ { 2 } = x ^ { 2 } + y ^ { 2 }`);
  assert.equal(result.issueTitle, 'Missing the middle term');
  assert.match(result.hint, /2xy/);
  assert.equal(checkHandwrittenMath('(x+y)^{2}=x^{2}+2xy+y^{2}').errorFound, false);
});

test('checks equivalent polynomial and arithmetic steps', () => {
  assert.equal(checkHandwrittenMath('3(a+2)=3a+6').errorFound, false);
  assert.equal(checkHandwrittenMath('8+2=11').errorFound, true);
  assert.equal(checkHandwrittenMath('(a+b)^2=a^2+b^2+2ab').errorFound, false);
});

test('unreadable or unsupported math does not get a correctness verdict', () => {
  assert.equal(checkHandwrittenMath('x+y').errorFound, undefined);
  assert.equal(checkHandwrittenMath(String.raw`\sqrt{x}=2`).errorFound, undefined);
});
