<script setup lang="ts">
import { computed, ref } from 'vue'
import PnwRibbonShell from 'phoenix-wing/layout/PnwRibbonShell.vue'
import PnwRibbonGroup from 'phoenix-wing/layout/PnwRibbonGroup.vue'
import PnwRibbonToolButton from 'phoenix-wing/layout/PnwRibbonToolButton.vue'
import { pnwRibbonIconFor } from 'phoenix-wing'
import { RIBBON_TABS } from './ribbonConfig'
import { List } from '@element-plus/icons-vue'

const props = defineProps<{ collapsed: boolean; activeTab: string }>()
const emit = defineEmits<{ open: [pageId: string] }>()

const layout = ref<'stacked' | 'inline'>('stacked')

const activeTabDef = computed(() =>
  RIBBON_TABS.find(t => t.id === props.activeTab) ?? RIBBON_TABS[0]
)
</script>

<template>
  <PnwRibbonShell :collapsed="collapsed" :layout="layout" @update:layout="layout = $event">
    <PnwRibbonGroup
      v-for="group in activeTabDef.groups"
      :key="group.id"
      :label="group.label"
      :layout="layout"
      :items="group.items.map(i => ({
        pageId: i.pageId,
        label: i.label || i.pageId,
        icon: pnwRibbonIconFor(i.pageId) ?? List,
        active: false,
        disabled: false,
        title: i.label || i.pageId,
      }))"
      @open="emit('open', $event)"
    />
  </PnwRibbonShell>
</template>
