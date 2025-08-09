<script setup lang="ts">
interface Props {
  currentSource: 'microphone' | 'file' | null
  webglSupported: boolean
  webglError?: string | null
}

defineProps<Props>()
</script>

<template>
  <!-- Audio Source Status -->
  <div class="status">
    <p v-if="currentSource === 'microphone'" class="status-mic">
      🎤 Using microphone input
    </p>
    <p v-else-if="currentSource === 'file'" class="status-file">
      📁 Using audio file input
    </p>
    <p v-else class="status-none">
      ⏸️ No audio source selected
    </p>
  </div>

  <!-- WebGL Support Status -->
  <div class="visualizer-container">
    <div v-if="webglSupported" class="webgl-status">
      🎨 WebGL Mode Active
    </div>
    <div v-else-if="webglError" class="webgl-error">
      ❌ WebGL Error: {{ webglError }}
    </div>
    <div v-else class="canvas-status">
      🖼️ Canvas2D Mode Active (WebGL not supported)
    </div>
  </div>
</template>

<style scoped>
.status {
  margin-bottom: 2rem;
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
  background: rgba(100, 255, 218, 0.1);
  border: 1px solid rgba(100, 255, 218, 0.3);
  color: #64ffda;
}

.status-file {
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.3);
  color: #4ecdc4;
}

.status-none {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ccc;
}

.visualizer-container {
  margin-bottom: 2rem;
}

.webgl-status,
.webgl-error,
.canvas-status {
  text-align: center;
  padding: 0.75rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}

.webgl-status {
  background: rgba(100, 255, 218, 0.1);
  border: 1px solid rgba(100, 255, 218, 0.3);
  color: #64ffda;
}

.webgl-error {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.canvas-status {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #ffc107;
}
</style>
