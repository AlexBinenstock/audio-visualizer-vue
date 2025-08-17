// Centralized audio features for all layers.
// Input: raw FFT (dB from Tone.Analyser.getValue()), RMS (dB from Tone.Meter), sampleRate.
// Output: normalized Features with log-resampled, AC-coupled bins and musical summaries.

export type Bands = { low: number; mid: number; high: number };

export type Features = {
  // timing
  t: number;          // ms
  dt: number;         // ms since last call

  // meters
  rmsDb: number;      // input RMS in dB
  rms01: number;      // 0..1 normalized loudness (for widths, etc.)
  rmsPeak01: number;  // normalized to a decaying running max (0..1)
  energy: number;     // smoothed loudness 0..1 (attack/decay)
  energyPeak01: number; // energy relative to decaying running max (0..1)
  onset: boolean;     // kick-ish moment

  // spectral summaries
  bands: Bands;       // 0..1 (post AC + compression)
  bandsRaw: Bands;    // 0..1 (pre AC, post dB→unit + optional spatial smooth)
  centroidHz: number; // rough brightness proxy
  rolloffHz: number;  // 85% spectral rolloff

  // ready-to-use, log-spaced, AC-coupled, soft-kneed magnitudes
  bins: Float32Array;     // primary, normalized 0..1 (per-bin adaptive peak AGC)
  binsLog: Float32Array; // length = cfg.logBins (default 128), values 0..1
  binsLogRaw: Float32Array; // same length, mapped 0..1 but NOT AC-coupled or kneed (debug)
};

export type FeatureExtractorOptions = Partial<{
  // FFT→bins config
  logBins: number;        // output bin count for binsLog
  fMin: number;           // 20
  fMax: number;           // 8000

  // dB→unit mapping for spectrum and RMS
  dbMin: number;          // -100
  dbMax: number;          // -30
  rmsDbMin: number;       // -60
  rmsDbMax: number;       // -10
  dbGamma: number;        // 1.3

  // spatial smoothing over bins
  spatialSmooth: boolean; // true
  spatialKernel: [number, number, number]; // [0.25, 0.5, 0.25]

  // baseline (AC coupling)
  baselineTauMs: number;  // 1500
  deadband: number;       // 0.02 (post-map, pre-knee)
  knee: number;           // 0.20

  // energy smoothing & onset
  attackMs: number;       // 50
  decayMs: number;        // 220
  onsetWindowMs: number;  // 600
  onsetK: number;         // 1.5 (z-score threshold)

  // adaptive peak tracking
  peakDecayMs: number;    // 3000 (decay running peaks)
}>;

const DEFAULTS: Required<FeatureExtractorOptions> = {
  logBins: 128,
  fMin: 20,
  fMax: 8000,

  dbMin: -100,
  dbMax: -30,
  rmsDbMin: -60,
  rmsDbMax: -6,
  dbGamma: 1.3,

  spatialSmooth: true,
  spatialKernel: [0.25, 0.5, 0.25],

  baselineTauMs: 1500,
  deadband: 0.02,
  knee: 0.20,

  attackMs: 35,
  decayMs: 150,
  onsetWindowMs: 600,
  onsetK: 1.5,
  peakDecayMs: 3000,
};

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function mapDb01(xDb: number, minDb: number, maxDb: number, gamma = 1) {
  const u = (xDb - minDb) / (maxDb - minDb);
  return Math.pow(clamp01(u), gamma);
}
function expCoeff(dtMs: number, tauMs: number) {
  return Math.exp(-dtMs / Math.max(1, tauMs));
}

function smooth3(src: Float32Array, out: Float32Array, k: [number, number, number]) {
  const n = src.length;
  const [a, b, c] = k; // e.g., [0.25, 0.5, 0.25]
    for (let i = 0; i < n; i++) {
    const im1 = (i - 1 + n) % n, ip1 = (i + 1) % n;
    out[i] = a * src[im1] + b * src[i] + c * src[ip1];
  }
}

function hzToFftIndex(hz: number, fftLen: number, sampleRate: number) {
  const nyquist = sampleRate * 0.5;
  const clamped = Math.max(0, Math.min(nyquist, hz));
  return (clamped / nyquist) * (fftLen - 1);
}

