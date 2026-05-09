<template>
  <span class="flow-connector" :class="`flow-connector--${direction}`" />
</template>

<script setup lang="ts">
import type { ConnectorDirection } from './types'

defineProps<{
  direction?: ConnectorDirection
}>()
</script>

<style scoped>
.flow-connector {
  display: inline-block;
  flex-shrink: 0;
  position: relative;
}

.flow-connector--right {
  width: 28px;
  height: 2px;
  background: var(--border-color);
  margin: 0 var(--space-1);
  transition: background var(--transition-base);
}

.flow-connector--right::after {
  content: '';
  position: absolute;
  right: -1px;
  top: -4px;
  border-left: 6px solid var(--border-color);
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
}

.flow-connector--down {
  width: 2px;
  height: 20px;
  margin: var(--space-1) 0;
  background: var(--border-color);
  transition: background var(--transition-base);
}

.flow-connector--down::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: -4px;
  border-top: 6px solid var(--border-color);
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
}

@media (max-width: 768px) {
  .flow-connector--right {
    width: 2px;
    height: 20px;
    margin: 0 auto;
  }

  .flow-connector--right::after {
    right: auto;
    bottom: -1px;
    left: -4px;
    top: auto;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid var(--border-color);
    border-bottom: none;
  }
}
</style>
