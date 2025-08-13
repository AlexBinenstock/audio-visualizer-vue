export type Bands = { low: number; mid: number; high: number }

export type Features = {
  t: number
  sampleRate: number
  rms: number
  energy: number
  onset: boolean
  bands: Bands
  centroidHz: number
  rolloffHz: number
  binsLog: Float32Array
}

type ExtractorOptions = {
  minDb?: number
  maxDb?: number
  gamma?: number
  minHz?: number
  maxHz?: number
  numLogBins?: number
  attackMs?: number
  decayMs?: number
  onsetWindowMs?: number
  onsetK?: number
  onsetHysteresis?: number
}

export function createFeatureExtractor(opts: ExtractorOptions = {}) {
  const minDb = opts.minDb ?? -90
  const maxDb = opts.maxDb ?? -10
  const gamma = opts.gamma ?? 0.7
  const minHzDefault = opts.minHz ?? 20
  const maxHzDefault = opts.maxHz ?? 8000
  const numLogBins = opts.numLogBins ?? 128
  const attackMs = opts.attackMs ?? 50
  const decayMs = opts.decayMs ?? 200
  const onsetWindowMs = opts.onsetWindowMs ?? 600
  const onsetK = opts.onsetK ?? 1.5
  const onsetHysteresis = opts.onsetHysteresis ?? 0.03

  // Internal state (persisted across calls)
  let lastT = performance.now()
  let currentSampleRate = 44100
  let nyquist = currentSampleRate / 2
  let maxHzClamped = Math.min(maxHzDefault, nyquist)
  let minHzClamped = Math.max(minHzDefault, 1)

  // Precomputed for log resampling
  let logBinFreqs = new Float32Array(numLogBins)
  let logBinSrcIndexL = new Int32Array(numLogBins)
  let logBinSrcIndexR = new Int32Array(numLogBins)
  let logBinSrcInterp = new Float32Array(numLogBins)

  // Smoothed log bins and energy
  const smoothedBins = new Float32Array(numLogBins)
  let smoothedEnergy = 0

  // Onset detection buffer
  const onsetCapacity = Math.max(4, Math.round((onsetWindowMs / 1000) * 120)) // ~120 samples/sec window
  const energyHistory = new Float32Array(onsetCapacity)
  let energyHistorySize = 0
  let energyHistoryIndex = 0
  let onsetState = false

  // Reusable scratch
  let linearMagScratch: Float32Array | null = null

  const features: Features = {
    t: lastT,
    sampleRate: currentSampleRate,
    rms: 0,
    energy: 0,
    onset: false,
    bands: { low: 0, mid: 0, high: 0 },
    centroidHz: 0,
    rolloffHz: 0,
    binsLog: smoothedBins,
  }

  function remapDbToUnit(db: number): number {
    if (!isFinite(db)) return 0
    const x = (db - minDb) / (maxDb - minDb)
    const n = Math.min(1, Math.max(0, x))
    return Math.pow(n, gamma)
  }

  function ensureResampleMap(sampleRate: number, srcLength: number) {
    if (sampleRate === currentSampleRate && Math.abs(nyquist - sampleRate / 2) < 1e-6 && Math.abs(maxHzClamped - Math.min(maxHzDefault, sampleRate / 2)) < 1e-6 && logBinFreqs.length === numLogBins) {
      // Might still need to update map if srcLength changed drastically; but bin index math only uses freq/nyquist
      // No-op in typical cases
    }
    currentSampleRate = sampleRate
    nyquist = currentSampleRate / 2
    maxHzClamped = Math.min(maxHzDefault, nyquist)
    minHzClamped = Math.max(minHzDefault, 1)

    // Log-spaced frequencies
    const minLog = Math.log10(minHzClamped)
    const maxLog = Math.log10(maxHzClamped)
    for (let i = 0; i < numLogBins; i++) {
      const t = i / (numLogBins - 1)
      const f = Math.pow(10, minLog + t * (maxLog - minLog))
      logBinFreqs[i] = f
      // Map to source fractional bin index: src bins range [0..srcLength-1] cover [0..nyquist]
      const fracIndex = (f / nyquist) * (srcLength - 1)
      let i0 = Math.floor(fracIndex)
      let i1 = i0 + 1
      const w = fracIndex - i0
      if (i0 < 0) { i0 = 0 }
      if (i1 >= srcLength) { i1 = srcLength - 1 }
      logBinSrcIndexL[i] = i0
      logBinSrcIndexR[i] = i1
      logBinSrcInterp[i] = isFinite(w) ? Math.min(1, Math.max(0, w)) : 0
    }
  }

  function smoothValue(prev: number, next: number, dtMs: number): number {
    const tau = next > prev ? attackMs : decayMs
    const alpha = 1 - Math.exp(-dtMs / Math.max(1, tau))
    return prev + (next - prev) * alpha
  }

  function computeBandsFromLinear(linear: Float32Array, sampleRate: number): Bands {
    const n = linear.length
    const binHz = (sampleRate / 2) / Math.max(1, n)
    let lowSum = 0, lowCount = 0
    let midSum = 0, midCount = 0
    let highSum = 0, highCount = 0
    const lowHi = Math.min(160, nyquist)
    const midHi = Math.min(2000, nyquist)
    const highHi = Math.min(8000, nyquist)
    for (let i = 0; i < n; i++) {
      const f = i * binHz
      const v = linear[i]
      if (f >= 20 && f < lowHi) { lowSum += v; lowCount++ }
      else if (f >= 160 && f < midHi) { midSum += v; midCount++ }
      else if (f >= 2000 && f < highHi) { highSum += v; highCount++ }
    }
    const low = lowCount ? lowSum / lowCount : 0
    const mid = midCount ? midSum / midCount : 0
    const high = highCount ? highSum / highCount : 0
    return { low, mid, high }
  }

  function computeCentroidAndRolloff(linear: Float32Array, sampleRate: number): { centroid: number; rolloff: number } {
    const n = linear.length
    const binHz = (sampleRate / 2) / Math.max(1, n)
    let sumMag = 0
    let sumFreqMag = 0
    for (let i = 0; i < n; i++) {
      const mag = linear[i]
      const freq = i * binHz
      sumMag += mag
      sumFreqMag += mag * freq
    }
    const centroid = sumMag > 1e-6 ? (sumFreqMag / sumMag) : 0
    // 85% rolloff
    let cumulative = 0
    const target = sumMag * 0.85
    let rolloff = 0
    for (let i = 0; i < n; i++) {
      cumulative += linear[i]
      if (cumulative >= target) { rolloff = i * binHz; break }
    }
    if (rolloff === 0 && n > 0) rolloff = (n - 1) * binHz
    return { centroid, rolloff }
  }

  function updateOnset(energy: number): boolean {
    // Ring buffer push
    energyHistory[energyHistoryIndex] = energy
    energyHistoryIndex = (energyHistoryIndex + 1) % onsetCapacity
    if (energyHistorySize < onsetCapacity) energyHistorySize++

    // Compute mean/std
    let mean = 0
    for (let i = 0; i < energyHistorySize; i++) mean += energyHistory[i]
    mean /= Math.max(1, energyHistorySize)
    let variance = 0
    for (let i = 0; i < energyHistorySize; i++) {
      const d = energyHistory[i] - mean
      variance += d * d
    }
    variance /= Math.max(1, energyHistorySize)
    const std = Math.sqrt(variance)

    const threshold = mean + onsetK * std
    if (!onsetState) {
      if (energy > threshold + onsetHysteresis) onsetState = true
    } else {
      if (energy < threshold - onsetHysteresis) onsetState = false
    }
    return onsetState
  }

  return function extract(fftDb: Float32Array, rmsDbOrLin: number, sampleRate: number): Features {
    const now = performance.now()
    const dtMs = Math.max(1, now - lastT)
    lastT = now

    // Handle empty input robustly
    if (!fftDb || fftDb.length === 0) {
      // Still update sample rate, rms/energy, onset, and timestamp
      currentSampleRate = sampleRate
      nyquist = currentSampleRate / 2
      let rmsNorm: number
      if (isFinite(rmsDbOrLin) && rmsDbOrLin <= 0) {
        rmsNorm = remapDbToUnit(rmsDbOrLin)
      } else {
        rmsNorm = Math.min(1, Math.max(0, rmsDbOrLin || 0))
        rmsNorm = Math.pow(rmsNorm, gamma)
      }
      smoothedEnergy = smoothValue(smoothedEnergy, rmsNorm, dtMs)
      const onset = updateOnset(smoothedEnergy)
      features.t = now
      features.sampleRate = sampleRate
      features.rms = rmsNorm
      features.energy = smoothedEnergy
      features.onset = onset
      return features
    }

    // Prepare resampling map and scratch
    ensureResampleMap(sampleRate, fftDb.length)
    if (!linearMagScratch || linearMagScratch.length !== fftDb.length) {
      linearMagScratch = new Float32Array(fftDb.length)
    }

    // Convert dB to normalized linear [0..1]
    for (let i = 0; i < fftDb.length; i++) {
      linearMagScratch[i] = remapDbToUnit(fftDb[i])
    }

    // Resample to log bins with bilinear interpolation; then smooth with attack/decay
    for (let i = 0; i < numLogBins; i++) {
      const l = logBinSrcIndexL[i]
      const r = logBinSrcIndexR[i]
      const w = logBinSrcInterp[i]
      const v = linearMagScratch[l] * (1 - w) + linearMagScratch[r] * w
      smoothedBins[i] = smoothValue(smoothedBins[i], v, dtMs)
    }

    // RMS normalize (handle dB or linear input)
    let rmsNorm: number
    if (isFinite(rmsDbOrLin) && rmsDbOrLin <= 0) {
      // Likely dB
      rmsNorm = remapDbToUnit(rmsDbOrLin)
    } else {
      // Linear 0..1 clamp
      rmsNorm = Math.min(1, Math.max(0, rmsDbOrLin || 0))
      // Apply gamma for perceptual shaping
      rmsNorm = Math.pow(rmsNorm, gamma)
    }

    // Energy smoothing
    smoothedEnergy = smoothValue(smoothedEnergy, rmsNorm, dtMs)

    // Bands/centroid/rolloff from full-resolution linear bins
    const bands = computeBandsFromLinear(linearMagScratch, sampleRate)
    const { centroid, rolloff } = computeCentroidAndRolloff(linearMagScratch, sampleRate)

    // Onset detection
    const onset = updateOnset(smoothedEnergy)

    // Populate features (reuse object and arrays)
    features.t = now
    features.sampleRate = sampleRate
    features.rms = rmsNorm
    features.energy = smoothedEnergy
    features.onset = onset
    features.bands.low = bands.low
    features.bands.mid = bands.mid
    features.bands.high = bands.high
    features.centroidHz = centroid
    features.rolloffHz = rolloff
    // binsLog already references smoothedBins
    return features
  }
}


