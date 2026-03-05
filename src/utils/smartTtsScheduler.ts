/**
 * SmartTtsScheduler — proximity-based TTS generation scheduler.
 * Generates chunks nearest to the playback position first (Skyrim-style loading).
 * Provides progress tracking with ETA estimation.
 */

import type { HeadTtsProvider } from './headTtsProvider';
import type { ChunkExpressivity } from '../types/document';
import { generateSyntheticForChunk } from './syntheticLayerGenerator';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SchedulerChunkJob {
  chunkId: string;
  text: string;
  targetDuration: number;
  expressivity?: ChunkExpressivity;
  priority: number;
  status: 'queued' | 'generating' | 'done' | 'error' | 'cancelled';
  abortController: AbortController;
}

export interface SchedulerProgress {
  totalChunks: number;
  completedChunks: number;
  generatingChunks: number;
  errorChunks: number;
  queuedChunks: number;
  currentGeneratingIds: string[];
  estimatedTimeRemaining: number | null;
  averageChunkTime: number | null;
}

export type ChunkCompleteCallback = (chunkId: string) => void;
export type ProgressCallback = (progress: SchedulerProgress) => void;

// ─── Scheduler ──────────────────────────────────────────────────────────────

export class SmartTtsScheduler {
  private queue: SchedulerChunkJob[] = [];
  private inFlight = new Map<string, SchedulerChunkJob>();
  private completedJobs = new Set<string>();
  private errorJobs = new Set<string>();
  private completedTimes: number[] = []; // rolling window for ETA
  private concurrency = 3;
  private playheadIndex = 0;
  private lookaheadWindow = 8;
  private orderedChunkIds: string[] = [];
  private progressListeners = new Set<ProgressCallback>();
  private chunkCompleteListeners = new Set<ChunkCompleteCallback>();
  private running = false;
  private playheadDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Configuration ──────────────────────────────────────────────────

  setOrderedChunks(chunkIds: string[]) {
    this.orderedChunkIds = chunkIds;
  }

  setConcurrency(n: number) {
    this.concurrency = Math.max(1, n);
  }

  setLookaheadWindow(n: number) {
    this.lookaheadWindow = Math.max(1, n);
  }

  // ─── Playhead tracking ──────────────────────────────────────────────

  updatePlayheadPosition(chunkId: string) {
    if (this.playheadDebounceTimer) {
      clearTimeout(this.playheadDebounceTimer);
    }
    this.playheadDebounceTimer = setTimeout(() => {
      this._applyPlayheadUpdate(chunkId);
    }, 100);
  }

  private _applyPlayheadUpdate(chunkId: string) {
    const idx = this.orderedChunkIds.indexOf(chunkId);
    if (idx === -1) return;

    this.playheadIndex = idx;

    // Re-prioritize queued jobs
    for (const job of this.queue) {
      job.priority = this._computePriority(job.chunkId);
    }
    this.queue.sort((a, b) => a.priority - b.priority);

    // Cancel in-flight jobs that are now far away
    const cancelThreshold = this.lookaheadWindow * 3;
    for (const [id, job] of this.inFlight) {
      const dist = this._distanceFromPlayhead(id);
      if (dist > cancelThreshold) {
        job.abortController.abort();
      }
    }

    this.notifyProgress();
  }

  private _distanceFromPlayhead(chunkId: string): number {
    const idx = this.orderedChunkIds.indexOf(chunkId);
    if (idx === -1) return Infinity;
    return Math.abs(idx - this.playheadIndex);
  }

  private _computePriority(chunkId: string): number {
    const idx = this.orderedChunkIds.indexOf(chunkId);
    if (idx === -1) return 9999;

    const distance = idx - this.playheadIndex;

    if (distance >= 0 && distance <= this.lookaheadWindow) {
      // Forward within lookahead — highest priority
      return distance;
    } else if (distance > this.lookaheadWindow) {
      // Forward beyond lookahead
      return this.lookaheadWindow + (distance - this.lookaheadWindow);
    } else {
      // Behind playhead — lower priority, penalized
      return this.lookaheadWindow + Math.abs(distance) * 2;
    }
  }

  // ─── Queue management ───────────────────────────────────────────────

