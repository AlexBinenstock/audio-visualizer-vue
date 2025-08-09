<script setup lang="ts">
import ControlsContainer from './components/controls/ControlsContainer.vue'
import StatusDisplay from './components/ui/StatusDisplay.vue'
import VisualizerContainer from './components/visualizer/VisualizerContainer.vue'
import { onMounted } from 'vue'
import { useAudioManager } from './composables/useAudioManager'
import { useVisualizationParams } from './composables/useVisualizationParams'
import { useWebGLSupport } from './composables/useWebGLSupport'

// Use composables
const {
  currentAnalyser,
  currentSource,
  audioDevices,
  selectedDeviceId,
  isMicActive,
  audioFile,
  audioElement,
  startMicrophone,
  handleFileUpload,
  handleDeviceChange,
  handleAudioError
} = useAudioManager()

const {
  sensitivity,
  decay,
  frequencyMapping,
  handleSensitivityChange,
  handleDecayChange,
  testReactivity
} = useVisualizationParams()

const {
  webglSupported,
  webglError,
  resetVisualizer,
  handleWebGLError,
  checkWebGLSupport
} = useWebGLSupport()

// Check WebGL support on mount
onMounted(() => {
  checkWebGLSupport()
})

// Handle frequency mapping changes
const handleFrequencyMappingChange = (value: 'logarithmic' | 'linear') => {
  frequencyMapping.value = value
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Reveri</h1>
      <p>Radial visualization with microphone or audio file input</p>
    </header>

    <main class="app-main">
      <div class="app-content">
        <!-- Left Column: Controls and Status -->
        <div class="left-column">
          <!-- Controls Section -->
          <ControlsContainer
            :audio-devices="audioDevices"
            :selected-device-id="selectedDeviceId"
            :is-mic-active="isMicActive"
            :audio-file="audioFile"
            :current-analyser="currentAnalyser"
            :audio-element="audioElement"
            :sensitivity="sensitivity"
            :decay="decay"
            :frequency-mapping="frequencyMapping"
            @device-change="handleDeviceChange"
            @start-microphone="startMicrophone"
            @file-upload="handleFileUpload"
            @audio-error="handleAudioError"
            @audio-element-ready="(element) => audioElement = element"
            @sensitivity-change="handleSensitivityChange"
            @decay-change="handleDecayChange"
            @frequency-mapping-change="handleFrequencyMappingChange"
            @reset-peaks="resetVisualizer"
            @test-reactivity="testReactivity"
          />

          <!-- Status Display -->
          <StatusDisplay
            :current-source="currentSource"
            :webgl-supported="webglSupported"
            :webgl-error="webglError"
          />
        </div>

        <!-- Right Column: Visualizer -->
        <div class="right-column">
          <VisualizerContainer
            :analyser="currentAnalyser"
            :sensitivity="sensitivity"
            :decay="decay"
            :frequency-mapping="frequencyMapping"
            :webgl-supported="webglSupported"
            @webgl-error="handleWebGLError"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
  color: #ffffff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-header {
  text-align: center;
  padding: 2rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 3rem;
  font-weight: 700;
  background: linear-gradient(135deg, #64ffda 0%, #00bcd4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-header p {
  margin: 0;
  font-size: 1.2rem;
  color: #ccc;
  font-weight: 300;
}

.app-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.app-content {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.left-column {
  flex: 0 0 400px;
  max-width: 400px;
}

.right-column {
  flex: 1;
  min-width: 0;
}

/* Responsive design for smaller screens */
@media (max-width: 1200px) {
  .app-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .left-column {
    flex: none;
    max-width: none;
  }
  
  .right-column {
    flex: none;
  }
}
</style>
