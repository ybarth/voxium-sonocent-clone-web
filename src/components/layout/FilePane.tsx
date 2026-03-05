/**
 * FilePane — original document viewer with synchronized playback highlighting
 * and click-to-seek. Supports HTML rendering (MD/DOCX/EPUB/RTF) and PDF.
 */

import { useState, useCallback, useRef, useEffect, useMemo, Component, type ReactNode } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { usePlayback } from '../../hooks/usePlayback';
import { useDocumentSync } from '../../hooks/useDocumentSync';
import { buildRegionMap, resolveHtmlCoords, spanAtCharOffset, charOffsetFromPoint } from '../../utils/documentCoordMapper';
import { importMultipleDocuments } from '../../utils/importDocument';
import type { DocumentAsset, DocumentImportOptions, DocumentRegionMap } from '../../types/document';
import { FilePaneToolbar } from './FilePaneToolbar';
import { DocumentImportDialog } from './DocumentImportDialog';

// ─── Error Boundary ─────────────────────────────────────────────────────────

interface ErrorBoundaryState { error: Error | null }

class FilePaneErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('FilePane error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '20px', color: '#ff6b6b', fontSize: '12px' }}>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>Document view error</div>
          <div style={{ opacity: 0.7, marginBottom: '12px' }}>{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '4px 12px', fontSize: '11px', cursor: 'pointer',
              backgroundColor: '#1a1a2e', color: '#a0a0b0', border: '1px solid #2a2a3e',
              borderRadius: '4px',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function FilePane() {
  const classicMode = useProjectStore(s => s.project.settings.classicMode);
  const assets = useProjectStore(s => s.project.documentAssets);

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'original' | 'plain'>('original');
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

  // Auto-select first asset
  const selectedAsset = useMemo(() => {
    if (selectedAssetId) return assets.find(a => a.id === selectedAssetId) ?? null;
    return assets[0] ?? null;
  }, [assets, selectedAssetId]);

  // Build region map for sync
  const regionMap = useMemo((): DocumentRegionMap | null => {
    if (!selectedAsset) return null;
    return buildRegionMap(selectedAsset.wordSpans);
  }, [selectedAsset]);

  const { activeSpan, highlightedSpans } = useDocumentSync(regionMap);

  const handleImportClick = useCallback((files: File[]) => {
    setPendingFiles(files);
  }, []);

  const [importError, setImportError] = useState<string | null>(null);

  const handleImportConfirm = useCallback(async (options: DocumentImportOptions) => {
    if (!pendingFiles) return;
    setPendingFiles(null);
    setImportError(null);

    try {
      await importMultipleDocuments(pendingFiles, options);
    } catch (err: any) {
      console.error('Document import failed:', err);
      setImportError(err.message || 'Import failed');
    }
  }, [pendingFiles]);

  const handleImportCancel = useCallback(() => {
    setPendingFiles(null);
  }, []);

  const bg = classicMode ? '#ffffff' : '#0d0d18';
  const text = classicMode ? '#1a1a2a' : '#d0d0e0';

  return (
    <FilePaneErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: bg, color: text }}>
        <FilePaneToolbar
          selectedAssetId={selectedAsset?.id ?? null}
          onSelectAsset={setSelectedAssetId}
          onImportClick={handleImportClick}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode(v => v === 'original' ? 'plain' : 'original')}
        />

        {importError && (
          <div style={{ padding: '8px 12px', backgroundColor: '#3b1a1a', color: '#ff6b6b', fontSize: '11px' }}>
            Import error: {importError}
          </div>
        )}

        {selectedAsset ? (
          viewMode === 'plain' ? (
            <PlainTextViewer asset={selectedAsset} regionMap={regionMap} activeSpan={activeSpan} highlightedSpans={highlightedSpans} />
          ) : selectedAsset.format === 'pdf' ? (
            <PdfViewer asset={selectedAsset} regionMap={regionMap} activeSpan={activeSpan} highlightedSpans={highlightedSpans} />
          ) : (
            <HtmlDocViewer asset={selectedAsset} regionMap={regionMap} activeSpan={activeSpan} highlightedSpans={highlightedSpans} />
          )
        ) : (
          <FilePaneEmptyState onImportClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.pdf,.docx,.epub,.rtf,.md,.markdown,.txt';
            input.onchange = () => {
              const files = Array.from(input.files || []);
              if (files.length > 0) handleImportClick(files);
            };
            input.click();
          }} />
        )}

        {pendingFiles && (
          <DocumentImportDialog
            files={pendingFiles}
            onConfirm={handleImportConfirm}
            onCancel={handleImportCancel}
          />
        )}
      </div>
    </FilePaneErrorBoundary>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function FilePaneEmptyState({ onImportClick }: { onImportClick: () => void }) {
  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px', textAlign: 'center', color: '#505060',
      }}
    >
      <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.4 }}>
        {'📄'}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
        Import a Document
      </div>
      <div style={{ fontSize: '11px', opacity: 0.6, maxWidth: '220px', marginBottom: '12px' }}>
        Supports PDF, DOCX, EPUB, RTF, and Markdown. AI will analyze and divide into sections and chunks.
      </div>
      <button
        onClick={onImportClick}
        style={{
          padding: '6px 16px', fontSize: '11px',
          backgroundColor: '#3B82F6', color: '#fff',
          border: 'none', borderRadius: '4px', cursor: 'pointer',
        }}
      >
        Import Document
      </button>
    </div>
  );
}