  enqueueStaleChunks(jobs: Array<{
    chunkId: string;
    text: string;
    targetDuration: number;
    expressivity?: ChunkExpressivity;
  }>) {
    const existingIds = new Set([
      ...this.queue.map(j => j.chunkId),
      ...this.inFlight.keys(),
      ...this.completedJobs,
    ]);

    for (const job of jobs) {
      if (existingIds.has(job.chunkId)) continue;

      this.queue.push({
        ...job,
        priority: this._computePriority(job.chunkId),
        status: 'queued',
        abortController: new AbortController(),
      });
    }

    this.queue.sort((a, b) => a.priority - b.priority);
    this.notifyProgress();
  }

  // ─── Execution ──────────────────────────────────────────────────────

  async start(
    provider: HeadTtsProvider,
    audioContext: AudioContext,
    speed: number,
  ) {
    if (this.running) return;
    this.running = true;

    const workerCount = Math.min(this.concurrency, this.queue.length);
    const workers = Array.from({ length: workerCount }, () =>
      this._worker(provider, audioContext, speed),
    );

    await Promise.all(workers);
    this.running = false;
    this.notifyProgress();
  }

  private async _worker(
    provider: HeadTtsProvider,
    audioContext: AudioContext,
    speed: number,
  ) {
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      job.status = 'generating';
      this.inFlight.set(job.chunkId, job);
      this.notifyProgress();

      const startTime = performance.now();

      try {
        await generateSyntheticForChunk(
          job.chunkId,
          job.text,
          provider,
          audioContext,
          job.targetDuration,
          job.expressivity?.speed ?? speed,
          job.expressivity,
          job.abortController.signal,
        );

        // Check if aborted after generation returned
        if (job.abortController.signal.aborted) {
          job.status = 'cancelled';
          // Re-queue with fresh controller if still needed
          this.inFlight.delete(job.chunkId);
          continue;
        }

        job.status = 'done';
        this.completedJobs.add(job.chunkId);

        const elapsed = (performance.now() - startTime) / 1000;
        this.completedTimes.push(elapsed);
        if (this.completedTimes.length > 10) {
          this.completedTimes.shift();
        }

        // Fire chunk complete callback for incremental buffer updates
        for (const cb of this.chunkCompleteListeners) {
          cb(job.chunkId);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          job.status = 'cancelled';
        } else {
          job.status = 'error';
          this.errorJobs.add(job.chunkId);
          console.error(`[Scheduler] Chunk ${job.chunkId} failed:`, err);
        }
      } finally {
        this.inFlight.delete(job.chunkId);
        this.notifyProgress();
      }
    }
  }

  stop() {
    // Abort all in-flight
    for (const [, job] of this.inFlight) {
      job.abortController.abort();
    }
    this.queue = [];
    this.running = false;
    this.notifyProgress();
  }

  reset() {
    this.stop();
    this.completedJobs.clear();
    this.errorJobs.clear();
    this.completedTimes = [];
    this.playheadIndex = 0;
    this.notifyProgress();
  }

  // ─── Progress ───────────────────────────────────────────────────────

  getProgress(): SchedulerProgress {
    const generatingChunks = this.inFlight.size;
    const queuedChunks = this.queue.length;
    const completedChunks = this.completedJobs.size;
    const errorChunks = this.errorJobs.size;
    const totalChunks = completedChunks + generatingChunks + queuedChunks + errorChunks;

    let estimatedTimeRemaining: number | null = null;
    let averageChunkTime: number | null = null;

    if (this.completedTimes.length > 0) {
      averageChunkTime = this.completedTimes.reduce((a, b) => a + b, 0) / this.completedTimes.length;
      const remaining = queuedChunks + generatingChunks;
      estimatedTimeRemaining = (averageChunkTime * remaining) / Math.max(1, this.concurrency);
    }

    return {
      totalChunks,
      completedChunks,
      generatingChunks,
      errorChunks,
      queuedChunks,
      currentGeneratingIds: [...this.inFlight.keys()],
      estimatedTimeRemaining,
      averageChunkTime,
    };
  }

  getPlayheadIndex(): number {
    return this.playheadIndex;
  }

  getOrderedChunkIds(): string[] {
    return this.orderedChunkIds;
  }

  isRunning(): boolean {
    return this.running;
  }

  // ─── Listeners ──────────────────────────────────────────────────────

  onProgress(listener: ProgressCallback): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  onChunkComplete(listener: ChunkCompleteCallback): () => void {
    this.chunkCompleteListeners.add(listener);
    return () => this.chunkCompleteListeners.delete(listener);
  }

  private notifyProgress() {
    const progress = this.getProgress();
    for (const listener of this.progressListeners) {
      listener(progress);
    }
  }
}
