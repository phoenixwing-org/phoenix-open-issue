<script setup lang="ts">
import { useRouter } from 'vue-router'
import PnwWelcomeShell from 'phoenix-wing/layout/PnwWelcomeShell.vue'

const router = useRouter()
const emit = defineEmits<{ close: [] }>()

function goDashboard() {
  emit('close')
  router.push('/dashboard')
}

function backToWorkspace() {
  emit('close')
}
</script>

<template>
  <PnwWelcomeShell>
    <template #brand>
      <div class="brand-area">
        <div class="brand-icon">OI</div>
        <div>
          <div class="brand-name">Open Issue List</div>
          <div class="brand-sub">基于 phoenix-wing</div>
        </div>
      </div>
    </template>

    <template #title>Open Issue List</template>

    <template #actions>
      <button class="rail-btn rail-btn-back" @click="backToWorkspace">返回工作台</button>
    </template>

    <template #headActions>
      <button class="hdr-btn hdr-btn-primary" @click="goDashboard">打开仪表盘</button>
      <button class="hdr-btn hdr-btn-close" @click="emit('close')" title="关闭">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </template>

    <template #main>
      <div class="card-grid">
        <div class="card">
          <div class="card-icon">📋</div>
          <h3>列表管理</h3>
          <p>创建年度/月度/项目 Issue 列表，支持自定义分类</p>
        </div>
        <div class="card">
          <div class="card-icon">🔍</div>
          <h3>Issue 追踪</h3>
          <p>创建、分配、点检 Issue，支持多维度筛选排序</p>
        </div>
        <div class="card">
          <div class="card-icon">📊</div>
          <h3>组织推送</h3>
          <p>按组织架构层级推送 Issue，支持覆盖/合并策略</p>
        </div>
      </div>
    </template>

    <template #links>
      <div class="footer-links">
        <a href="https://gitee.com/PhoenixWing321/phoenix-open-issue" target="_blank">Gitee</a>
        <a href="https://gitee.com/PhoenixWing321/phoenix-wing" target="_blank">phoenix-wing</a>
      </div>
    </template>
  </PnwWelcomeShell>
</template>

<style scoped>
/* ---- brand ---- */
.brand-area {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #409eff, #6366f1);
  color: #fff;
  display: grid; place-items: center;
  font-weight: 800; font-size: 0.85rem;
  flex-shrink: 0;
}
.brand-name {
  font-size: 1.05rem;
  font-weight: 700;
}
.brand-sub {
  font-size: 0.7rem;
  color: #909399;
  margin-top: 2px;
}

/* ---- rail buttons ---- */
.rail-btn {
  width: 100%;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;
  text-align: left;
}
.rail-btn-back {
  background: transparent;
  color: var(--text, #0f172a);
  border-color: #dcdfe6;
}
.rail-btn-back:hover {
  background: #f0f2f5;
}

/* ---- header buttons ---- */
.hdr-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, box-shadow 0.15s;
}
.hdr-btn-primary {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}
.hdr-btn-primary:hover {
  background: #337ecc;
  box-shadow: 0 2px 8px rgba(64,158,255,0.35);
}
.hdr-btn-close {
  width: 28px; height: 28px;
  padding: 0;
  display: grid; place-items: center;
  background: transparent;
  color: #909399;
  border-color: transparent;
  border-radius: 6px;
}
.hdr-btn-close:hover {
  background: #f0f0f0;
  color: #606266;
}

/* ---- cards ---- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 24px 20px;
  transition: box-shadow 0.2s, transform 0.15s;
  cursor: default;
}
.card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.07);
  transform: translateY(-2px);
}
.card-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: #f0f4ff;
  display: grid; place-items: center;
  font-size: 1.2rem;
  margin-bottom: 12px;
}
.card h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 6px;
}
.card p {
  font-size: 0.8rem;
  color: #909399;
  line-height: 1.5;
  margin: 0;
}

/* ---- footer ---- */
.footer-links {
  display: flex;
  gap: 14px;
  font-size: 0.78rem;
}
.footer-links a {
  color: #909399;
  text-decoration: none;
}
.footer-links a:hover {
  color: #409eff;
}
</style>
