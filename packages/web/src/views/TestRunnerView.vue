<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  checkListAccess, canManageList, canDeleteList, canAddMember,
  canModifyIssue, canCreateIssue, canEditOwnIssue,
  validatePush, resolveOverlap, canPushToList, canHandlePush,
  isOverdue, calculateNextCheckpoint,
} from '@open-issue/core'

// ── 测试用例定义 ──
interface TestCase {
  id: string; group: string; name: string
  run: () => { pass: boolean; expected: any; actual: any }
}
interface TestResult extends TestCase {
  status: 'idle' | 'pass' | 'fail'
  expected: any; actual: any; duration: number
}

function defineTests(): TestCase[] {
  const membersA = [
    { userId: 'u1', role: 'owner' as const },
    { userId: 'u2', role: 'editor' as const },
  ]
  const membersB = [
    { userId: 'u2', role: 'editor' as const },
    { userId: 'u3', role: 'viewer' as const },
  ]
  const membersC = [
    { userId: 'u4', role: 'editor' as const },
    { userId: 'u5', role: 'viewer' as const },
  ]

  return [
    // ── 权限算法 ──
    { id: 'perm-01', group: '权限', name: 'checkListAccess 找到成员返回角色',
      run: () => ({ pass: checkListAccess('u1', membersA) === 'owner', expected: 'owner', actual: checkListAccess('u1', membersA) }) },
    { id: 'perm-02', group: '权限', name: 'checkListAccess 非成员返回 null',
      run: () => ({ pass: checkListAccess('u9', membersA) === null, expected: null, actual: checkListAccess('u9', membersA) }) },
    { id: 'perm-03', group: '权限', name: 'canManageList owner 可管理',
      run: () => ({ pass: canManageList('owner') === true, expected: true, actual: canManageList('owner') }) },
    { id: 'perm-04', group: '权限', name: 'canManageList viewer 不可管理',
      run: () => ({ pass: canManageList('viewer') === false, expected: false, actual: canManageList('viewer') }) },
    { id: 'perm-05', group: '权限', name: 'canDeleteList 仅 owner 可删除',
      run: () => {
        const a = canDeleteList('owner'); const b = canDeleteList('admin')
        const c = canDeleteList('editor'); const d = canDeleteList(null)
        return { pass: a && !b && !c && !d, expected: 'owner only', actual: { owner: a, admin: b, editor: c, null: d } }
      } },
    { id: 'perm-06', group: '权限', name: 'canModifyIssue editor 可修改',
      run: () => ({ pass: canModifyIssue('editor') === true, expected: true, actual: canModifyIssue('editor') }) },
    { id: 'perm-07', group: '权限', name: 'canCreateIssue reporter 可创建',
      run: () => ({ pass: canCreateIssue('reporter') === true, expected: true, actual: canCreateIssue('reporter') }) },
    { id: 'perm-08', group: '权限', name: 'canEditOwnIssue viewer 不可编辑',
      run: () => ({ pass: canEditOwnIssue('viewer') === false, expected: false, actual: canEditOwnIssue('viewer') }) },

    // ── 推送算法 ──
    { id: 'push-01', group: '推送', name: 'resolveOverlap 找出共同成员',
      run: () => {
        const r = resolveOverlap(membersA, membersB)
        return { pass: r.length === 1 && r[0] === 'u2', expected: ['u2'], actual: r }
      } },
    { id: 'push-02', group: '推送', name: 'resolveOverlap 无共同成员返回空',
      run: () => {
        const r = resolveOverlap(membersA, membersC)
        return { pass: r.length === 0, expected: [], actual: r }
      } },
    { id: 'push-03', group: '推送', name: 'validatePush 有共同成员返回可推送',
      run: () => {
        const r = validatePush({ fromMembers: membersA, toMembers: membersB })
        return { pass: r.canPush === true && r.valid === true, expected: 'canPush=true', actual: r }
      } },
    { id: 'push-04', group: '推送', name: 'validatePush 无共同成员返回不可推送',
      run: () => {
        const r = validatePush({ fromMembers: membersA, toMembers: membersC })
        return { pass: r.canPush === false, expected: 'canPush=false', actual: r }
      } },
    { id: 'push-05', group: '推送', name: 'canPushToList 有角色且有交集',
      run: () => ({ pass: canPushToList('editor', true) === true, expected: true, actual: canPushToList('editor', true) }) },
    { id: 'push-06', group: '推送', name: 'canPushToList 无交集不可推送',
      run: () => ({ pass: canPushToList('owner', false) === false, expected: false, actual: canPushToList('owner', false) }) },
    { id: 'push-07', group: '推送', name: 'canHandlePush pending 状态 admin 可处理',
      run: () => {
        const r = canHandlePush('u1', { toListId: 'L2', status: 'pending' }, [{ userId: 'u1', role: 'admin' as const }])
        return { pass: r === true, expected: true, actual: r }
      } },
    { id: 'push-08', group: '推送', name: 'canHandlePush 非 pending 状态不可处理',
      run: () => {
        const r = canHandlePush('u1', { toListId: 'L2', status: 'accepted' }, [{ userId: 'u1', role: 'admin' as const }])
        return { pass: r === false, expected: false, actual: r }
      } },

    // ── 调度算法 ──
    { id: 'sched-01', group: '调度', name: 'isOverdue 已过日期 pending → 逾期',
      run: () => {
        const r = isOverdue('2026-01-01', 'pending', new Date('2026-06-30'))
        return { pass: r.overdue === true && r.daysOverdue > 100, expected: 'overdue=true', actual: r }
      } },
    { id: 'sched-02', group: '调度', name: 'isOverdue done 状态永不过期',
      run: () => {
        const r = isOverdue('2020-01-01', 'done', new Date('2026-06-30'))
        return { pass: r.overdue === false && r.daysOverdue === 0, expected: 'overdue=false', actual: r }
      } },
    { id: 'sched-03', group: '调度', name: 'isOverdue skipped 状态不过期',
      run: () => {
        const r = isOverdue('2020-01-01', 'skipped', new Date('2026-06-30'))
        return { pass: r.overdue === false, expected: 'overdue=false', actual: r }
      } },
    { id: 'sched-04', group: '调度', name: 'isOverdue 未来日期不过期',
      run: () => {
        const r = isOverdue('2030-01-01', 'pending', new Date('2026-06-30'))
        return { pass: r.overdue === false, expected: 'overdue=false', actual: r }
      } },
    { id: 'sched-05', group: '调度', name: 'calculateNextCheckpoint daily +3',
      run: () => {
        const d = calculateNextCheckpoint(new Date('2026-01-01'), { frequency: 'daily', interval: 3 })
        return { pass: d.toISOString().slice(0, 10) === '2026-01-04', expected: '2026-01-04', actual: d.toISOString().slice(0, 10) }
      } },
    { id: 'sched-06', group: '调度', name: 'calculateNextCheckpoint weekly +2',
      run: () => {
        const d = calculateNextCheckpoint(new Date('2026-01-01'), { frequency: 'weekly', interval: 2 })
        return { pass: d.toISOString().slice(0, 10) === '2026-01-15', expected: '2026-01-15', actual: d.toISOString().slice(0, 10) }
      } },
    { id: 'sched-07', group: '调度', name: 'calculateNextCheckpoint monthly +1',
      run: () => {
        const d = calculateNextCheckpoint(new Date('2026-01-15'), { frequency: 'monthly', interval: 1 })
        return { pass: d.toISOString().slice(0, 10) === '2026-02-15', expected: '2026-02-15', actual: d.toISOString().slice(0, 10) }
      } },
  ]
}

