<template>
  <div class="visualizer-webgl" :class="{ 'fullscreen': isFullscreen }">
    <canvas
      ref="canvasRef"
      class="visualizer-canvas"
      :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
    />
    <div v-if="!webglSupported" class="webgl-error">
      WebGL2 not supported in your browser
    </div>
    
    <!-- Fullscreen toggle button -->
    <button 
      @click="toggleFullscreen" 
      class="fullscreen-toggle"
      :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
    >
      <svg v-if="!isFullscreen" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
      <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16v-3a2 2 0 0 1 2-2h3"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { WebGLManager, RADIAL_VISUALIZER_SHADERS, createFrequencyDataBuffer, updateFrequencyDataBuffer } from '../lib/webgl'
import { 
  createFullFrequencyBuffer, 
  updateFullFrequencyBuffer, 
  BUFFER_LAYOUT,
  AUDIO_CONFIG 
} from '../lib/audio-config'

// Props
interface Props {
  analyser?: AnalyserNode
  sensitivity?: number
  decay?: number
  frequencyMapping?: 'logarithmic' | 'linear'
}

// Default values
const props = withDefaults(defineProps<Props>(), {
  sensitivity: 1.0,
  decay: 0.7,
  frequencyMapping: 'logarithmic'
})

// Emits
interface Emits {
  (e: 'webgl-error'): void
}

const emit = defineEmits<Emits>()

// Refs
const canvasRef = ref<HTMLCanvasElement>()
const webglManager = ref<WebGLManager>()
const webglSupported = ref(true)
const animationFrameId = ref<number>()
const isFullscreen = ref(false)

// Canvas dimensions
const canvasWidth = ref(800)
const canvasHeight = ref(600)

// Audio data
const frequencyData = ref<Uint8Array>(new Uint8Array(1024))
const peakData = ref<Uint8Array>(new Uint8Array(1024))
const decayedFrequencyData = ref<Uint8Array>(new Uint8Array(1024))

// Performance tracking
const lastUpdateTime = ref(0)
const frameCount = ref(0)

// WebGL resources
let frequencyBufferName = 'frequencyData'
let program: WebGLProgram | null = null

