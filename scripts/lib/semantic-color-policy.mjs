const semanticPropertyPattern = /(?:^|[;{"'\s])((?:color|background(?:-color)?|border(?:-[\w-]+)?|outline|box-shadow))\s*:\s*([^;}\n]+)/gim
const standaloneColorPattern = /(['"])(#[0-9a-f]{3,8}|rgba?\([^'"\n]+\))\1/gi
const colorLiteralPattern = /#[0-9a-f]{3,8}\b|rgba?\(/i

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split('\n').length
}

/** Return semantic color violations that are not wrapped by a Host CSS token. */
export function findRawSemanticColors(source) {
  const violations = []
  for (const match of source.matchAll(semanticPropertyPattern)) {
    const value = match[2].trim()
    if (colorLiteralPattern.test(value) && !value.includes('var(--')) {
      violations.push({
        line: lineNumberAt(source, match.index),
        property: match[1],
        value,
      })
    }
  }

  for (const match of source.matchAll(standaloneColorPattern)) {
    violations.push({
      line: lineNumberAt(source, match.index),
      property: 'script/template color literal',
      value: match[2],
    })
  }
  return violations
}