const allTests = defineTests()
const results = ref<Map<string, TestResult>>(new Map())
const running = ref(false)
const runAll = ref(true)

const summary = computed(() => {
  const items = Array.from(results.value.values())
  const pass = items.filter(r => r.status === 'pass').length
  const fail = items.filter(r => r.status === 'fail').length
  const idle = items.filter(r => r.status === 'idle').length
  return { total: items.length, pass, fail, idle }
})

const testList = computed(() => {
  const testCases = runAll.value ? allTests : allTests.filter(t => results.value.get(t.id)?.status === 'fail')
  return testCases.map(tc => results.value.get(tc.id) || { ...tc, status: 'idle' as const, expected: undefined, actual: undefined, duration: 0 })
})

function runTests() {
  running.value = true
  runAll.value = true

  // 逐一执行（给 UI 时间刷新）
  const newResults = new Map(results.value)
  let i = 0
  function runNext() {
    if (i >= allTests.length) {
      running.value = false
      return
    }
    const tc = allTests[i]
    const start = performance.now()
    try {
      const r = tc.run()
      newResults.set(tc.id, { ...tc, status: r.pass ? 'pass' : 'fail', expected: r.expected, actual: r.actual, duration: Math.round(performance.now() - start) })
    } catch (e: any) {
      newResults.set(tc.id, { ...tc, status: 'fail', expected: '(no error)', actual: e.message, duration: Math.round(performance.now() - start) })
    }
    results.value = new Map(newResults)
    i++
    setTimeout(runNext, 10)
  }
  runNext()
}

