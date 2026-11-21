import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBinomialSquare } from '../src/lib/binomialSquare.js';

test('the demo expansion flags the missing cross term', () => {
  for (const equation of ['(x+y)^2 = x^2+y^2', '(x + y)² = x² + y²']) {
    const feedback = checkBinomialSquare(equation);
    assert.equal(feedback.errorFound, true);
    assert.match(feedback.hint, /x² \+ 2xy \+ y²/);
  }
});

test('the corrected expansion passes and unrelated work is left to the screen checker', () => {
  assert.equal(checkBinomialSquare('(x+y)^2 = x^2 + 2xy + y^2').errorFound, false);
  assert.equal(checkBinomialSquare('(x+y)^2'), null);
  assert.equal(checkBinomialSquare('(x+y)^2 = x^2 + y^2 + 2xy'), null);
});
