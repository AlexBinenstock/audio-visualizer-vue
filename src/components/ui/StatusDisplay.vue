<script setup lang="ts">
interface Props {
  currentSource: any
  isInitialized: boolean
  error: string | null
}

defineProps<Props>()
</script>

<template>
  <!-- Audio Source Status -->
  <div class="status">
    <p v-if="currentSource && currentSource.name === 'UserMedia'" class="status-mic">
      🎤 Using microphone input
    </p>
    <p v-else-if="currentSource && currentSource.name === 'Player'" class="status-file">
      📁 Using audio file input
    </p>
    <p v-else class="status-none">
      ⏸️ No audio source selected
    </p>
  </div>

  <!-- Initialization Status -->
  <div class="init-status">
    <div v-if="isInitialized && !error" class="status-success">
      ✅ Audio system initialized
    </div>
    <div v-else-if="error" class="status-error">
      ❌ Error: {{ error }}
    </div>
    <div v-else class="status-loading">
      🔄 Initializing audio system...
    </div>
  </div>
</template>

<style scoped>
.status {
  margin-bottom: 1rem;
  text-align: center;
}

.status p {
  margin: 0;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.1rem;
}

.status-mic {
  background: rgba(100, 181, 246, 0.1);
  border: 1px solid rgba(100, 181, 246, 0.3);
  color: var(--accent-color);
}

.status-file {
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.3);
  color: #4ecdc4;
}

.status-none {
  background: var(--control-bg);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.init-status {
  margin-bottom: 1rem;
}

.status-success,
.status-error,
.status-loading {
  text-align: center;
  padding: 0.75rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}

.status-success {
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.3);
  color: #4caf50;
}

.status-error {
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  color: #f44336;
}

.status-loading {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #ffc107;
}
</style>
