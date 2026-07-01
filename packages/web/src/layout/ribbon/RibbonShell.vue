<script setup lang="ts">
import { useRouter } from 'vue-router'
import PnwRibbonShell from 'phoenix-wing/layout/PnwRibbonShell.vue'
import PnwRibbonGroup from 'phoenix-wing/layout/PnwRibbonGroup.vue'
import PnwRibbonToolButton from 'phoenix-wing/layout/PnwRibbonToolButton.vue'
import type { PnwRibbonGroupItem } from 'phoenix-wing/layout/PnwRibbonGroup.vue'
import { RIBBON_TABS } from './ribbonConfig'
import { Menu } from '@element-plus/icons-vue'

defineProps<{ collapsed: boolean }>()
const router = useRouter()

function open(pageId: string) {
  router.push(`/${pageId}`)
}
</script>

<template>
  <PnwRibbonShell :collapsed="collapsed">
    <template v-for="tab in RIBBON_TABS" :key="tab.id">
      <PnwRibbonGroup
        v-for="group in tab.groups"
        :key="group.id"
        :label="group.label"
        :items="group.items.map(i => ({
          pageId: i.pageId,
          label: i.label || i.pageId,
          icon: Menu,
          active: false,
          disabled: false,
          title: i.label || i.pageId,
        }))"
        @open="open"
      />
    </template>
  </PnwRibbonShell>
</template>
