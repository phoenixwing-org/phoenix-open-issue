<script setup lang="ts">
import type { RepairTaskResult } from '/$/phoenix-open-issue/api/maintenance'

defineProps<{
  results: readonly RepairTaskResult[]
}>()
</script>

<template>
  <div class="poi-settings-repair-bottom">
    <el-empty v-if="!results.length" description="尚未执行数据库修正" :image-size="44" />
    <div v-for="result in results" v-else :key="result.task" class="poi-repair-result">
      <el-tag type="success" size="small">{{ result.message }}</el-tag>
      <ul v-if="result.details.length">
        <li v-for="(line, index) in result.details" :key="index">{{ line }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.poi-settings-repair-bottom {
  height: 100%;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 12px 16px;
}
.poi-repair-result {
  font-size: 12px;
}
.poi-repair-result ul {
  margin: 6px 0 0;
  padding-left: 18px;
  color: var(--pnw-workbench-muted, #64748b);
}
</style>
