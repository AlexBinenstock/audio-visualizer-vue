<script setup lang="ts">
import VisualizerRadialWebGL from '../VisualizerRadialWebGL.vue'
import VisualizerRadial from '../VisualizerRadial.vue'

interface Props {
  analyser: AnalyserNode | null
  sensitivity: number
  decay: number
  frequencyMapping: 'logarithmic' | 'linear'
  webglSupported: boolean
}

interface Emits {
  (e: 'webgl-error'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleWebGLError = () => {
  emit('webgl-error')
}
</script>

<template>
  <div class="visualizer-container">
    <VisualizerRadialWebGL 
      v-if="webglSupported"
      :analyser="analyser" 
      :sensitivity="sensitivity" 
      :decay="decay"
      :frequency-mapping="frequencyMapping"
      @webgl-error="handleWebGLError"
    />
    <VisualizerRadial 
      v-else
      :analyser="analyser" 
      :sensitivity="sensitivity" 
      :decay="decay"
      :frequency-mapping="frequencyMapping"
    />
  </div>
</template>

<style scoped>
.visualizer-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 600px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
</style>
