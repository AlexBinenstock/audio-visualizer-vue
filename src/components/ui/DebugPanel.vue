<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  audioFile: File | null
  currentSource: any
  isPlaying: boolean
  isMicActive: boolean
  error: string | null
}

const props = defineProps<Props>()

const showDebug = ref(false)

const toggleDebug = () => {
  showDebug.value = !showDebug.value
}

const fileInfo = computed(() => {
  if (!props.audioFile) return null
  
  return {
    name: props.audioFile.name,
    size: props.audioFile.size,
    type: props.audioFile.type,
    lastModified: new Date(props.audioFile.lastModified).toLocaleString()
  }
})

const sourceInfo = computed(() => {
  if (!props.currentSource) return 'None'
  
  if (props.currentSource.name === 'UserMedia') {
    return 'Microphone (UserMedia)'
  } else if (props.currentSource.name === 'Player') {
    return 'Audio File (Player)'
  }
  
  return props.currentSource.name || 'Unknown'
})
</script>

<template>
  <div class="debug-panel">
    <button @click="toggleDebug" class="debug-toggle">
      {{ showDebug ? '🔽 Hide Debug' : '🔼 Show Debug' }}
    </button>
    
    <div v-if="showDebug" class="debug-content">
      <h4>Debug Information</h4>
      
      <div class="debug-section">
        <h5>Audio File</h5>
        <div v-if="fileInfo" class="debug-item">
          <strong>Name:</strong> {{ fileInfo.name }}<br>
          <strong>Size:</strong> {{ (fileInfo.size / 1024 / 1024).toFixed(2) }} MB<br>
          <strong>Type:</strong> {{ fileInfo.type }}<br>
          <strong>Modified:</strong> {{ fileInfo.lastModified }}
        </div>
        <div v-else class="debug-item">No file selected</div>
      </div>
      
      <div class="debug-section">
        <h5>Audio State</h5>
        <div class="debug-item">
          <strong>Source:</strong> {{ sourceInfo }}<br>
          <strong>Playing:</strong> {{ isPlaying ? 'Yes' : 'No' }}<br>
          <strong>Microphone Active:</strong> {{ isMicActive ? 'Yes' : 'No' }}<br>
          <strong>Error:</strong> {{ error || 'None' }}
        </div>
      </div>
      
      <div class="debug-section">
        <h5>System Info</h5>
        <div class="debug-item">
          <strong>User Agent:</strong> {{ navigator.userAgent }}<br>
          <strong>Platform:</strong> {{ navigator.platform }}<br>
          <strong>Language:</strong> {{ navigator.language }}<br>
          <strong>Online:</strong> {{ navigator.onLine ? 'Yes' : 'No' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-panel {
  margin-top: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.debug-toggle {
  width: 100%;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: #64ffda;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.debug-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}

.debug-content {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
}

.debug-content h4 {
  margin: 0 0 1rem 0;
  color: #64ffda;
  font-size: 1.1rem;
}

.debug-section {
  margin-bottom: 1.5rem;
}

.debug-section h5 {
  margin: 0 0 0.5rem 0;
  color: #ccc;
  font-size: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.25rem;
}

.debug-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: break-all;
}

.debug-item strong {
  color: #64ffda;
}
</style>
