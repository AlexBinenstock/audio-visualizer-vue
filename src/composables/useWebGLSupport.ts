import { ref } from 'vue'
import type VisualizerRadialWebGL from '../components/VisualizerRadialWebGL.vue'

export function useWebGLSupport() {
  // WebGL support state
  const webglSupported = ref(true)
  const webglError = ref<string | null>(null)

  // Ref to the WebGL visualizer component
  const visualizerRef = ref<InstanceType<typeof VisualizerRadialWebGL> | null>(null)

  // Reset visualizer peaks
  const resetVisualizer = () => {
    if (visualizerRef.value) {
      visualizerRef.value.resetPeaks()
    }
  }

  // Handle WebGL errors
  const handleWebGLError = (error?: string) => {
    console.error('WebGL error:', error || 'Unknown WebGL error')
    webglSupported.value = false
    webglError.value = error || 'WebGL initialization failed'
  }

  // Check WebGL support
  const checkWebGLSupport = () => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      if (!gl) {
        handleWebGLError('WebGL not supported in this browser')
        return false
      }
      return true
    } catch (error) {
      handleWebGLError(`WebGL check failed: ${error}`)
      return false
    }
  }

  return {
    webglSupported,
    webglError,
    visualizerRef,
    resetVisualizer,
    handleWebGLError,
    checkWebGLSupport
  }
}
