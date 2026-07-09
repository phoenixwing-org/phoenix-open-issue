<script setup lang="ts">
import { computed } from 'vue'
import { ATTENTION_LEVEL_LABELS } from '@open-issue/core'
import type { AttentionLevel } from '@open-issue/core'

const props = withDefaults(defineProps<{
  modelValue: number
  readonly?: boolean
  showLabel?: boolean
  size?: 'default' | 'small'
}>(), {
  readonly: false,
  showLabel: false,
  size: 'default',
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const level = computed({
  get: () => props.modelValue,
  set: (v: number) => emit('update:modelValue', v ?? 0),
})

const label = computed(() =>
  ATTENTION_LEVEL_LABELS[(props.modelValue ?? 0) as AttentionLevel] ?? '',
)

function clear() {
  level.value = 0
}
</script>

<template>
  <div class="attention-stars" :class="{ readonly, [`size-${size}`]: true }">
    <el-rate
      v-model="level"
      :max="5"
      :disabled="readonly"
      clearable
      :void-color="modelValue === 0 ? '#dcdfe6' : '#c0c4cc'"
      :colors="['#f7ba2a', '#f7ba2a', '#f7ba2a']"
    />
    <span v-if="showLabel" class="attention-label">{{ label }}</span>
    <button
      v-if="!readonly && modelValue > 0"
      type="button"
      class="attention-clear"
      @click="clear"
    >不关注</button>
  </div>
</template>

<style scoped>
.attention-stars {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.attention-label {
  font-size: 0.82rem;
  color: #909399;
}
.attention-clear {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.78rem;
  color: #909399;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.attention-clear:hover { color: #409eff; }
.attention-stars.readonly { cursor: inherit; }
.size-small :deep(.el-rate) { height: auto; }
.size-small :deep(.el-rate__icon) { font-size: 14px; margin-right: 2px; }
</style>
