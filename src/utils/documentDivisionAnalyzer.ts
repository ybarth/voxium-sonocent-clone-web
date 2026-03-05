/**
 * AI-powered document division analyzer.
 * Divides documents into sections and chunks with expressivity metadata.
 */

import type {
  DocumentStructureNode,
  DocumentDivisionPlan,
  DocumentDivisionSection,
  DocumentDivisionChunk,
  DocumentExpressivityResult,
  DocumentImportOptions,
} from '../types/document';
import { KOKORO_VOICES } from './headTtsProvider';

// Uses the existing AI infrastructure
import { aiRouter } from './aiRouter';

// ─── Section Division ───────────────────────────────────────────────────────

async function divideIntoSections(
  plainText: string,
  structure: DocumentStructureNode,
  options: DocumentImportOptions,
): Promise<DocumentDivisionSection[]> {
  if (options.divisionMode === 'heading-structure') {
    return divideByHeadingStructure(plainText, structure);
  }

  if (options.divisionMode === 'paragraph-groups') {
    return divideByParagraphGroups(plainText);
  }

  // AI topic analysis
  const headingNodes = flattenHeadings(structure);
  const headingSummary = headingNodes
    .map(h => `[H${h.headingLevel}] "${h.text}" (char ${h.sourceRange?.start ?? 0})`)
    .join('\n');

  const prompt = `You are a document analysis expert. Divide this document into 3-12 logical sections by topic.

Document text (first 3000 chars):
---
${plainText.substring(0, 3000)}
---

Document headings:
${headingSummary || '(no headings found)'}

Total document length: ${plainText.length} characters.

Return ONLY a JSON array of sections:
[{ "name": "Section Name", "startCharOffset": 0, "endCharOffset": 500, "rationale": "Why this section" }]

Rules:
- Sections must cover the entire document (no gaps)
- startCharOffset of section N+1 must equal endCharOffset of section N
- First section starts at 0, last section ends at ${plainText.length}
- 3-12 sections total
- Names should be descriptive topic labels`;

  try {
    const response = await aiRouter.complete({
      taskCategory: 'document-section-division',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 2000,
    });

    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in AI response');

    const sections: DocumentDivisionSection[] = JSON.parse(jsonMatch[0]);
    return validateAndFixSections(sections, plainText.length);
  } catch (err) {
    console.warn('AI section division failed, falling back to paragraph groups:', err);
    return divideByParagraphGroups(plainText);
  }
}

function divideByHeadingStructure(
  plainText: string,
  structure: DocumentStructureNode,
): DocumentDivisionSection[] {
  const headings = flattenHeadings(structure);

  if (headings.length === 0) {
    return divideByParagraphGroups(plainText);
  }

  const sections: DocumentDivisionSection[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].sourceRange?.start ?? 0;
    const end = i < headings.length - 1
      ? (headings[i + 1].sourceRange?.start ?? plainText.length)
      : plainText.length;

    sections.push({
      name: headings[i].text || `Section ${i + 1}`,
      startCharOffset: start,
      endCharOffset: end,
      rationale: `Heading-based: ${headings[i].text}`,
    });
  }

  return sections;
}

function divideByParagraphGroups(plainText: string): DocumentDivisionSection[] {
  const paragraphs = plainText.split(/\n\n+/);
  const groupSize = Math.max(1, Math.ceil(paragraphs.length / 6)); // ~6 sections

  const sections: DocumentDivisionSection[] = [];
  let charOffset = 0;

  for (let i = 0; i < paragraphs.length; i += groupSize) {
    const group = paragraphs.slice(i, i + groupSize);
    const text = group.join('\n\n');
    const start = plainText.indexOf(text, charOffset);
    const end = start >= 0 ? start + text.length : charOffset + text.length;
    if (start >= 0) charOffset = end;

    sections.push({
      name: `Section ${sections.length + 1}`,
      startCharOffset: start >= 0 ? start : charOffset,
      endCharOffset: end,
      rationale: 'Paragraph group',
    });
  }

  // Ensure last section extends to end
  if (sections.length > 0) {
    sections[sections.length - 1].endCharOffset = plainText.length;
  }

  return sections;
}

// ─── Chunk Division ─────────────────────────────────────────────────────────

async function divideIntoChunks(
  sectionText: string,
  sectionOffset: number,
  options: DocumentImportOptions,
): Promise<DocumentDivisionChunk[]> {
  if (options.chunkingMode === 'paragraph') {
    return divideChunksByParagraph(sectionText, sectionOffset);
  }

  if (options.chunkingMode === 'sentence') {
    return divideChunksBySentence(sectionText, sectionOffset);
  }

  // AI prosody-aware chunking
  const textForAI = sectionText.substring(0, 2000);

  const prompt = `You are a prosody expert. Divide this text into chunks suitable for text-to-speech synthesis.
Each chunk should be 1-3 sentences, respecting natural phrase and clause boundaries.

Text:
---
${textForAI}
---

Return ONLY a JSON array:
[{ "chunkIndex": 0, "text": "The actual text...", "startCharOffset": 0, "endCharOffset": 50 }]

Rules:
- Chunks must be contiguous (no gaps, no overlaps)
- Break at natural pauses: sentence boundaries, clause boundaries, list transitions
- Each chunk should read naturally as a single speech unit
- First chunk starts at 0, last ends at ${sectionText.length}`;

  try {
    const response = await aiRouter.complete({
      taskCategory: 'document-chunk-division',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 3000,
    });

    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in AI response');

    const chunks: DocumentDivisionChunk[] = JSON.parse(jsonMatch[0]);

    // Adjust offsets to be document-relative
    return chunks.map(c => ({
      ...c,
      startCharOffset: c.startCharOffset + sectionOffset,
      endCharOffset: c.endCharOffset + sectionOffset,
    }));
  } catch (err) {
    console.warn('AI chunk division failed, falling back to sentence chunking:', err);
    return divideChunksBySentence(sectionText, sectionOffset);
  }
}