// Initialize WebGL2
const initWebGL = async (): Promise<boolean> => {
  try {
    // Check WebGL2 support
    const canvas = document.createElement('canvas')
    const testGl = canvas.getContext('webgl2')
    if (!testGl) {
      webglSupported.value = false
      emit('webgl-error')
      return false
    }

    if (!canvasRef.value) {
      return false
    }

    // Ensure canvas has proper dimensions
    const container = canvasRef.value.parentElement
    if (container) {
      const rect = container.getBoundingClientRect()
      canvasWidth.value = rect.width
      canvasHeight.value = rect.height
      
      // Set canvas size
      canvasRef.value.width = canvasWidth.value
      canvasRef.value.height = canvasHeight.value
      canvasRef.value.style.width = `${canvasWidth.value}px`
      canvasRef.value.style.height = `${canvasHeight.value}px`
    }

    // Fallback to minimum dimensions if container doesn't provide them
    if (canvasWidth.value === 0 || canvasHeight.value === 0) {
      canvasWidth.value = 800
      canvasHeight.value = 600
      canvasRef.value.width = canvasWidth.value
      canvasRef.value.height = canvasHeight.value
      canvasRef.value.style.width = `${canvasWidth.value}px`
      canvasRef.value.style.height = `${canvasHeight.value}px`
    }

    // Final check for canvas dimensions
    if (canvasWidth.value === 0 || canvasHeight.value === 0) {
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 100))
      return initWebGL()
    }

    // Initialize WebGL manager
    webglManager.value = new WebGLManager()
    if (!webglManager.value.init(canvasRef.value)) {
      webglSupported.value = false
      emit('webgl-error')
      return false
    }

    const gl = webglManager.value.getContext()
    if (!gl) {
      return false
    }

    // Create shader program
    program = webglManager.value.createProgram(
      RADIAL_VISUALIZER_SHADERS.vertex,
      RADIAL_VISUALIZER_SHADERS.fragment,
      'radialVisualizer'
    )

    if (!program) {
      webglSupported.value = false
      emit('webgl-error')
      return false
    }

    // Create frequency data buffer
    const fftSize = props.analyser?.fftSize || 2048
    const bufferLength = fftSize / 2
    const frequencyDataArray = createFrequencyDataBuffer(bufferLength)
    webglManager.value.createBuffer(frequencyBufferName, frequencyDataArray, gl.DYNAMIC_DRAW)

    if (!webglManager.value.getBuffer(frequencyBufferName)) {
      webglSupported.value = false
      emit('webgl-error')
      return false
    }

    // Set up vertex attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const frequencyLocation = gl.getAttribLocation(program, 'a_frequency')
    const amplitudeLocation = gl.getAttribLocation(program, 'a_amplitude')
    const peakLocation = gl.getAttribLocation(program, 'a_peak')

    // Check if all attributes were found
    if (positionLocation === -1 || frequencyLocation === -1 || amplitudeLocation === -1 || peakLocation === -1) {
      webglSupported.value = false
      emit('webgl-error')
      return false
    }

    // Bind buffer before setting attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, webglManager.value.getBuffer(frequencyBufferName))

    gl.enableVertexAttribArray(positionLocation)
    gl.enableVertexAttribArray(frequencyLocation)
    gl.enableVertexAttribArray(amplitudeLocation)
    gl.enableVertexAttribArray(peakLocation)

    // Set attribute pointers - each vertex has 5 floats: position(2), frequency(1), amplitude(1), peak(1)
    const fullStride = BUFFER_LAYOUT.FULL_VERTEX_SIZE * 4
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, fullStride, BUFFER_LAYOUT.FULL_POSITION_OFFSET)
    gl.vertexAttribPointer(frequencyLocation, 1, gl.FLOAT, false, fullStride, BUFFER_LAYOUT.FULL_FREQUENCY_OFFSET)
    gl.vertexAttribPointer(amplitudeLocation, 1, gl.FLOAT, false, fullStride, BUFFER_LAYOUT.FULL_AMPLITUDE_OFFSET)
    gl.vertexAttribPointer(peakLocation, 1, gl.FLOAT, false, fullStride, BUFFER_LAYOUT.FULL_PEAK_OFFSET)

    return true

  } catch (error) {
    webglSupported.value = false
    emit('webgl-error')
    return false
  }
}

// Update peak data with time-based decay
const updatePeakData = (data: Uint8Array) => {
  const now = performance.now()
  const deltaTime = now - (lastUpdateTime.value || now)
  lastUpdateTime.value = now

  // Enhanced decay calculation with more dramatic range
  const enhancedDecay = Math.pow(props.decay, 2)
  const frameDecay = enhancedDecay

  // Ensure decayedFrequencyData exists and has the right size
  if (!decayedFrequencyData.value || decayedFrequencyData.value.length !== data.length) {
    decayedFrequencyData.value = new Uint8Array(data.length)
  }

  for (let i = 0; i < data.length; i++) {
    // Update peak data with more responsive decay
    if (data[i] > peakData.value[i]) {
      peakData.value[i] = data[i]
    } else {
      // Apply decay effect to peak data
      peakData.value[i] *= frameDecay
      
      // Also blend in some current audio data to make peaks more responsive to decay
      const blendFactor = 0.1
      peakData.value[i] = peakData.value[i] * (1 - blendFactor) + data[i] * blendFactor
      
      // Clear very small values to prevent visual noise
      if (peakData.value[i] < 2) {
        peakData.value[i] = 0
      }
    }

    // Apply decay to main frequency data as well
    if (data[i] > decayedFrequencyData.value[i]) {
      // If new data is higher, use it
      decayedFrequencyData.value[i] = data[i]
    } else {
      // Apply decay to the main frequency visualization
      decayedFrequencyData.value[i] *= frameDecay
      
      // Clear very small values
      if (decayedFrequencyData.value[i] < 2) {
        decayedFrequencyData.value[i] = 0
      }
    }
  }
}

