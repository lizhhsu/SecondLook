import nerdamer from 'nerdamer';
import { checkBinomialSquare } from './binomialSquare.js';

export function checkHandwrittenMath(latex) {
  const equation = latex
    .replace(/\\(?:left|right)\b/g, '')
    .replace(/\\(?:times|cdot)\b/g, '*')
    .replace(/\^\s*\{\s*([0-5])\s*\}/g, '^$1')
    .replaceAll('²', '^2')
    .replace(/\s+/g, '');
  const knownResult = checkBinomialSquare(equation);
  if (knownResult) return { ...knownResult, transcription: equation };

  const unverified = {
    issueTitle: 'Review the recognized equation',
    category: 'Needs review',
    transcription: equation,
    explanation: 'Select one complete arithmetic equation or polynomial rewrite to check it.',
  };
  const terms = equation.split('=');
  if (equation.length > 100 || terms.length !== 2 || !terms.every(isSupported)) return unverified;

  try {
    const [left, right] = terms.map(term => nerdamer.expand(explicitMultiplication(term)).text());
    const equivalent = nerdamer.expand(`(${left})-(${right})`).text() === '0';
    if (equivalent) {
      return {
        errorFound: false,
        issueTitle: 'Equivalent expressions',
        category: 'Correct',
        transcription: equation,
        explanation: 'Both sides simplify to the same expression.',
      };
    }
    return {
      errorFound: true,
      issueTitle: 'The two sides simplify differently',
      category: 'Algebra',
      transcription: equation,
      explanation: 'If this step rewrites an expression, both sides should simplify to the same terms.',
      hint: `The left side simplifies to ${left} and the right side to ${right}. Check distribution and combine like terms.`,
    };
  } catch {
    return unverified;
  }
}

function isSupported(term) {
  if (!/^[0-9a-z()+*.^-]+$/.test(term) || (term.match(/[+-]/g) || []).length > 5) return false;
  // Bound the size of expansions before passing the expression to the algebra engine.
  const powers = term.match(/\^[0-5](?![.\d])/g) || [];
  return powers.length <= 2 && powers.length === (term.match(/\^/g) || []).length;
}

function explicitMultiplication(term) {
  return term.replace(/([0-9a-z)])(?=[a-z(])/g, '$1*').replace(/\)(?=\d)/g, ')*');
}
