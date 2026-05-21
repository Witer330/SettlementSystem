<template>
  <div class="df-root">
    <!-- 统计行 -->
    <div class="df-stats">
      <div v-for="s in stats" :key="s.label" class="df-stat" :class="{ 'df-stat--primary': s.primary }">
        <span class="df-stat-label">{{ s.label }}</span>
        <span class="df-stat-value" :class="{ 'clickable-amount': s.clickable }" @click="s.clickable && $emit('statClick', s.label)">{{ s.value }}</span>
      </div>
      <span class="df-spacer" />
      <span v-if="draftHint" class="df-draft-hint">{{ draftHint }}</span>
      <slot name="statsExtra" />
    </div>

    <!-- 操作行 -->
    <div v-if="showActions" class="df-actions">
      <slot name="actionsLeft" />
      <span class="df-spacer" />
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
export interface FooterStat {
  label: string
  value: string
  primary?: boolean
  clickable?: boolean
}

defineProps<{
  stats: FooterStat[]
  draftHint?: string
  showActions?: boolean
}>()

defineEmits<{
  statClick: [label: string]
}>()
</script>

<style scoped>
.df-root {
  flex-shrink: 0;
  background: var(--bg-muted, #f2f3f5);
  border-top: 2px solid var(--border-color, #e3e8ee);
  padding: 8px 20px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.df-stats { display: flex; align-items: baseline; gap: 24px; flex-wrap: wrap; }
.df-stat { display: flex; align-items: baseline; gap: 6px; }
.df-stat-label { font-size: 13px; color: var(--color-text-muted, #8898aa); }
.df-stat-value { font-size: 14px; color: #061b31; font-weight: 500; }
.df-stat--primary .df-stat-value { font-size: 20px; font-weight: 600; }
.df-spacer { flex: 1; }
.df-draft-hint { font-size: 12px; color: var(--color-text-muted, #8898aa); }
.df-actions { display: flex; align-items: center; gap: 8px; }
</style>
