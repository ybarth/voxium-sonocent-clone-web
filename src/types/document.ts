// Document import, AI analysis, and original document view types

export type DocumentFormat = 'pdf' | 'docx' | 'epub' | 'rtf' | 'markdown';

// Parsed structural tree
export interface DocumentStructureNode {
  id: string;
  type: 'document' | 'chapter' | 'heading' | 'paragraph' | 'list-item' | 'blockquote' | 'code-block';
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  children: DocumentStructureNode[];
  sourceRange?: { start: number; end: number }; // char offsets in plainText
}

// Links a text range → word → chunk → rendered coordinates
export interface DocumentTextSpan {
  id: string;
  wordId: string;
  chunkId: string;
  charStart: number;   // offset in document plainText
  charEnd: number;
  renderCoords: DocumentRenderCoords | null; // populated after render
}

export interface DocumentRenderCoords {
  pageNumber?: number;  // PDF only
  x: number;
  y: number;
  width: number;
  height: number; // bounding box in container px
}

// Runtime index for fast lookups
export interface DocumentRegionMap {
  spans: DocumentTextSpan[];                    // sorted by charStart
  byWordId: Map<string, DocumentTextSpan>;
  byChunkId: Map<string, DocumentTextSpan[]>;
}

// Stored in project
export interface DocumentAsset {
  id: string;
  originalFileName: string;
  format: DocumentFormat;
  blob: Blob;
  plainText: string;
  structure: DocumentStructureNode;
  wordSpans: DocumentTextSpan[];
  htmlContent?: string;       // for DOCX/EPUB/RTF/MD (runtime, not persisted)
  sectionIds: string[];
  createdAt: number;
}

export interface DocumentImportOptions {
  divisionMode: 'heading-structure' | 'ai-topic' | 'paragraph-groups';
  chunkingMode: 'ai-prosody' | 'sentence' | 'paragraph';
  aiProvider?: string;
  useCouncil?: boolean;
  voiceId?: string;
}

export type DocumentImportJobStatus =
  | 'pending' | 'parsing' | 'ai-dividing' | 'ai-chunking'
  | 'ai-expressivity' | 'building-words' | 'generating-tts'
  | 'building-coords' | 'completed' | 'failed';

export interface DocumentImportJob {
  id: string;
  documentAssetId: string;
  status: DocumentImportJobStatus;
  progress: number;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

// Per-chunk Kokoro expressivity from AI
export interface ChunkExpressivity {
  chunkId: string;
  speed: number;               // 0.5-2.0
  voiceId: string;             // '' = use default
  leadingBreakMs: number;      // silence before chunk
  trailingBreakMs: number;     // silence after chunk
  phonetics: { word: string; ipa: string }[];  // IPA overrides for emphasis
}

// AI analysis result types
export interface DocumentDivisionSection {
  name: string;
  startCharOffset: number;
  endCharOffset: number;
  rationale: string;
}

export interface DocumentDivisionChunk {
  chunkIndex: number;
  text: string;
  startCharOffset: number;
  endCharOffset: number;
}

export interface DocumentExpressivityResult {
  chunkIndex: number;
  speed: number;
  voiceId: string;
  leadingBreakMs: number;
  trailingBreakMs: number;
  phonetics: { word: string; ipa: string }[];
}

export interface DocumentDivisionPlan {
  sections: Array<{
    name: string;
    startCharOffset: number;
    endCharOffset: number;
    rationale: string;
    chunks: DocumentDivisionChunk[];
    expressivity: DocumentExpressivityResult[];
  }>;
}
