function findTagEnd(source, start) {
  let quote = null
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (char === quote && source[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '>') return index
  }
  throw new Error(`SFC tag starting at offset ${start} is not closed`)
}

function readTag(source, start) {
  if (source.startsWith('<!--', start)) {
    const end = source.indexOf('-->', start + 4)
    if (end < 0) throw new Error(`SFC comment starting at offset ${start} is not closed`)
    return { kind: 'comment', end: end + 2 }
  }

  const end = findTagEnd(source, start)
  const raw = source.slice(start + 1, end)
  const match = raw.match(/^\s*(\/)?\s*([A-Za-z][\w:-]*)/)
  if (!match) return { kind: 'other', end }
  return {
    kind: 'tag',
    name: match[2].toLowerCase(),
    closing: Boolean(match[1]),
    selfClosing: /\/\s*$/.test(raw),
    end,
  }
}

function findRawElementEnd(source, openingTag, tagName) {
  const closingPattern = new RegExp(`</${tagName}\\s*>`, 'ig')
  closingPattern.lastIndex = openingTag.end + 1
  const closing = closingPattern.exec(source)
  if (!closing) throw new Error(`SFC <${tagName}> block is not closed`)
  return closing.index + closing[0].length
}

function findTemplateEnd(source, openingTag) {
  let depth = 1
  let cursor = openingTag.end + 1
  while (cursor < source.length) {
    const start = source.indexOf('<', cursor)
    if (start < 0) break
    const tag = readTag(source, start)
    cursor = tag.end + 1
    if (tag.kind !== 'tag') continue

    if (!tag.closing && (tag.name === 'script' || tag.name === 'style')) {
      cursor = findRawElementEnd(source, tag, tag.name)
      continue
    }
    if (tag.name !== 'template') continue
    if (tag.closing) {
      depth -= 1
      if (depth === 0) return cursor
    } else if (!tag.selfClosing) {
      depth += 1
    }
  }
  throw new Error('SFC <template> block is not closed')
}

/**
 * Extract the complete root template and every root style block from a Vue SFC.
 * Nested slot templates are counted, so content after their closing tag remains
 * part of the template fingerprint.
 */
export function extractSfcUiBlocks(source) {
  const templates = []
  const styles = []
  let cursor = 0

  while (cursor < source.length) {
    const start = source.indexOf('<', cursor)
    if (start < 0) break
    const tag = readTag(source, start)
    cursor = tag.end + 1
    if (tag.kind !== 'tag' || tag.closing || tag.selfClosing) continue

    let end
    if (tag.name === 'template') end = findTemplateEnd(source, tag)
    else if (tag.name === 'style' || tag.name === 'script') end = findRawElementEnd(source, tag, tag.name)
    else continue

    const block = source.slice(start, end)
    if (tag.name === 'template') templates.push(block)
    if (tag.name === 'style') styles.push(block)
    cursor = end
  }

  if (templates.length !== 1) {
    throw new Error(`Expected exactly one root <template> block, found ${templates.length}`)
  }
  return [...templates, ...styles]
}
