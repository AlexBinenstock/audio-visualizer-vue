<template>
  <div class="collapsible-section">
    <button 
      class="section-header"
      @click="isExpanded = !isExpanded"
      :aria-expanded="isExpanded"
      :aria-controls="`section-${id}`"
    >
      <span class="section-title">{{ title }}</span>
      <span class="expand-icon" :class="{ expanded: isExpanded }">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </button>
    
    <div 
      class="section-content"
      :class="{ expanded: isExpanded }"
      :id="`section-${id}`"
      :aria-hidden="!isExpanded"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title: string
  id: string
  defaultExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  defaultExpanded: true
})

const isExpanded = ref(props.defaultExpanded)
</script>

<style scoped>
.collapsible-section {
  margin-bottom: 1rem;
  border-radius: 12px;
  overflow: hidden;
  background: var(--control-bg);
  border: 1px solid var(--border-color);
}

.section-header {
  width: 100%;
  padding: 1rem 1.5rem;
  background: var(--control-item-bg);
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-primary);
  font-size: 1.1rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.section-header:hover {
  background: var(--control-item-hover);
}

.section-header:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-color);
}

.section-title {
  color: var(--accent-color);
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  color: var(--text-secondary);
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.section-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.section-content.expanded {
  max-height: 2000px; /* Large enough to accommodate content */
}

/* Ensure content is visible when expanded */
.section-content.expanded > :deep(*) {
  opacity: 1;
  transform: translateY(0);
}

/* Initial state for content */
.section-content > :deep(*) {
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.section-content.expanded > :deep(*) {
  opacity: 1;
  transform: translateY(0);
}
</style>