// ─── HTML Document Viewer ───────────────────────────────────────────────────

interface ViewerProps {
  asset: DocumentAsset;
  regionMap: DocumentRegionMap | null;
  activeSpan: import('../../types/document').DocumentTextSpan | null;
  highlightedSpans: import('../../types/document').DocumentTextSpan[];
}

function HtmlDocViewer({ asset, regionMap, activeSpan, highlightedSpans }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { seekToChunk } = usePlayback();
  const classicMode = useProjectStore(s => s.project.settings.classicMode);

  // Resolve coordinates after render
  useEffect(() => {
    if (regionMap && containerRef.current) {
      resolveHtmlCoords(regionMap, containerRef.current);
    }
  }, [regionMap, asset.htmlContent]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!regionMap || !containerRef.current) return;

    const charOffset = charOffsetFromPoint(containerRef.current, e.clientX, e.clientY);
    if (charOffset === null) return;

    const span = spanAtCharOffset(regionMap.spans, charOffset);
    if (!span) return;

    // Find the chunk and word mapping to seek
    const store = useProjectStore.getState();
    const mapping = store.project.transcription.wordChunkMappings.find(
      m => m.wordId === span.wordId && m.chunkId === span.chunkId
    );
    if (mapping) {
      store.selectChunk(span.chunkId, 'replace');
      store.placeCursorInChunk(span.chunkId, mapping.startFraction);
      const chunk = store.project.chunks.find(c => c.id === span.chunkId);
      if (chunk) {
        seekToChunk(span.chunkId, (chunk.endTime - chunk.startTime) * mapping.startFraction);
      }
    }
  }, [regionMap, seekToChunk]);

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          padding: '16px 20px',
          fontSize: '13px',
          lineHeight: '1.6',
          cursor: 'pointer',
          color: classicMode ? '#1a1a2a' : '#d0d0e0',
        }}
        dangerouslySetInnerHTML={{ __html: asset.htmlContent || '' }}
      />
      {/* Highlight overlays */}
      <HighlightOverlays activeSpan={activeSpan} highlightedSpans={highlightedSpans} />
    </div>
  );
}

// ─── Plain Text Viewer ──────────────────────────────────────────────────────

function PlainTextViewer({ asset, regionMap, activeSpan, highlightedSpans }: ViewerProps) {
  const { seekToChunk } = usePlayback();
  const classicMode = useProjectStore(s => s.project.settings.classicMode);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!regionMap || !containerRef.current) return;

    const charOffset = charOffsetFromPoint(containerRef.current, e.clientX, e.clientY);
    if (charOffset === null) return;

    const span = spanAtCharOffset(regionMap.spans, charOffset);
    if (!span) return;

    const store = useProjectStore.getState();
    const mapping = store.project.transcription.wordChunkMappings.find(
      m => m.wordId === span.wordId && m.chunkId === span.chunkId
    );
    if (mapping) {
      store.selectChunk(span.chunkId, 'replace');
      store.placeCursorInChunk(span.chunkId, mapping.startFraction);
      const chunk = store.project.chunks.find(c => c.id === span.chunkId);
      if (chunk) {
        seekToChunk(span.chunkId, (chunk.endTime - chunk.startTime) * mapping.startFraction);
      }
    }
  }, [regionMap, seekToChunk]);

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          padding: '16px 20px',
          fontSize: '13px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          cursor: 'pointer',
          color: classicMode ? '#1a1a2a' : '#d0d0e0',
        }}
      >
        {asset.plainText}
      </div>
      <HighlightOverlays activeSpan={activeSpan} highlightedSpans={highlightedSpans} />
    </div>
  );
}

// ─── PDF Viewer (simplified) ────────────────────────────────────────────────

