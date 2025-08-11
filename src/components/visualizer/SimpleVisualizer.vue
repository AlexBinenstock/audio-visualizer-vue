<template>
  <div class="visualizer-container">
    <canvas ref="canvasRef" class="visualizer-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'

interface Props {
  audioData: Float32Array
  rmsData?: Float32Array
}

const props = defineProps<Props>()

const canvasRef = ref<HTMLCanvasElement>()
let scene: THREE.Scene
let camera: THREE.OrthographicCamera
let renderer: THREE.WebGLRenderer
let circleMesh: THREE.Line
let animationId: number | null = null

// Simplified parameters - Tone.js will handle most of the complexity
const CENTER_X = 0
const CENTER_Y = 0
const BASE_RADIUS = 0.3
const MAX_BUMP = 0.15 // Reduced for more subtle movement
const SPOKE_COUNT = 12 // Number of invisible spokes around the circle

// Debug mode for troubleshooting
const DEBUG_MODE = false

// Use Tone.js frequency ranges (in Hz) for more accurate band separation
const FREQ_BANDS = {
  bass: { low: 20, high: 250 },    // Bass: 20-250 Hz
  mids: { low: 250, high: 2000 },  // Mids: 250-2000 Hz  
  highs: { low: 2000, high: 8000 } // Highs: 2000-8000 Hz
}

// Initialize Three.js
const initializeThreeJS = async () => {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  
  const aspect = rect.width / rect.height
  camera = new THREE.OrthographicCamera(-1, 1, 1 / aspect, -1 / aspect, 0.1, 1000)
  camera.position.z = 1
  
  renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true,
    alpha: false 
  })
  renderer.setSize(canvas.width, canvas.height)
  renderer.setPixelRatio(window.devicePixelRatio)
  
  createCircle()
  animate()
}

