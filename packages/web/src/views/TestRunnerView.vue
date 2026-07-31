<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { isSystemAdmin } from '@open-issue/core'
import { useAuthStore } from '@/stores/auth'
import { getTestFiles, getTestStatus, runAllTests, type TestFileInfo, type TestRunResult } from '@/api/test'
import PageHelpButton from '@/components/PageHelpButton.vue'
import PoiTestRunnerPrimary from '@/components/workbench/PoiTestRunnerPrimary.vue'
import { usePoiViewContribution } from '@/layout/workbench/poiViewContributions'

const route = useRoute()
const auth = useAuthStore()
const isAdmin = computed(() => isSystemAdmin(auth.user ?? undefined))

const loading = ref(false)
const running = ref(false)
const files = ref<TestFileInfo[]>([])
const available = ref(true)
const lastResult = ref<TestRunResult | null>(null)

const totalCases = computed(() => files.value.reduce((s, f) => s + f.caseCount, 0))

/** Cursor/Electron 内嵌预览：window.open / target=_blank 会一次连开多个标签，只能复制链接 */
const embeddedPreview = computed(() => {
  try {
    if (window.self !== window.top) return true
  } catch {
    return true
  }
  return /Electron/i.test(navigator.userAgent)
})

const reportFullUrl = computed(() => {
  const rel = lastResult.value?.reportUrl
  if (!rel) return null
  return new URL(rel, window.location.origin).href
})

let reportOpenLock = false

function openReportInBrowser() {
  const url = reportFullUrl.value
  if (!url || reportOpenLock) return
  reportOpenLock = true
  window.setTimeout(() => { reportOpenLock = false }, 2000)
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function copyReportForNewTab() {
  const url = reportFullUrl.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('已复制。请 Ctrl+T 新建标签页，地址栏粘贴后打开')
  } catch {
    ElMessage.warning('请手动复制下方链接')
  }
}

async function copyReportLink() {
  const url = reportFullUrl.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('报告链接已复制')
  } catch {
    ElMessage.info(url)
  }
}

async function loadFiles() {
  if (!isAdmin.value) return
  loading.value = true
  try {
    const { data } = await getTestFiles()
    files.value = data.files
    available.value = data.available
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '加载测试文件失败')
  } finally {
    loading.value = false
  }
}

async function loadStatus() {
  if (!isAdmin.value) return
  try {
    const { data } = await getTestStatus()
    available.value = data.available
    if (data.lastResult) lastResult.value = data.lastResult
    running.value = data.running
  } catch { /* ignore */ }
}

async function onRunAll() {
  running.value = true
  try {
    const { data } = await runAllTests()
    lastResult.value = data
    ElMessage.success(data.message || '运行完成')
  } catch (e: any) {
    if (e?.response?.status === 409) {
      ElMessage.warning('测试正在运行中')
    } else {
      ElMessage.error(e?.response?.data?.message || '运行失败')
    }
  } finally {
    running.value = false
    loadStatus()
  }
}

function scrollToTestSection(sectionId: string): void {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiTestRunnerPrimary,
    props: computed(() => ({
      isAdmin: isAdmin.value,
      available: available.value,
      running: running.value,
      fileCount: files.value.length,
      totalCases: totalCases.value,
      hasResult: Boolean(lastResult.value),
      onRunAll,
      onNavigateSection: scrollToTestSection,
    })),
  },
})

onMounted(async () => {
  await loadStatus()
  await loadFiles()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h2>单元测试</h2>
      <PageHelpButton page-id="testRunner" />
    </div>

    <el-alert v-if="!isAdmin" type="warning" show-icon :closable="false" title="需要系统管理员权限才能运行单元测试" />

    <template v-else>
      <el-alert v-if="!available" type="info" show-icon :closable="false"
        title="当前环境未安装 Vitest，仅开发/内网环境可用" />

      <div class="toolbar" data-tour="test-toolbar">
        <el-button type="primary" :loading="running" :disabled="!available || running" @click="onRunAll">
          全部运行
        </el-button>
        <span v-if="files.length" class="hint">{{ files.length }} 个文件 · {{ totalCases }} 条用例</span>
      </div>

      <el-table id="test-files" v-loading="loading" :data="files" stripe style="width: 100%; margin-top: 16px" data-tour="test-files">
        <el-table-column prop="filePath" label="测试文件" min-width="320" />
        <el-table-column prop="packageName" label="包" width="100" />
        <el-table-column prop="caseCount" label="用例数" width="90" align="center" />
      </el-table>

      <div id="test-result" v-if="lastResult" class="result-box" data-tour="test-result">
        <h3>最近运行 · {{ lastResult.ranAt }}</h3>
        <p>
          共 {{ lastResult.summary.total }} 条 ·
          <span class="pass">{{ lastResult.summary.passed }} 通过</span><template v-if="lastResult.summary.failed"> ·
          <span class="fail">{{ lastResult.summary.failed }} 失败</span></template>
          · 耗时约 {{ lastResult.summary.durationMs }}ms
        </p>
        <div v-if="lastResult.reportUrl" class="report-actions">
          <template v-if="embeddedPreview">
            <el-button type="success" plain @click.stop.prevent="copyReportForNewTab">
              复制报告链接
            </el-button>
            <span class="report-hint">内嵌预览无法可靠新开标签，请 Ctrl+T 粘贴打开，或用外部 Chrome 访问</span>
            <code class="report-url">{{ reportFullUrl }}</code>
          </template>
          <template v-else>
            <el-button type="success" plain @click.stop.prevent="openReportInBrowser">
              查看 HTML 报告（新标签页）
            </el-button>
            <el-button link type="primary" @click.stop="copyReportLink">复制链接</el-button>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { max-width: 960px; }
.page-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.page-head h2 { margin: 0; font-size: 1.25rem; }
.toolbar { display: flex; align-items: center; gap: 16px; margin-top: 16px; }
.hint { color: #909399; font-size: 0.85rem; }
.result-box { margin-top: 24px; padding: 16px 20px; background: #fff; border: 1px solid #ebeef5; border-radius: 8px; }
.result-box h3 { margin: 0 0 8px; font-size: 1rem; }
.result-box p { margin: 0 0 12px; color: #606266; font-size: 0.9rem; }
.pass { color: #67c23a; }
.fail { color: #f56c6c; }
.report-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.report-hint { font-size: 0.78rem; color: #909399; line-height: 1.4; }
.report-url {
  display: block; max-width: 100%; padding: 6px 10px; font-size: 0.75rem;
  background: #f5f7fa; border-radius: 4px; word-break: break-all; color: #606266;
}
</style>
