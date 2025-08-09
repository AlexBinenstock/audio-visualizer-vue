import { ref, watch } from 'vue'

export function useVisualizationParams() {
  // Parameters
  const sensitivity = ref(1.0)
  const decay = ref(0.7) // Changed from 0.92 to 0.7 for better default behavior
  const frequencyMapping = ref<'logarithmic' | 'linear'>('logarithmic')

  // Get human-readable description of decay value
  const getDecayDescription = (decayValue: number): string => {
    if (decayValue <= 0.3) return "Very fast decay - peaks disappear in milliseconds"
    if (decayValue <= 0.5) return "Fast decay - peaks fade in under a second"
    if (decayValue <= 0.7) return "Medium decay - peaks linger for a few seconds"
    if (decayValue <= 0.85) return "Slow decay - peaks persist for several seconds"
    return "Very slow decay - peaks persist for many seconds"
  }

  // Get human-readable description of sensitivity value
  const getSensitivityDescription = (sensitivityValue: number): string => {
    if (sensitivityValue <= 0.5) return "Quiet - sensitive to subtle sounds"
    if (sensitivityValue <= 1.0) return "Medium - balanced sensitivity"
    if (sensitivityValue <= 2.0) return "Loud - sensitive to louder sounds"
    return "Very loud - extremely sensitive"
  }

  // New handlers for input changes
  const handleSensitivityChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    sensitivity.value = parseFloat(target.value)
  }

  const handleDecayChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    decay.value = parseFloat(target.value)
  }

  return {
    // Parameters
    sensitivity,
    decay,
    frequencyMapping,
    
    // Methods
    getDecayDescription,
    getSensitivityDescription,
    handleSensitivityChange,
    handleDecayChange
  }
}