// Create the circular line
const createCircle = () => {
  const positions: number[] = []
  
  // Generate circle points
  for (let i = 0; i <= 360; i++) {
    const angle = (i * Math.PI) / 180
    const x = CENTER_X + BASE_RADIUS * Math.cos(angle)
    const y = CENTER_Y + BASE_RADIUS * Math.sin(angle)
    positions.push(x, y, 0)
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  
  const material = new THREE.LineBasicMaterial({ 
    color: 0xffffff,
    linewidth: 2
  })
  
  circleMesh = new THREE.Line(geometry, material)
  scene.add(circleMesh)
}

// Simplified frequency analysis using Tone.js data
const analyzeFrequencyBands = (fftData: Float32Array) => {
  if (!fftData || fftData.length === 0) {
    return { bass: 0, mids: 0, highs: 0 }
  }
  
  // Tone.js gives us dB values, but we can work with them directly
  // Convert dB to linear scale for visualization (more responsive)
  const linearData = fftData.map(db => {
    // Handle -Infinity values (silence) and other invalid values
    if (!isFinite(db) || db === -Infinity) return 0
    // Convert dB to linear scale, normalize to 0-1 range
    const linear = Math.pow(10, (db + 60) / 20)
    return isFinite(linear) ? Math.max(0, linear) : 0
  })
  
  // Calculate frequency resolution (assuming 44.1kHz sample rate)
  const sampleRate = 44100
  const binSize = sampleRate / (2 * fftData.length)
  
  // Map frequency bins to our three bands
  const bassBins = linearData.filter((_, index) => {
    const freq = index * binSize
    return freq >= FREQ_BANDS.bass.low && freq < FREQ_BANDS.bass.high
  })
  
  const midsBins = linearData.filter((_, index) => {
    const freq = index * binSize
    return freq >= FREQ_BANDS.mids.low && freq < FREQ_BANDS.mids.high
  })
  
  const highsBins = linearData.filter((_, index) => {
    const freq = index * binSize
    return freq >= FREQ_BANDS.highs.low && freq < FREQ_BANDS.highs.high
  })
  
  // Calculate average amplitude for each band with safety checks
  const bass = bassBins.length > 0 ? 
    Math.max(0, bassBins.reduce((sum, val) => sum + (isFinite(val) ? val : 0), 0) / bassBins.length) : 0
  const mids = midsBins.length > 0 ? 
    Math.max(0, midsBins.reduce((sum, val) => sum + (isFinite(val) ? val : 0), 0) / midsBins.length) : 0
  const highs = highsBins.length > 0 ? 
    Math.max(0, highsBins.reduce((sum, val) => sum + (isFinite(val) ? val : 0), 0) / highsBins.length) : 0
  
  // Final validation of all values
  const result = {
    bass: isFinite(bass) ? Math.max(0, bass) : 0,
    mids: isFinite(mids) ? Math.max(0, mids) : 0,
    highs: isFinite(highs) ? Math.max(0, highs) : 0
  }
  
  return result
}

// Update the circle based on frequency data and RMS using invisible spokes
const updateCircle = (freqData: { bass: number, mids: number, highs: number }) => {
  if (!circleMesh) return
  
  const newGeometry = new THREE.BufferGeometry()
  const positions: number[] = []
  
  // Get RMS value for color changes only
  let rmsValue = 0
  if (props.rmsData && props.rmsData.length > 0) {
    const rawRms = props.rmsData[0]
    if (isFinite(rawRms) && rawRms > -Infinity) {
      rmsValue = Math.max(0, rawRms)
    }
  }
  
  if (DEBUG_MODE) {
    console.log('Visualizer Debug - Raw RMS:', props.rmsData?.[0], 'Processed RMS:', rmsValue)
    console.log('Visualizer Debug - Raw Freq Data:', freqData)
  }
  
  // Validate frequency data to prevent NaN
  const safeBass = isFinite(freqData.bass) ? Math.max(0, freqData.bass) : 0
  const safeMids = isFinite(freqData.mids) ? Math.max(0, freqData.mids) : 0
  const safeHighs = isFinite(freqData.highs) ? Math.max(0, freqData.highs) : 0
  
  if (DEBUG_MODE) {
    console.log('Visualizer Debug - Safe Freq Data:', { safeBass, safeMids, safeHighs })
  }
  
  // Create invisible spokes that influence the circle shape
  const spokes: number[] = []
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const spokeAngle = (i * 2 * Math.PI) / SPOKE_COUNT
    
    // Map different frequency bands to different spoke directions
    let spokeStrength = 0
    if (i < SPOKE_COUNT / 3) {
      // First third: bass influence
      spokeStrength = safeBass
    } else if (i < (2 * SPOKE_COUNT) / 3) {
      // Middle third: mids influence
      spokeStrength = safeMids
    } else {
      // Last third: highs influence
      spokeStrength = safeHighs
    }
    
    // Store spoke angle and strength
    spokes.push(spokeAngle, spokeStrength)
  }
  
  // Generate smooth circle with spoke influence
  for (let i = 0; i <= 360; i++) {
    const angle = (i * Math.PI) / 180
    let radius = BASE_RADIUS
    
    // Apply spoke influence with smooth interpolation
    for (let j = 0; j < spokes.length; j += 2) {
      const spokeAngle = spokes[j]
      const spokeStrength = spokes[j + 1]
      
      // Calculate distance from current angle to spoke angle
      let angleDiff = Math.abs(angle - spokeAngle)
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff
      }
      
      // Smooth influence based on distance (Gaussian-like falloff)
      const influence = Math.exp(-(angleDiff * angleDiff) * 8) // Adjust 8 for falloff speed
      radius += spokeStrength * MAX_BUMP * influence
    }
    
    // Ensure radius stays within reasonable bounds
    radius = Math.max(BASE_RADIUS * 0.8, Math.min(BASE_RADIUS * 1.4, radius))
    
    const x = CENTER_X + radius * Math.cos(angle)
    const y = CENTER_Y + radius * Math.sin(angle)
    
    // Final validation of coordinates
    if (isFinite(x) && isFinite(y)) {
      positions.push(x, y, 0)
    } else {
      // Fallback to base circle if coordinates are invalid
      const fallbackX = CENTER_X + BASE_RADIUS * Math.cos(angle)
      const fallbackY = CENTER_Y + BASE_RADIUS * Math.sin(angle)
      positions.push(fallbackX, fallbackY, 0)
    }
  }
  
  // Ensure we have valid positions before creating geometry
  if (positions.length === 0) {
    console.warn('No valid positions generated, creating fallback circle')
    // Create a simple fallback circle with base radius
    for (let i = 0; i <= 360; i++) {
      const angle = (i * Math.PI) / 180
      const x = CENTER_X + BASE_RADIUS * Math.cos(angle)
      const y = CENTER_Y + BASE_RADIUS * Math.sin(angle)
      positions.push(x, y, 0)
    }
  }
  
  newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  
  // Replace the old geometry
  circleMesh.geometry.dispose()
  circleMesh.geometry = newGeometry
  
  // Update material color based on RMS for visual feedback
  if (circleMesh.material instanceof THREE.LineBasicMaterial) {
    const intensity = Math.min(1, rmsValue * 2) // Scale RMS to 0-1 range
    const color = new THREE.Color(0xffffff)
    color.lerp(new THREE.Color(0x64ffda), intensity * 0.3) // Blend with accent color
    circleMesh.material.color = color
  }
}

// Animation loop
const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  try {
    // Get frequency data and update circle
    if (props.audioData && props.audioData.length > 0) {
      const freqData = analyzeFrequencyBands(props.audioData)
      updateCircle(freqData)
    }
    
    renderer.render(scene, camera)
  } catch (error) {
    console.error('Error in animation loop:', error)
    // Continue animation even if there's an error
  }
}

// Watch for audio data changes
watch(() => props.audioData, (newData) => {
  if (newData && newData.length > 0) {
    const freqData = analyzeFrequencyBands(newData)
    updateCircle(freqData)
  }
}, { deep: true })

// Watch for RMS data changes for real-time responsiveness
watch(() => props.rmsData, (newRmsData) => {
  if (newRmsData && newRmsData.length > 0 && props.audioData && props.audioData.length > 0) {
    const freqData = analyzeFrequencyBands(props.audioData)
    updateCircle(freqData)
  }
}, { deep: true })

// Lifecycle
onMounted(async () => {
  await nextTick()
  await initializeThreeJS()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<style scoped>
.visualizer-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
}

.visualizer-canvas {
  width: 300px;
  height: 150px;
  display: block;
}
</style>
