import { describe, expect, it } from 'vitest'
import { extractSfcUiBlocks } from '../../scripts/lib/sfc-ui-blocks.mjs'

const nestedSfc = `<script setup lang="ts">
const label = '</template> inside script must not end the root block'
</script>
<template>
  <section>
    <Widget>
      <template #default="{ row }">
        <strong>{{ row.name }}</strong>
      </template>
    </Widget>
    <button>after nested template</button>
  </section>
</template>
<style scoped>.one { color: red; }</style>
<style>.two { color: blue; }</style>`

describe('SFC UI block extraction', () => {
  it('keeps content after a nested slot template in the root template fingerprint', () => {
    const [template] = extractSfcUiBlocks(nestedSfc)
    expect(template).toContain('<template #default="{ row }">')
    expect(template).toContain('<button>after nested template</button>')
  })

  it('detects a mutation after the first nested template closes', () => {
    const mutated = nestedSfc.replace('after nested template', 'mutated after nested template')
    expect(extractSfcUiBlocks(mutated)).not.toEqual(extractSfcUiBlocks(nestedSfc))
  })

  it('includes every root style block and ignores template-like script text', () => {
    const blocks = extractSfcUiBlocks(nestedSfc)
    expect(blocks).toHaveLength(3)
    expect(blocks[1]).toContain('.one')
    expect(blocks[2]).toContain('.two')
  })

  it('fails closed when the root template is missing or unclosed', () => {
    expect(() => extractSfcUiBlocks('<script setup>const x = 1</script>')).toThrow(
      'Expected exactly one root <template> block',
    )
    expect(() => extractSfcUiBlocks('<template><div></div>')).toThrow(
      'SFC <template> block is not closed',
    )
  })
})