function divideChunksBySentence(text: string, offset: number): DocumentDivisionChunk[] {
  // Split by sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: DocumentDivisionChunk[] = [];
  let charOffset = 0;

  // Group 1-2 sentences per chunk
  for (let i = 0; i < sentences.length; i += 2) {
    const group = sentences.slice(i, Math.min(i + 2, sentences.length)).join('');
    const start = text.indexOf(group, charOffset);
    const end = start >= 0 ? start + group.length : charOffset + group.length;
    if (start >= 0) charOffset = end;

    chunks.push({
      chunkIndex: chunks.length,
      text: group.trim(),
      startCharOffset: (start >= 0 ? start : charOffset) + offset,
      endCharOffset: end + offset,
    });
  }

  return chunks;
}

function divideChunksByParagraph(text: string, offset: number): DocumentDivisionChunk[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const chunks: DocumentDivisionChunk[] = [];
  let charOffset = 0;

  for (const para of paragraphs) {
    const start = text.indexOf(para, charOffset);
    const end = start >= 0 ? start + para.length : charOffset + para.length;
    if (start >= 0) charOffset = end;

    chunks.push({
      chunkIndex: chunks.length,
      text: para.trim(),
      startCharOffset: (start >= 0 ? start : charOffset) + offset,
      endCharOffset: end + offset,
    });
  }

  return chunks;
}

// ─── Expressivity Analysis ──────────────────────────────────────────────────

async function analyzeExpressivity(
  chunks: DocumentDivisionChunk[],
  options: DocumentImportOptions,
): Promise<DocumentExpressivityResult[]> {
  const chunkTexts = chunks.map((c, i) => `[${i}] ${c.text.substring(0, 100)}`).join('\n');
  const voicesList = KOKORO_VOICES.join(', ');

  const prompt = `You are a speech director. For each text chunk, assign TTS expressivity parameters for natural, engaging speech synthesis.

Available Kokoro voices: ${voicesList}

Chunks:
${chunkTexts}

Return ONLY a JSON array (one entry per chunk):
[{
  "chunkIndex": 0,
  "speed": 1.0,
  "voiceId": "",
  "leadingBreakMs": 0,
  "trailingBreakMs": 200,
  "phonetics": []
}]

Guidelines:
- speed: 0.8-1.2 for normal text, 0.6-0.8 for important/dramatic, 1.2-1.5 for lists/minor text
- voiceId: "" uses default voice. Only change for dialogue/character differentiation
- leadingBreakMs: 0-500, use 200-500 for section starts or dramatic pauses
- trailingBreakMs: 100-500, use 300-500 for paragraph ends
- phonetics: [{word, ipa}] for words needing specific pronunciation emphasis (rare)`;

  try {
    const response = await aiRouter.complete({
      taskCategory: 'document-expressivity',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 3000,
    });

    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in AI response');

    return JSON.parse(jsonMatch[0]) as DocumentExpressivityResult[];
  } catch (err) {
    console.warn('AI expressivity analysis failed, using defaults:', err);
    return chunks.map((_, i) => ({
      chunkIndex: i,
      speed: 1.0,
      voiceId: options.voiceId || '',
      leadingBreakMs: i === 0 ? 300 : 0,
      trailingBreakMs: 200,
      phonetics: [],
    }));
  }
}

// ─── Main Analysis Pipeline ─────────────────────────────────────────────────

export async function analyzeDocument(
  plainText: string,
  structure: DocumentStructureNode,
  options: DocumentImportOptions,
  onProgress?: (status: string, progress: number) => void,
): Promise<DocumentDivisionPlan> {
  onProgress?.('Dividing into sections...', 0.1);
  const sections = await divideIntoSections(plainText, structure, options);

  const plan: DocumentDivisionPlan = { sections: [] };

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionText = plainText.substring(section.startCharOffset, section.endCharOffset);

    onProgress?.(`Chunking section ${i + 1}/${sections.length}...`, 0.2 + (0.4 * i / sections.length));
    const chunks = await divideIntoChunks(sectionText, section.startCharOffset, options);

    onProgress?.(`Analyzing expressivity ${i + 1}/${sections.length}...`, 0.6 + (0.3 * i / sections.length));
    const expressivity = await analyzeExpressivity(chunks, options);

    plan.sections.push({
      ...section,
      chunks,
      expressivity,
    });
  }

  onProgress?.('Analysis complete', 1.0);
  return plan;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function flattenHeadings(node: DocumentStructureNode): DocumentStructureNode[] {
  const result: DocumentStructureNode[] = [];
  if (node.type === 'heading') result.push(node);
  for (const child of node.children) {
    result.push(...flattenHeadings(child));
  }
  return result;
}

function validateAndFixSections(
  sections: DocumentDivisionSection[],
  totalLength: number,
): DocumentDivisionSection[] {
  if (sections.length === 0) {
    return [{ name: 'Document', startCharOffset: 0, endCharOffset: totalLength, rationale: 'Single section fallback' }];
  }

  // Sort by start offset
  sections.sort((a, b) => a.startCharOffset - b.startCharOffset);

  // Fix gaps and overlaps
  sections[0].startCharOffset = 0;
  for (let i = 1; i < sections.length; i++) {
    sections[i].startCharOffset = sections[i - 1].endCharOffset;
  }
  sections[sections.length - 1].endCharOffset = totalLength;

  return sections;
}
