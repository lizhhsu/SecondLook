export function checkBinomialSquare(text) {
  const equation = text.trim().replaceAll('²', '^2').replace(/\s+/g, '');
  if (/^\(x\+y\)\^2=x\^2\+y\^2[.!]?$/.test(equation)) {
    return {
      errorFound: true,
      issueTitle: 'Missing the middle term',
      category: 'Conceptual',
      explanation: 'Squaring the sum means multiplying (x + y)(x + y). The two cross products, xy and yx, add up to 2xy.',
      hint: 'The correct expansion is (x + y)² = x² + 2xy + y².',
      incorrectSnippet: '(x + y)² = x² + y²',
    };
  }
  if (/^\(x\+y\)\^2=x\^2\+2(?:\*)?xy\+y\^2[.!]?$/.test(equation)) {
    return {
      errorFound: false,
      issueTitle: 'Correct expansion',
      category: 'Correct',
      explanation: 'You included 2xy, the sum of the two cross products.',
    };
  }
  return null;
}
