<template>
  <div class="visualizer-radial" :class="{ 'fullscreen': isFullscreen }">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="visualizer-canvas"
    ></canvas>
    
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

interface Props {
  analyser?: AnalyserNode
  sensitivity?: number
  decay?: number
  frequencyMapping?: 'logarithmic' | 'linear'
}

// Default values
const props = withDefaults(defineProps<Props>(), {
  sensitivity: 1.0,
  decay: 0.7, // Changed from 0.92 to 0.7 for better default behavior
  frequencyMapping: 'logarithmic'
})

// Refs for canvas and animation
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(800)
const animationId = ref<number | null>(null)
const isFullscreen = ref(false)

// Audio data buffers
const frequencyData = ref<Uint8Array>(new Uint8Array(0))
const smoothingBuffer = ref<number[]>([])
const peakData = ref<Uint8Array>(new Uint8Array(0))
const lastUpdateTime = ref<number>(0)

// Smoothing buffer for reducing flicker

// Fullscreen functionality
const toggleFullscreen = async () => {
  try {
    if (!isFullscreen.value) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (error) {
    console.error('Fullscreen error:', error)
  }
}

// Handle resize
const handleResize = () => {
  // Add a small delay to ensure DOM has updated
  setTimeout(() => {
    updateCanvasSize()
  }, 100)
}

// Force canvas reset - useful for fullscreen exit
const forceCanvasReset = () => {
  if (!canvasRef.value) return
  
  // Reset to default dimensions first
  canvasWidth.value = 800
  canvasHeight.value = 800
  
  // Force a reflow
  canvasRef.value.style.width = '100%'
  canvasRef.value.style.height = '100%'
  
  // Then update to actual size
  nextTick(() => {
    updateCanvasSize()
  })
}

// Enhanced fullscreen change handler
const handleFullscreenChange = () => {
  const wasFullscreen = isFullscreen.value
  isFullscreen.value = !!document.fullscreenElement
  
  // If we just exited fullscreen, force a proper reset
  if (wasFullscreen && !isFullscreen.value) {
    // Use a more robust reset approach
    setTimeout(() => {
      forceCanvasReset()
    }, 50)
  } else {
    // Normal fullscreen change
    nextTick(() => {
      updateCanvasSize()
    })
  }
}

// Handle device pixel ratio and resize
const updateCanvasSize = () => {
  if (!canvasRef.value) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  // Ensure we don't set invalid dimensions
  if (rect.width > 0 && rect.height > 0) {
    canvasWidth.value = rect.width * dpr
    canvasHeight.value = rect.height * dpr
    
    // Set CSS size to maintain visual dimensions
    canvasRef.value.style.width = `${rect.width}px`
    canvasRef.value.style.height = `${rect.height}px`
  }
}

// Smooth frequency data with frequency-dependent smoothing for logarithmic mapping
const smoothFrequencyData = (data: Uint8Array): number[] => {
  if (smoothingBuffer.value.length === 0) {
    // Initialize smoothing buffer
    smoothingBuffer.value = Array(data.length).fill(0)
  }
  
  const smoothed = []
  const smoothingFactor = 0.3 // Base smoothing factor
  
  for (let i = 0; i < data.length; i++) {
    // Map bin index to frequency for smoothing adjustment
    const binIndex = i / data.length
    const frequency = getFrequencyFromBin(binIndex)
    
    // Adjust smoothing based on frequency and mapping type
    let adjustedSmoothingFactor = smoothingFactor
    
    if (props.frequencyMapping === 'logarithmic') {
      // In logarithmic mode, adjust smoothing to be more responsive to musical content
      if (frequency < 200) {
        // Bass frequencies - less smoothing for punchy bass
        adjustedSmoothingFactor = 0.2
      } else if (frequency > 8000) {
        // Treble frequencies - more smoothing to reduce harshness
        adjustedSmoothingFactor = 0.4
      } else {
        // Mid frequencies - balanced smoothing
        adjustedSmoothingFactor = 0.3
      }
    }
    
    // Apply smoothing
    const currentValue = data[i] / 255
    const previousValue = smoothingBuffer.value[i]
    const smoothedValue = previousValue * (1 - adjustedSmoothingFactor) + currentValue * adjustedSmoothingFactor
    
    smoothingBuffer.value[i] = smoothedValue
    smoothed.push(smoothedValue)
  }
  
  return smoothed
}



// Update peak data with improved decay for frequency mapping
const updatePeakData = (data: Uint8Array) => {
  const now = performance.now()
  const deltaTime = now - (lastUpdateTime.value || now)
  lastUpdateTime.value = now

  // Enhanced decay calculation - make the effect more visible
  const decayPerSecond = 1 - props.decay
  const decayPerMs = decayPerSecond / 1000
  const frameDecay = Math.pow(1 - decayPerMs, deltaTime)
  
  // Make decay more pronounced by applying additional scaling
  const decayMultiplier = 0.5 + (props.decay * 0.5) // This makes the range more dramatic
  
  // Debug: log decay values occasionally
  if (Math.random() < 0.01) { // 1% chance to log
    console.log('Decay debug:', {
      decay: props.decay,
      decayPerSecond,
      frameDecay,
      deltaTime,
      decayMultiplier
    })
  }

  for (let i = 0; i < data.length; i++) {
    if (data[i] > peakData.value[i]) {
      peakData.value[i] = data[i]
    } else {
      // Apply frequency-dependent decay for logarithmic mapping
      let decayRate = frameDecay
      
      if (props.frequencyMapping === 'logarithmic') {
        // Map bin index to frequency for decay adjustment
        const binIndex = i / data.length
        const frequency = getFrequencyFromBin(binIndex)
        
        // Adjust decay based on frequency - lower frequencies decay slightly slower
        // This compensates for the logarithmic spacing and makes the visualization more musical
        if (frequency < 200) {
          decayRate = Math.pow(decayRate, 0.9) // Slower decay for bass
        } else if (frequency > 8000) {
          decayRate = Math.pow(decayRate, 1.1) // Faster decay for treble
        }
      }
      
      // Apply enhanced decay effect with more pronounced scaling
      peakData.value[i] *= decayRate
      
      // Apply the more dramatic decay multiplier
      peakData.value[i] *= decayMultiplier
      
      if (peakData.value[i] < 1) {
        peakData.value[i] = 0
      }
    }
  }
}

// Calculate frequency from bin index using selected mapping
const getFrequencyFromBin = (binIndex: number): number => {
  const minFreq = 20    // 20 Hz - lower limit of human hearing
  const maxFreq = 8000  // 8 kHz - upper limit for better musical distribution
  
  if (props.frequencyMapping === 'logarithmic') {
    // Use mel-scale frequency mapping for musically relevant distribution
    // This provides full 360° coverage with frequencies mapped according to human hearing
    return melScaleToFrequency(binIndex)
  } else {
    // Linear mapping: equal resolution across all frequencies
    return minFreq + (maxFreq - minFreq) * binIndex
  }
}

// Mel-scale frequency mapping functions
// Based on human auditory perception - lower frequencies get more visual space
function melScaleToFrequency(melValue: number): number {
  // Map 0-1 to 20Hz-8kHz using Mel scale
  const minFreq = 20
  const maxFreq = 8000 // Reduced from 20kHz to 8kHz for better musical distribution
  
  // Convert to Mel scale
  const minMel = 2595 * Math.log10(1 + minFreq / 700)
  const maxMel = 2595 * Math.log10(1 + maxFreq / 700)
  
  // Interpolate in Mel space
  const mel = minMel + (maxMel - minMel) * melValue
  
  // Convert back to frequency
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

function frequencyToMel(frequency: number): number {
  // Convert frequency to mel scale
  return 2595 * Math.log10(1 + frequency / 700)
}

// Get FFT data for a specific frequency
const getFFTDataForFrequency = (frequency: number, data: Uint8Array | number[]): number => {
  // Find the closest FFT bin for this frequency
  const sampleRate = 44100 // Standard sample rate
  const binIndex = Math.round((frequency * data.length) / (sampleRate / 2))
  
  // Clamp to valid range
  const clampedIndex = Math.max(0, Math.min(binIndex, data.length - 1))
  const value = data[clampedIndex]
  
  // Handle both Uint8Array and number[] types
  if (typeof value === 'number') {
    return value // Already normalized
  } else {
    return value / 255 // Normalize Uint8Array values
  }
}

// Apply sensitivity to frequency values with better scaling for logarithmic mapping
const applySensitivity = (value: number, frequency: number): number => {
  // Base sensitivity multiplier
  const baseMultiplier = Math.pow(props.sensitivity, 1.5)
  
  // For logarithmic mapping, we need to adjust sensitivity based on frequency range
  // Lower frequencies (20-200Hz) get more visual space, so we need to balance sensitivity
  let frequencyAdjustedMultiplier = baseMultiplier
  
  if (props.frequencyMapping === 'logarithmic') {
    // In logarithmic mode, lower frequencies are more spread out
    // So we slightly reduce sensitivity for very low frequencies to prevent overwhelming
    if (frequency < 100) {
      frequencyAdjustedMultiplier *= 0.8 // Reduce sensitivity for very low frequencies
    } else if (frequency > 10000) {
      frequencyAdjustedMultiplier *= 1.2 // Increase sensitivity for high frequencies
    }
  }
  
  // Apply sensitivity and clamp to reasonable range
  const result = value * frequencyAdjustedMultiplier
  
  // Clamp to prevent extreme values while allowing amplification
  return Math.min(result, 2.0) // Cap at 2x to prevent overwhelming visualization
}

// Main rendering function
const render = () => {
  if (!canvasRef.value || !props.analyser) return
  
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Get frequency data
  props.analyser.getByteFrequencyData(frequencyData.value)
  
  // Smooth and update peaks
  const smoothedData = smoothFrequencyData(frequencyData.value)
  updatePeakData(frequencyData.value)
  
  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  // Set up canvas context
  ctx.save()
  ctx.translate(canvasWidth.value / 2, canvasHeight.value / 2)
  
  const centerX = 0
  const centerY = 0
  const maxRadius = Math.min(canvasWidth.value, canvasHeight.value) / 2 - 20
  
  // Calculate number of spokes based on FFT size
  const numSpokes = smoothedData.length
  const angleStep = (2 * Math.PI) / numSpokes
  
  // Draw frequency spokes with selected mapping
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'
  
  for (let i = 0; i < numSpokes; i++) {
    const angle = i * angleStep
    
    // Map FFT bin to frequency using selected mapping
    const binIndex = i / numSpokes
    const frequency = getFrequencyFromBin(binIndex)
    
    // Get the corresponding FFT data
    const frequencyValue = getFFTDataForFrequency(frequency, smoothedData)
    
    // Apply sensitivity and calculate radius
    const adjustedValue = applySensitivity(frequencyValue, frequency)
    const radius = adjustedValue * maxRadius
    
    const x = centerX + Math.cos(angle) * radius
    const y = centerY + Math.sin(angle) * radius
    
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  
  // Draw peak overlay with glow effect
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
  ctx.shadowBlur = 10
  
  for (let i = 0; i < numSpokes; i++) {
    const angle = i * angleStep
    
    // Use same mapping for peaks
    const binIndex = i / numSpokes
    const frequency = getFrequencyFromBin(binIndex)
    const peak = getFFTDataForFrequency(frequency, peakData.value)
    
    // Apply sensitivity to peaks as well
    const adjustedPeak = applySensitivity(peak, frequency)
    const radius = adjustedPeak * maxRadius
    
    if (radius > 5) { // Only draw if peak is significant
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius
      
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }
  
  // Reset shadow
  ctx.shadowBlur = 0
  
  // Draw center circle
  ctx.beginPath()
  ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.fill()
  
  // Draw frequency markers for reference
  drawFrequencyMarkers(ctx, maxRadius)
  
  // Draw sensitivity indicator
  drawSensitivityIndicator(ctx, maxRadius)
  
  ctx.restore()
  
  // Continue animation
  animationId.value = requestAnimationFrame(render)
}

// Draw frequency markers around the circle
const drawFrequencyMarkers = (ctx: CanvasRenderingContext2D, maxRadius: number) => {
  const frequencies = [20, 50, 100, 200, 500, 1000, 2000, 4000, 6000, 8000]
  
  ctx.save()
  ctx.font = '12px Arial'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  frequencies.forEach(freq => {
    // Calculate angle using the same mapping as the visualization
    let angle: number
    
    if (props.frequencyMapping === 'logarithmic') {
      // Mel-scale mapping for accurate positioning
      const mel = frequencyToMel(freq)
      const maxMel = frequencyToMel(8000) // Updated to 8kHz cap
      const normalizedMel = mel / maxMel
      angle = (normalizedMel * 2 * Math.PI) - Math.PI / 2 // Start from top
    } else {
      // Linear mapping
      const linearFreq = (freq - 20) / (8000 - 20) // Normalize to 0-1 range (8kHz cap)
      angle = (linearFreq * 2 * Math.PI) - Math.PI / 2 // Start from top
    }
    
    // Position text at outer edge
    const textRadius = maxRadius + 25
    const x = Math.cos(angle) * textRadius
    const y = Math.sin(angle) * textRadius
    
    // Format frequency label
    let label = freq >= 1000 ? `${freq / 1000}k` : freq.toString()
    
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle + Math.PI / 2) // Rotate text to be readable
    ctx.fillText(label, 0, 0)
    ctx.restore()
  })
  
  ctx.restore()
}

// Draw sensitivity indicator
const drawSensitivityIndicator = (ctx: CanvasRenderingContext2D, maxRadius: number) => {
  ctx.save()
  ctx.font = '14px Arial'
  ctx.fillStyle = 'rgba(100, 255, 218, 0.8)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  
  const x = -maxRadius + 10
  const y = -maxRadius + 10
  
  ctx.fillText(`Sensitivity: ${props.sensitivity.toFixed(1)}x`, x, y)
  
  // Draw sensitivity bar
  const barWidth = 100
  const barHeight = 4
  const barX = x
  const barY = y + 20
  
  // Background bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.fillRect(barX, barY, barWidth, barHeight)
  
  // Sensitivity level bar
  const sensitivityLevel = (props.sensitivity - 0.1) / (3.0 - 0.1) // Normalize to 0-1
  ctx.fillStyle = 'rgba(100, 255, 218, 0.8)'
  ctx.fillRect(barX, barY, barWidth * sensitivityLevel, barHeight)
  
  ctx.restore()
}

// Start/stop animation based on analyser availability
const startAnimation = () => {
  if (props.analyser && !animationId.value) {
    render()
  }
}

const stopAnimation = () => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }
}

// Watch for analyser changes
watch(() => props.analyser, (newAnalyser) => {
  if (newAnalyser) {
    // Initialize smoothing buffer
    const fftSize = newAnalyser.fftSize
    const bufferSize = fftSize / 2
    frequencyData.value = new Uint8Array(bufferSize)
    peakData.value = new Uint8Array(bufferSize)
    smoothingBuffer.value = new Array(bufferSize).fill(0)
    
    nextTick(() => {
      startAnimation()
    })
  } else {
    stopAnimation()
  }
}, { immediate: true })

// Watch for decay changes and reset peak data
watch(() => props.decay, (_newDecay) => {
  // Reset peak data when decay changes to avoid artifacts
  if (peakData.value.length > 0) {
    peakData.value.fill(0)
  }
}, { immediate: true })

// Watch for sensitivity changes
watch(() => props.sensitivity, (_newSensitivity) => {
  // Reset peaks when sensitivity changes significantly to avoid visual artifacts
  if (peakData.value.length > 0) {
    peakData.value.fill(0)
  }
}, { immediate: true })

// Lifecycle
onMounted(() => {
  updateCanvasSize()
  window.addEventListener('resize', handleResize)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  
  if (props.analyser) {
    startAnimation()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  stopAnimation()
})
</script>

<style scoped>
.visualizer-radial {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 400px;
  position: relative;
  overflow: hidden; /* Prevent canvas overflow */
}

.visualizer-canvas {
  display: block;
  background: radial-gradient(circle, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  max-width: 100%; /* Ensure canvas doesn't exceed container */
  max-height: 100%;
  object-fit: contain;
}

/* Fullscreen styles */
.visualizer-radial.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #0f0f23;
  overflow: visible; /* Allow full viewport in fullscreen */
}

.visualizer-radial.fullscreen .visualizer-canvas {
  border-radius: 0;
  box-shadow: none;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none;
  max-height: none;
}

/* Fullscreen toggle button */
.fullscreen-toggle {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  z-index: 10;
}

.fullscreen-toggle:hover {
  background: rgba(100, 255, 218, 0.2);
  border-color: #64ffda;
  transform: scale(1.05);
}

.fullscreen-toggle svg {
  transition: transform 0.2s ease;
}

.fullscreen-toggle:hover svg {
  transform: scale(1.1);
}

/* Hide toggle button when not in fullscreen mode */
.visualizer-radial:not(.fullscreen) .fullscreen-toggle {
  opacity: 0;
  pointer-events: none;
}

.visualizer-radial:not(.fullscreen):hover .fullscreen-toggle {
  opacity: 1;
  pointer-events: auto;
}

/* Fullscreen keyboard shortcut hint */
.visualizer-radial.fullscreen::before {
  content: 'Press ESC to exit fullscreen';
  position: absolute;
  top: 20px;
  left: 20px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 500;
  z-index: 10;
  pointer-events: none;
}

/* Ensure proper canvas sizing in normal mode */
.visualizer-radial:not(.fullscreen) .visualizer-canvas {
  width: 100% !important;
  height: 100% !important;
}
</style> 