export function createFeatureExtractor(opts: FeatureExtractorOptions = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  // state retained across frames
  let lastT = performance.now();
  let baseline: Float32Array | null = null;     // per-log-bin EMA
  let baselineEnabled = true;
  let tmpA: Float32Array | null = null;         // temp for smoothing
  let onsetRing: number[] = [];                 // last few energies for mean/std
  let energy = 0;
  let energyPeak = 1e-6;                        // decaying running max for energy
  let rmsPeak = 1e-6;                           // decaying running max for rms01
  let binsPeak: Float32Array | null = null;     // per-bin decaying running max for AGC

  return function extract(fftDb: Float32Array, rmsDb: number, sampleRate: number): Features {
    const t = performance.now();
    const dt = Math.max(1, t - lastT);
    lastT = t;

    // Guard
    const fftN = fftDb?.length || 0;
    if (!fftN || !isFinite(sampleRate) || sampleRate <= 0) {
      return {
        t, dt,
        rmsDb: -Infinity, rms01: 0, rmsPeak01: 0, energy: 0, energyPeak01: 0, onset: false,
        bands: { low: 0, mid: 0, high: 0 },
        bandsRaw: { low: 0, mid: 0, high: 0 },
        centroidHz: 0, rolloffHz: 0,
        bins: new Float32Array(cfg.logBins),
        binsLog: new Float32Array(cfg.logBins),
        binsLogRaw: new Float32Array(cfg.logBins),
      };
    }

    // 1) Resample FFT (in dB) to log-spaced bins
    const out = new Float32Array(cfg.logBins);
    const ny = sampleRate * 0.5;
    const fMax = Math.min(cfg.fMax, ny);
    const fMin = Math.max(1, Math.min(cfg.fMin, fMax - 1));
    for (let i = 0; i < cfg.logBins; i++) {
      const tLog = i / (cfg.logBins - 1); // 0..1
      const hz = fMin * Math.pow(fMax / fMin, tLog);
      const fftIdx = hzToFftIndex(hz, fftN, sampleRate);
      // linear interpolate within fftDb (no wrap)
      const i0 = Math.max(0, Math.min(fftN - 2, Math.floor(fftIdx)));
      const frac = fftIdx - i0;
      const v = fftDb[i0] * (1 - frac) + fftDb[i0 + 1] * frac; // still dB
      out[i] = v;
    }

    // 2) Optional spatial smoothing in dB domain
    if (!tmpA || tmpA.length !== out.length) tmpA = new Float32Array(out.length);
    if (cfg.spatialSmooth) smooth3(out, tmpA, cfg.spatialKernel); else tmpA.set(out);

    // 3) Map dB→unit (0..1), compress mids with gamma
    for (let i = 0; i < tmpA.length; i++) {
      tmpA[i] = mapDb01(tmpA[i], cfg.dbMin, cfg.dbMax, cfg.dbGamma);
    }

    // 4) Per-bin baseline (AC coupling) + deadband + soft knee
    if (!baseline || baseline.length !== tmpA.length) baseline = new Float32Array(tmpA.length);
    const aBase = expCoeff(dt, cfg.baselineTauMs); // EMA coeff
    const binsLog = new Float32Array(tmpA.length);
    const binsLogRaw = new Float32Array(tmpA.length);
    for (let i = 0; i < tmpA.length; i++) {
      const bl = baseline[i] = baselineEnabled ? (baseline[i] * aBase + tmpA[i] * (1 - aBase)) : 0;
      binsLogRaw[i] = tmpA[i];
      let d = tmpA[i] - bl - cfg.deadband;
      if (d < 0) d = 0;
      const kneeT = d / (cfg.knee + d); // soft knee
      binsLog[i] = kneeT * kneeT;       // emphasize hits, keep small stuff tame
    }

    // 4.5) Per-bin adaptive peak AGC -> bins
    if (!binsPeak || binsPeak.length !== binsLog.length) binsPeak = new Float32Array(binsLog.length)
    const bins = new Float32Array(binsLog.length)
    const peakDecayBins = expCoeff(dt, cfg.peakDecayMs)
    for (let i = 0; i < binsLog.length; i++) {
      const peakPrev = binsPeak[i]
      const peakNext = Math.max(binsLog[i], peakPrev * peakDecayBins)
      binsPeak[i] = peakNext
      const denom = peakNext > 1e-5 ? peakNext : 1e-5
      bins[i] = Math.min(1, binsLog[i] / denom)
    }

    // 5) Summaries on binsLog
    const band = (arr: Float32Array, loHz: number, hiHz: number) => {
      if (hiHz <= loHz) return 0;
      const ilo = Math.max(0, Math.min(arr.length - 1, Math.round((Math.log(loHz) - Math.log(fMin)) / (Math.log(fMax) - Math.log(fMin)) * (arr.length - 1))));
      const ihi = Math.max(ilo, Math.min(arr.length - 1, Math.round((Math.log(hiHz) - Math.log(fMin)) / (Math.log(fMax) - Math.log(fMin)) * (arr.length - 1))));
      let s = 0; for (let i = ilo; i <= ihi; i++) s += arr[i];
      return s / Math.max(1, ihi - ilo + 1);
    };
    const bands: Bands = {
      low: band(binsLog, 20, 160),
      mid: band(binsLog, 160, 2000),
      high: band(binsLog, 2000, 8000),
    };
    const bandsRaw: Bands = {
      low: band(binsLogRaw, 20, 160),
      mid: band(binsLogRaw, 160, 2000),
      high: band(binsLogRaw, 2000, 8000),
    };

    // centroid & rolloff (use mapped magnitudes as weights; crude but stable)
    let wSum = 0, fSum = 0, cum = 0, rollHz = fMin;
    const target = 0.85 * binsLog.reduce((s, v) => s + v, 0);
    for (let i = 0; i < binsLog.length; i++) {
      const tLog = i / (binsLog.length - 1);
      const hz = fMin * Math.pow(fMax / fMin, tLog);
      const w = binsLog[i];
      wSum += w; fSum += w * hz;
      cum += w;
      if (cum >= target) { rollHz = hz; break; }
    }
    const centroidHz = wSum > 0 ? fSum / wSum : 0;

    // 6) RMS mapping + energy smoothing + onset
    const rms01 = mapDb01(rmsDb, cfg.rmsDbMin, cfg.rmsDbMax, 1.0);
    const aAtk = expCoeff(dt, cfg.attackMs), aDec = expCoeff(dt, cfg.decayMs);
    const targetEnergy = rms01;
    energy = targetEnergy > energy ? (aAtk * energy + (1 - aAtk) * targetEnergy)
                                   : (aDec * energy + (1 - aDec) * targetEnergy);

    // adaptive peaks (decaying running maxima)
    const peakDecay = expCoeff(dt, cfg.peakDecayMs);
    rmsPeak = Math.max(rms01, rmsPeak * peakDecay);
    energyPeak = Math.max(energy, energyPeak * peakDecay);
    const rmsPeak01 = rmsPeak > 1e-6 ? clamp01(rms01 / rmsPeak) : 0;
    const energyPeak01 = energyPeak > 1e-6 ? clamp01(energy / energyPeak) : 0;

    // maintain an energy ring buffer ~ onsetWindowMs
    const maxSamples = Math.max(3, Math.floor(cfg.onsetWindowMs / dt));
    onsetRing.push(energy);
    while (onsetRing.length > maxSamples) onsetRing.shift();
    // mean/std
    let m = 0; for (const v of onsetRing) m += v; m /= onsetRing.length;
    let v2 = 0; for (const v of onsetRing) { const d = v - m; v2 += d * d; }
    const std = Math.sqrt(v2 / Math.max(1, onsetRing.length - 1));
    const onset = (energy - m) > (cfg.onsetK * std + 0.02); // small bias

    return {
      t, dt,
      rmsDb, rms01, rmsPeak01, energy, energyPeak01, onset,
      bands, bandsRaw, centroidHz, rolloffHz: rollHz,
      bins, binsLog, binsLogRaw, // normalized + processed + raw
    };
  };
}