function retryOne(tc: TestCase) {
  const start = performance.now()
  const newResults = new Map(results.value)
  try {
    const r = tc.run()
    newResults.set(tc.id, { ...tc, status: r.pass ? 'pass' : 'fail', expected: r.expected, actual: r.actual, duration: Math.round(performance.now() - start) })
  } catch (e: any) {
    newResults.set(tc.id, { ...tc, status: 'fail', expected: '(no error)', actual: e.message, duration: Math.round(performance.now() - start) })
  }
  results.value = newResults
}

function retryFailed() {
  runAll.value = false
  const failed = allTests.filter(t => results.value.get(t.id)?.status === 'fail')
  if (!failed.length) return

  const newResults = new Map(results.value)
  for (const tc of failed) {
    const start = performance.now()
    try {
      const r = tc.run()
      newResults.set(tc.id, { ...tc, status: r.pass ? 'pass' : 'fail', expected: r.expected, actual: r.actual, duration: Math.round(performance.now() - start) })
    } catch (e: any) {
      newResults.set(tc.id, { ...tc, status: 'fail', expected: '(no error)', actual: e.message, duration: Math.round(performance.now() - start) })
    }
  }
  results.value = newResults
}

const groups = computed(() => {
  const set = new Set<string>()
  allTests.forEach(t => set.add(t.group))
  return Array.from(set)
})

function testsByGroup(group: string) {
  return testList.value.filter(t => t.group === group)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h2>核心算法单元测试</h2>
      <div class="head-actions">
        <el-button v-if="summary.fail > 0 && !running" type="warning" size="small" @click="retryFailed">
          🔄 复测失败 ({{ summary.fail }})
        </el-button>
        <el-button type="primary" size="small" @click="runTests" :loading="running">
          ▶️ {{ results.size ? '重新运行' : '运行测试' }}
        </el-button>
      </div>
    </div>

    <!-- 汇总栏 -->
    <div class="test-summary" v-if="results.size">
      <span class="sum-total">共 {{ summary.total }} 条</span>
      <span class="sum-pass" v-if="summary.pass">✅ {{ summary.pass }} 通过</span>
      <span class="sum-fail" v-if="summary.fail">❌ {{ summary.fail }} 失败</span>
      <span class="sum-idle" v-if="summary.idle">⏳ {{ summary.idle }} 待测</span>
    </div>

    <el-empty v-if="!results.size" description="点击「运行测试」验证核心算法" />

    <div v-else v-for="group in groups" :key="group" class="test-group">
      <h3>{{ group }}</h3>
      <el-table :data="testsByGroup(group)" size="small" stripe>
        <el-table-column label="状态" width="70" align="center">
          <template #default="{ row }">
            <span v-if="row.status === 'pass'">✅</span>
            <span v-else-if="row.status === 'fail'">❌</span>
            <span v-else>⏳</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="测试用例" min-width="200" />
        <el-table-column label="预期" width="150">
          <template #default="{ row }">
            <code v-if="row.status !== 'idle'" class="cell-code">{{ typeof row.expected === 'object' ? JSON.stringify(row.expected) : row.expected }}</code>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="实际" width="150">
          <template #default="{ row }">
            <code v-if="row.status !== 'idle'" class="cell-code" :class="{ 'cell-fail': row.status === 'fail' }">
              {{ typeof row.actual === 'object' ? JSON.stringify(row.actual) : row.actual }}
            </code>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="70" align="right">
          <template #default="{ row }">
            <span v-if="row.duration" class="cell-dur">{{ row.duration }}ms</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="retryOne(row)">🔄 复测</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; }
.head-actions { display: flex; gap: 8px; }
.test-summary { display: flex; gap: 16px; margin-bottom: 16px; font-size: 0.9rem; }
.sum-total { color: #909399; }
.sum-pass { color: #67c23a; font-weight: 600; }
.sum-fail { color: #f56c6c; font-weight: 600; }
.sum-idle { color: #c0c4cc; }
.test-group { margin-bottom: 24px; }
.test-group h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; color: #303133; }
.cell-code { font-size: 0.75rem; font-family: monospace; background: #f5f7fa; padding: 1px 4px; border-radius: 3px; }
.cell-fail { color: #f56c6c; background: #fef0f0; }
.cell-dur { font-size: 0.75rem; color: #909399; font-family: monospace; }
</style>
