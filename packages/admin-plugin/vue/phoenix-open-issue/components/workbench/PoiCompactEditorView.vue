<script setup lang="ts">
import PnwPageLayout from 'phoenix-wing/layout/PnwPageLayout.vue'

withDefaults(defineProps<{
  title: string
  subtitle?: string
  eyebrow?: string
  summary?: string
  description?: string
  toolbar?: boolean
  contentAriaLabel?: string
}>(), {
  toolbar: true,
})
</script>

<template>
  <PnwPageLayout
    class="poi-compact-editor-view"
    :title="title"
    :subtitle="subtitle"
    :eyebrow="eyebrow"
    :summary="summary"
    :description="description"
    :toolbar="toolbar"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <template v-if="$slots.help" #help>
      <slot name="help" />
    </template>

    <div class="poi-compact-editor-view__body" :aria-label="contentAriaLabel">
      <slot />
    </div>
  </PnwPageLayout>
</template>