// Main render function
const render = () => {
  if (!webglManager.value || !props.analyser || !program) {
    return
  }

  const gl = webglManager.value.getContext()
  if (!gl || !webglManager.value.getBuffer(frequencyBufferName)) {
    return
  }

  // Check if analyser is ready and has data
  if (!props.analyser.context || props.analyser.context.state !== 'running') {
    if (props.analyser.context?.state === 'suspended' && 'resume' in props.analyser.context) {
      ;(props.analyser.context as AudioContext).resume().catch(() => {})
    }
    animationFrameId.value = requestAnimationFrame(render)
    return
  }

  try {
    // Get frequency data from analyser
    const fftSize = props.analyser.fftSize
    const bufferLength = fftSize / 2
    
    // Ensure our arrays are the right size
    if (frequencyData.value.length !== bufferLength) {
      frequencyData.value = new Uint8Array(bufferLength)
      peakData.value = new Uint8Array(bufferLength)
      decayedFrequencyData.value = new Uint8Array(bufferLength)
    }
    
    // Get frequency data from analyser
    props.analyser.getByteFrequencyData(frequencyData.value)
    
    // Update peak data with decay
    updatePeakData(frequencyData.value)
    
    // Update the WebGL buffer with real audio data
    const updateBuffer = webglManager.value.getBuffer(frequencyBufferName)
    if (updateBuffer) {
      updateFullFrequencyBuffer(gl, updateBuffer, decayedFrequencyData.value, peakData.value, props.sensitivity)
    }
    
    // Set viewport to ensure correct rendering
    gl.viewport(0, 0, canvasWidth.value, canvasHeight.value)

    // Clear canvas with consistent background color
    gl.clearColor(0.1, 0.1, 0.3, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Use shader program
    gl.useProgram(program)

    // Set uniforms
    const sensitivityLocation = gl.getUniformLocation(program, 'u_sensitivity')
    const timeLocation = gl.getUniformLocation(program, 'u_time')

    if (sensitivityLocation) {
      gl.uniform1f(sensitivityLocation, props.sensitivity)
    }

    if (timeLocation) {
      const currentTime = performance.now() / 1000
      gl.uniform1f(timeLocation, currentTime)
    }

    // Bind frequency buffer
    const bindBuffer = webglManager.value.getBuffer(frequencyBufferName)
    if (bindBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bindBuffer)
    } else {
      return
    }

    // Set up vertex attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const frequencyLocation = gl.getAttribLocation(program, 'a_frequency')
    const amplitudeLocation = gl.getAttribLocation(program, 'a_amplitude')
    const peakLocation = gl.getAttribLocation(program, 'a_peak')
    
    gl.enableVertexAttribArray(positionLocation)
    gl.enableVertexAttribArray(frequencyLocation)
    gl.enableVertexAttribArray(amplitudeLocation)
    gl.enableVertexAttribArray(peakLocation)

    // Set attribute pointers
    const fullStride = BUFFER_LAYOUT.FULL_VERTEX_SIZE * 4
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, fullStride, BUFFER_LAYOUT.FULL_POSITION_OFFSET)
    gl.vertexAttribPointer(frequencyLocation, 1, gl.FLOAT, false, fullStride, BUFFER_LAYOUT.FULL_FREQUENCY_OFFSET)
    gl.vertexAttribPointer(amplitudeLocation, 1, gl.FLOAT, false, fullStride, BUFFER_LAYOUT.FULL_AMPLITUDE_OFFSET)
    gl.vertexAttribPointer(peakLocation, 1, gl.FLOAT, false, fullStride, BUFFER_LAYOUT.FULL_PEAK_OFFSET)

    // Draw the frequency data as points
    gl.drawArrays(gl.POINTS, 0, bufferLength)
    
    // Increment frame counter
    frameCount.value++

  } catch (error) {
    // Silent error handling
  }

  // Continue animation loop
  animationFrameId.value = requestAnimationFrame(render)
}