function PdfViewer({ asset, regionMap, activeSpan, highlightedSpans }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfRendered, setPdfRendered] = useState(false);
  const classicMode = useProjectStore(s => s.project.settings.classicMode);
  const { seekToChunk } = usePlayback();

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      if (!containerRef.current) return;

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        const data = await asset.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        if (cancelled) return;
        containerRef.current.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const pageDiv = document.createElement('div');
          pageDiv.style.position = 'relative';
          pageDiv.style.marginBottom = '8px';

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.display = 'block';
          pageDiv.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
          }

          // Add text layer for click-to-seek
          const textContent = await page.getTextContent();
          const textLayer = document.createElement('div');
          textLayer.style.position = 'absolute';
          textLayer.style.top = '0';
          textLayer.style.left = '0';
          textLayer.style.width = '100%';
          textLayer.style.height = '100%';
          textLayer.style.cursor = 'pointer';

          // Simplified text layer — invisible but clickable spans
          for (const item of textContent.items) {
            if (!('str' in item) || !(item as any).str) continue;
            const textItem = item as any;
            const tx = textItem.transform;
            const span = document.createElement('span');
            span.textContent = textItem.str;
            span.style.position = 'absolute';
            span.style.left = `${(tx[4] * scale / viewport.width) * 100}%`;
            span.style.bottom = `${(tx[5] * scale / viewport.height) * 100}%`;
            span.style.fontSize = `${Math.abs(tx[3]) * scale}px`;
            span.style.color = 'transparent';
            span.style.whiteSpace = 'pre';
            textLayer.appendChild(span);
          }

          pageDiv.appendChild(textLayer);
          containerRef.current?.appendChild(pageDiv);
        }

        setPdfRendered(true);
      } catch (err) {
        console.error('PDF render failed:', err);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div style="padding:20px;color:#808090;">Failed to render PDF. Showing plain text view.</div>`;
          // Fallback: show plain text
          const pre = document.createElement('pre');
          pre.textContent = asset.plainText;
          pre.style.padding = '16px';
          pre.style.whiteSpace = 'pre-wrap';
          pre.style.fontSize = '13px';
          containerRef.current.appendChild(pre);
        }
      }
    }

    renderPdf();
    return () => { cancelled = true; };
  }, [asset]);

  // Click handler for PDF text layer
  useEffect(() => {
    if (!pdfRendered || !containerRef.current || !regionMap) return;

    function handleClick(e: MouseEvent) {
      // Find character offset from click position in plain text
      const target = e.target as HTMLElement;
      if (target.tagName !== 'SPAN' || !target.textContent) return;

      // Search for the text in plainText
      const text = target.textContent;
      const idx = asset.plainText.indexOf(text);
      if (idx < 0) return;

      const span = spanAtCharOffset(regionMap!.spans, idx);
      if (!span) return;

      const store = useProjectStore.getState();
      const mapping = store.project.transcription.wordChunkMappings.find(
        m => m.wordId === span.wordId && m.chunkId === span.chunkId
      );
      if (mapping) {
        store.selectChunk(span.chunkId, 'replace');
        store.placeCursorInChunk(span.chunkId, mapping.startFraction);
        const chunk = store.project.chunks.find(c => c.id === span.chunkId);
        if (chunk) {
          seekToChunk(span.chunkId, (chunk.endTime - chunk.startTime) * mapping.startFraction);
        }
      }
    }

    containerRef.current.addEventListener('click', handleClick);
    return () => containerRef.current?.removeEventListener('click', handleClick);
  }, [pdfRendered, regionMap, asset.plainText, seekToChunk]);

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          padding: '8px',
          backgroundColor: classicMode ? '#f5f5f5' : '#111',
        }}
      />
      <HighlightOverlays activeSpan={activeSpan} highlightedSpans={highlightedSpans} />
    </div>
  );
}

// ─── Highlight Overlays ─────────────────────────────────────────────────────

function HighlightOverlays({
  activeSpan,
  highlightedSpans,
}: {
  activeSpan: import('../../types/document').DocumentTextSpan | null;
  highlightedSpans: import('../../types/document').DocumentTextSpan[];
}) {
  return (
    <>
      {/* Chunk-level highlights (softer) */}
      {highlightedSpans.map(span => {
        if (!span.renderCoords) return null;
        const isActive = activeSpan?.id === span.id;
        return (
          <div
            key={span.id}
            style={{
              position: 'absolute',
              left: span.renderCoords.x,
              top: span.renderCoords.y,
              width: span.renderCoords.width,
              height: span.renderCoords.height,
              backgroundColor: isActive
                ? 'rgba(59, 130, 246, 0.35)'
                : 'rgba(59, 130, 246, 0.12)',
              pointerEvents: 'none',
              borderRadius: '2px',
              transition: 'background-color 0.15s ease',
            }}
          />
        );
      })}
    </>
  );
}
