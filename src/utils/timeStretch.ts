/**
 * WSOLA (Waveform Similarity Overlap-Add) time-stretching.
 * Changes playback speed without altering pitch.
 */

/**
 * Time-stretch a region of an AudioBuffer using WSOLA.
 * Returns a new AudioBuffer with the stretched audio.
 *
 * @param buffer   Source AudioBuffer
 * @param startTime  Start offset in seconds within the buffer
 * @param endTime    End offset in seconds within the buffer
 * @param rate     Speed factor (2.0 = twice as fast, 0.5 = half speed)
 * @param ctx      AudioContext (or BaseAudioContext) for creating the output buffer
 */
export function timeStretchRegion(
  buffer: AudioBuffer,
  startTime: number,
  endTime: number,
  rate: number,
  ctx: BaseAudioContext,
): AudioBuffer {
  const sr = buffer.sampleRate;
  const s0 = Math.max(0, Math.floor(startTime * sr));
  const s1 = Math.min(buffer.length, Math.ceil(endTime * sr));
  const inputLen = s1 - s0;

  if (inputLen <= 0) {
    return ctx.createBuffer(buffer.numberOfChannels, 1, sr);
  }

  const numCh = buffer.numberOfChannels;

  // OLA parameters — larger window for extreme rates gives smoother output
  const W = rate > 3 ? 4096 : 2048; // window size in samples
  const H = W >>> 2; // synthesis hop (75% overlap)
  const Ha = Math.max(1, Math.round(H * rate)); // analysis hop

  // WSOLA seek range: only engage for rates > 1.2 where artifacts are audible
  const seekLen = rate > 1.2 ? Math.min(Ha >>> 1, 128) : 0;

  // Normalized Hann window — divide by 2 so COLA sum = 1.0 at 75% overlap
  const hann = new Float32Array(W);
  for (let i = 0; i < W; i++) {
    hann[i] = 0.25 * (1 - Math.cos((2 * Math.PI * i) / W));
  }

  // Estimate output length generously
  const estimatedFrames = Math.ceil(inputLen / Ha) + 1;
  const maxOutput = estimatedFrames * H + W;

  const outChannels: Float32Array[] = [];

  for (let ch = 0; ch < numCh; ch++) {
    const inp = buffer.getChannelData(ch);
    const out = new Float32Array(maxOutput);

    let rp = s0; // read position in input
    let wp = 0; // write position in output

    // Previous frame's un-windowed tail for WSOLA cross-correlation
    let prevTail: Float32Array | null = null;

    while (rp + W <= s1) {
      let bestRp = rp;

      // WSOLA: search for the best-aligned position near rp
      if (seekLen > 0 && prevTail !== null) {
        let bestScore = -Infinity;
        const overlapLen = W - H;

        for (let off = -seekLen; off <= seekLen; off++) {
          const candidate = rp + off;
          if (candidate < s0 || candidate + W > s1) continue;

          let dot = 0, nA = 0, nB = 0;
          for (let i = 0; i < overlapLen; i++) {
            const a = prevTail[i];
            const b = inp[candidate + i];
            dot += a * b;
            nA += a * a;
            nB += b * b;
          }
          const denom = Math.sqrt(nA * nB);
          const score = denom > 1e-12 ? dot / denom : 0;
          if (score > bestScore) {
            bestScore = score;
            bestRp = candidate;
          }
        }
      }

      // Overlap-add the windowed frame
      for (let i = 0; i < W; i++) {
        out[wp + i] += inp[bestRp + i] * hann[i];
      }

      // Save the un-windowed tail of this frame for next WSOLA match
      if (seekLen > 0) {
        const overlapLen = W - H;
        if (!prevTail) prevTail = new Float32Array(overlapLen);
        for (let i = H; i < W; i++) {
          prevTail[i - H] = inp[bestRp + i];
        }
      }

      rp += Ha;
      wp += H;
    }

    // Trim to actual output length (last write position + remaining window tail)
    outChannels.push(out.subarray(0, Math.min(wp + W, maxOutput)));
  }

  // All channels should be the same length; use the shortest
  const finalLen = Math.min(...outChannels.map((c) => c.length));
  if (finalLen <= 0) {
    return ctx.createBuffer(numCh, 1, sr);
  }

  const result = ctx.createBuffer(numCh, finalLen, sr);
  for (let ch = 0; ch < numCh; ch++) {
    result.getChannelData(ch).set(outChannels[ch].subarray(0, finalLen));
  }

  return result;
}