// Handle canvas resize
const handleResize = () => {
  if (!webglManager.value) return

  const container = canvasRef.value?.parentElement
  if (container) {
    const rect = container.getBoundingClientRect()
    canvasWidth.value = rect.width
    canvasHeight.value = rect.height
    
    // Ensure canvas element has correct dimensions
    if (canvasRef.value) {
      canvasRef.value.width = canvasWidth.value
      canvasRef.value.height = canvasHeight.value
    }
    
    webglManager.value.resizeCanvas(canvasWidth.value, canvasHeight.value)
  }
}

// Handle fullscreen resize specifically
const handleFullscreenResize = () => {
  if (!webglManager.value || !canvasRef.value) return
  
  if (document.fullscreenElement) {
    // In fullscreen, use window dimensions
    canvasWidth.value = window.innerWidth
    canvasHeight.value = window.innerHeight
  } else {
    // Exit fullscreen, restore original container size
    const container = canvasRef.value.parentElement
    if (container) {
      const rect = container.getBoundingClientRect()
      canvasWidth.value = rect.width
      canvasHeight.value = rect.height
    }
  }
  
  // Ensure canvas element has correct dimensions
  if (canvasRef.value) {
    canvasRef.value.width = canvasWidth.value
    canvasRef.value.height = canvasHeight.value
  }
  
  webglManager.value.resizeCanvas(canvasWidth.value, canvasHeight.value)
}

// Toggle fullscreen
const toggleFullscreen = () => {
  const canvas = canvasRef.value
  if (canvas) {
    if (!document.fullscreenElement) {
      canvas.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }
}

// Handle fullscreen changes
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
  
  // Handle resize after fullscreen state change
  nextTick(() => {
    handleFullscreenResize()
  })
}

// Start rendering
const startRender = () => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }
  render()
}

// Stop rendering
const stopRender = () => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
    animationFrameId.value = undefined
  }
}

// Watch for analyser changes
watch(() => props.analyser, (newAnalyser) => {
  if (newAnalyser) {
    // Update buffer size if FFT size changed
    const newFftSize = newAnalyser.fftSize
    if (frequencyData.value.length !== newFftSize / 2) {
      frequencyData.value = new Uint8Array(newFftSize / 2)
      peakData.value = new Uint8Array(newFftSize / 2)
      decayedFrequencyData.value = new Uint8Array(newFftSize / 2)
    }
    startRender()
  } else {
    stopRender()
  }
}, { immediate: true })

// Watch for prop changes
watch(() => props.sensitivity, () => {
  // Reset peaks when sensitivity changes
  peakData.value.fill(0)
})

watch(() => props.decay, () => {
  // Reset peaks and decayed frequency data when decay changes
  peakData.value.fill(0)
  if (decayedFrequencyData.value) {
    decayedFrequencyData.value.fill(0)
  }
})

// Lifecycle
onMounted(async () => {
  await nextTick()
  
  // Initialize WebGL2
  const success = await initWebGL()
  if (!success) return

  // Set up event listeners
  window.addEventListener('resize', handleResize)
  window.addEventListener('resize', handleFullscreenResize)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  
  // Initial resize
  handleResize()
  
  // Start rendering if analyser is available
  if (props.analyser) {
    startRender()
  }
})

onUnmounted(() => {
  stopRender()
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('resize', handleFullscreenResize)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  
  if (webglManager.value) {
    webglManager.value.dispose()
  }
})
</script>

<style scoped>
.visualizer-webgl {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.visualizer-webgl.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  background-color: #000;
}

.visualizer-webgl.fullscreen .visualizer-canvas {
  width: 100vw !important;
  height: 100vh !important;
  border-radius: 0;
}

.visualizer-canvas {
  display: block;
  background: transparent;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.webgl-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 0, 0, 0.9);
  color: white;
  padding: 20px;
  border-radius: 8px;
  font-weight: bold;
  text-align: center;
}

.fullscreen-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  pointer-events: auto;
}

.fullscreen-toggle:hover {
  background-color: rgba(0, 0, 0, 0.9);
}

.fullscreen-toggle:active {
  background-color: rgba(0, 0, 0, 0.9);
}

.fullscreen-toggle svg {
  fill: white;
  width: 24px;
  height: 24px;
}
</style> 