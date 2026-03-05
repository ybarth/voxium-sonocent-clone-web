/**
 * Document parser — format-specific parsers for MD, DOCX, EPUB, RTF, PDF.
 * Each parser returns { plainText, structure, htmlContent?, pageCount? }.
 */

import type { DocumentFormat, DocumentStructureNode } from '../types/document';

let uuid_counter = 0;
function genId(): string {
  return `dnode-${Date.now()}-${++uuid_counter}`;
}

export interface ParseResult {
  plainText: string;
  structure: DocumentStructureNode;
  htmlContent?: string;
  pageCount?: number;
}

// ─── Format Detection ───────────────────────────────────────────────────────

export function detectFormat(file: File): DocumentFormat | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, DocumentFormat> = {
    'pdf': 'pdf',
    'docx': 'docx',
    'epub': 'epub',
    'rtf': 'rtf',
    'md': 'markdown',
    'markdown': 'markdown',
    'txt': 'markdown', // treat plain text as markdown
  };
  if (ext && mimeMap[ext]) return mimeMap[ext];

  // MIME-type fallback
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (file.type === 'application/epub+zip') return 'epub';
  if (file.type === 'application/rtf' || file.type === 'text/rtf') return 'rtf';
  if (file.type === 'text/markdown') return 'markdown';

  return null;
}

// ─── Main Parser Entry ──────────────────────────────────────────────────────

export async function parseDocument(file: File, format?: DocumentFormat): Promise<ParseResult> {
  const fmt = format ?? detectFormat(file);
  if (!fmt) throw new Error(`Unsupported document format: ${file.name}`);

  switch (fmt) {
    case 'markdown': return parseMarkdown(await file.text());
    case 'docx': return parseDocx(file);
    case 'epub': return parseEpub(file);
    case 'rtf': return parseRtf(await file.text());
    case 'pdf': return parsePdf(file);
    default: throw new Error(`Unsupported format: ${fmt}`);
  }
}

// ─── Markdown Parser ────────────────────────────────────────────────────────

async function parseMarkdown(text: string): Promise<ParseResult> {
  const { marked } = await import('marked');

  // Parse to tokens for structure
  const tokens = marked.lexer(text);
  const plainText = extractPlainTextFromTokens(tokens);
  const structure = buildStructureFromMarkdownTokens(tokens, plainText);

  // Render to HTML with data-char attributes
  const htmlContent = buildHtmlFromMarkdownTokens(tokens, plainText);

  return { plainText, structure, htmlContent };
}

function extractPlainTextFromTokens(tokens: any[]): string {
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.type === 'heading' || token.type === 'paragraph') {
      parts.push(token.text || '');
    } else if (token.type === 'list') {
      for (const item of token.items || []) {
        parts.push(item.text || '');
      }
    } else if (token.type === 'blockquote') {
      parts.push(token.text || '');
    } else if (token.type === 'code') {
      parts.push(token.text || '');
    }
  }
  return parts.join('\n\n');
}

function buildStructureFromMarkdownTokens(tokens: any[], plainText: string): DocumentStructureNode {
  const root: DocumentStructureNode = {
    id: genId(), type: 'document', text: '', children: [],
  };

  let charOffset = 0;
  for (const token of tokens) {
    const text = token.text || '';
    const start = plainText.indexOf(text, charOffset);
    const end = start >= 0 ? start + text.length : charOffset;
    if (start >= 0) charOffset = end;

    if (token.type === 'heading') {
      root.children.push({
        id: genId(), type: 'heading', headingLevel: token.depth as any,
        text, children: [], sourceRange: { start, end },
      });
    } else if (token.type === 'paragraph') {
      root.children.push({
        id: genId(), type: 'paragraph', text, children: [],
        sourceRange: { start, end },
      });
    } else if (token.type === 'list') {
      for (const item of token.items || []) {
        const itemText = item.text || '';
        const iStart = plainText.indexOf(itemText, charOffset > 0 ? charOffset - text.length : 0);
        const iEnd = iStart >= 0 ? iStart + itemText.length : charOffset;
        root.children.push({
          id: genId(), type: 'list-item', text: itemText, children: [],
          sourceRange: { start: iStart >= 0 ? iStart : start, end: iEnd },
        });
      }
    } else if (token.type === 'blockquote') {
      root.children.push({
        id: genId(), type: 'blockquote', text, children: [],
        sourceRange: { start, end },
      });
    } else if (token.type === 'code') {
      root.children.push({
        id: genId(), type: 'code-block', text, children: [],
        sourceRange: { start, end },
      });
    }
  }

  return root;
}

function buildHtmlFromMarkdownTokens(tokens: any[], plainText: string): string {
  const parts: string[] = [];
  let charOffset = 0;

  for (const token of tokens) {
    const text = token.text || '';
    const start = plainText.indexOf(text, charOffset);
    const end = start >= 0 ? start + text.length : charOffset;
    if (start >= 0) charOffset = end;

    const attrs = `data-char-start="${start}" data-char-end="${end}"`;

    if (token.type === 'heading') {
      const tag = `h${token.depth}`;
      parts.push(`<${tag} ${attrs}>${escapeHtml(text)}</${tag}>`);
    } else if (token.type === 'paragraph') {
      parts.push(`<p ${attrs}>${escapeHtml(text)}</p>`);
    } else if (token.type === 'list') {
      const listTag = token.ordered ? 'ol' : 'ul';
      parts.push(`<${listTag}>`);
      for (const item of token.items || []) {
        const itemText = item.text || '';
        parts.push(`<li ${attrs}>${escapeHtml(itemText)}</li>`);
      }
      parts.push(`</${listTag}>`);
    } else if (token.type === 'blockquote') {
      parts.push(`<blockquote ${attrs}>${escapeHtml(text)}</blockquote>`);
    } else if (token.type === 'code') {
      parts.push(`<pre ${attrs}><code>${escapeHtml(text)}</code></pre>`);
    }
  }

  return parts.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── DOCX Parser ────────────────────────────────────────────────────────────

async function parseDocx(file: File): Promise<ParseResult> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();

  // Extract raw text
  const textResult = await mammoth.extractRawText({ arrayBuffer });
  const plainText = textResult.value;

  // Convert to HTML
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  let htmlContent = htmlResult.value;

  // Build structure from HTML
  const structure = buildStructureFromHtml(htmlContent, plainText);

  // Inject data-char attributes into HTML
  htmlContent = injectCharAttributes(htmlContent, plainText);

  return { plainText, structure, htmlContent };
}

// ─── EPUB Parser ────────────────────────────────────────────────────────────

async function parseEpub(file: File): Promise<ParseResult> {
  const fflate = await import('fflate');
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Unzip the EPUB
  const unzipped = fflate.unzipSync(data);

  // Find container.xml to get rootfile
  const containerXml = findFileInZip(unzipped, 'META-INF/container.xml');
  if (!containerXml) throw new Error('Invalid EPUB: missing container.xml');

  const containerStr = new TextDecoder().decode(containerXml);
  const rootfilePath = extractRootfilePath(containerStr);
  if (!rootfilePath) throw new Error('Invalid EPUB: cannot find rootfile');

  // Parse content.opf for spine order
  const opfData = findFileInZip(unzipped, rootfilePath);
  if (!opfData) throw new Error('Invalid EPUB: cannot find OPF file');

  const opfStr = new TextDecoder().decode(opfData);
  const spineHrefs = extractSpineHrefs(opfStr);

  // Get base directory of OPF file
  const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : '';

  // Concatenate XHTML bodies in spine order
  const bodies: string[] = [];
  const plainParts: string[] = [];

  for (const href of spineHrefs) {
    const fullPath = opfDir + href;
    const xhtmlData = findFileInZip(unzipped, fullPath);
    if (!xhtmlData) continue;

    const xhtmlStr = new TextDecoder().decode(xhtmlData);
    const bodyContent = extractHtmlBody(xhtmlStr);
    if (bodyContent) {
      bodies.push(bodyContent);
      plainParts.push(stripHtmlTags(bodyContent));
    }
  }

  const plainText = plainParts.join('\n\n');
  const htmlContent = bodies.join('\n<hr/>\n');
  const structure = buildStructureFromHtml(htmlContent, plainText);

  return { plainText, structure, htmlContent: injectCharAttributes(htmlContent, plainText) };
}

function findFileInZip(unzipped: Record<string, Uint8Array>, path: string): Uint8Array | undefined {
  // Try exact path first, then case-insensitive
  if (unzipped[path]) return unzipped[path];
  const lowerPath = path.toLowerCase();
  for (const key of Object.keys(unzipped)) {
    if (key.toLowerCase() === lowerPath) return unzipped[key];
  }
  return undefined;
}

function extractRootfilePath(containerXml: string): string | null {
  const match = containerXml.match(/full-path="([^"]+)"/);
  return match ? match[1] : null;
}

function extractSpineHrefs(opfXml: string): string[] {
  // Parse manifest items
  const manifest = new Map<string, string>();
  const itemRegex = /<item\s[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*/g;
  let m;
  while ((m = itemRegex.exec(opfXml)) !== null) {
    manifest.set(m[1], m[2]);
  }

  // Parse spine itemrefs
  const hrefs: string[] = [];
  const itemrefRegex = /<itemref\s[^>]*idref="([^"]+)"/g;
  while ((m = itemrefRegex.exec(opfXml)) !== null) {
    const href = manifest.get(m[1]);
    if (href) hrefs.push(href);
  }

  return hrefs;
}

function extractHtmlBody(html: string): string | null {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : null;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ─── RTF Parser ─────────────────────────────────────────────────────────────

async function parseRtf(text: string): Promise<ParseResult> {
  // Simple RTF parser — extract plain text by stripping RTF commands
  const plainText = stripRtf(text);
  const structure = buildStructureFromPlainText(plainText);
  const htmlContent = plainTextToHtml(plainText);

  return { plainText, structure, htmlContent };
}

function stripRtf(rtf: string): string {
  // Remove RTF header and groups
  let result = rtf;

  // Remove RTF control words
  result = result.replace(/\{\\[^{}]*\}/g, '');
  result = result.replace(/\\[a-z]+[\d]*\s?/gi, '');
  result = result.replace(/[{}]/g, '');
  result = result.replace(/\\\\/g, '\\');
  result = result.replace(/\\'[0-9a-f]{2}/gi, '');

  // Clean up whitespace
  result = result.replace(/\r\n/g, '\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
}

function plainTextToHtml(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  let charOffset = 0;
  const parts: string[] = [];

  for (const para of paragraphs) {
    const start = text.indexOf(para, charOffset);
    const end = start + para.length;
    charOffset = end;
    parts.push(`<p data-char-start="${start}" data-char-end="${end}">${escapeHtml(para)}</p>`);
  }

  return parts.join('\n');
}

// ─── PDF Parser ─────────────────────────────────────────────────────────────

async function parsePdf(file: File): Promise<ParseResult> {
  const pdfjsLib = await import('pdfjs-dist');

  // Configure worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;

  const plainParts: string[] = [];
  const allNodes: DocumentStructureNode[] = [];
  let totalCharOffset = 0;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by approximate y-position for paragraph detection
    const lines: { y: number; text: string }[] = [];
    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const textItem = item as any;
      const y = Math.round(textItem.transform[5]);
      const existing = lines.find(l => Math.abs(l.y - y) < 3);
      if (existing) {
        existing.text += textItem.str;
      } else {
        lines.push({ y, text: textItem.str });
      }
    }

    // Sort by y position (top to bottom = descending y in PDF coords)
    lines.sort((a, b) => b.y - a.y);

    // Group lines into paragraphs (gap > 15 units = new paragraph)
    const paragraphs: string[] = [];
    let currentPara: string[] = [];
    let lastY = Infinity;

    for (const line of lines) {
      if (lastY - line.y > 15 && currentPara.length > 0) {
        paragraphs.push(currentPara.join(' '));
        currentPara = [];
      }
      if (line.text.trim()) {
        currentPara.push(line.text.trim());
      }
      lastY = line.y;
    }
    if (currentPara.length > 0) {
      paragraphs.push(currentPara.join(' '));
    }

    for (const para of paragraphs) {
      const start = totalCharOffset;
      totalCharOffset += para.length;
      const end = totalCharOffset;
      totalCharOffset += 2; // for \n\n separator

      allNodes.push({
        id: genId(),
        type: 'paragraph',
        text: para,
        children: [],
        sourceRange: { start, end },
      });
    }

    plainParts.push(paragraphs.join('\n\n'));
  }

  const plainText = plainParts.join('\n\n');
  const structure: DocumentStructureNode = {
    id: genId(), type: 'document', text: '', children: allNodes,
  };

  return { plainText, structure, pageCount };
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function buildStructureFromHtml(html: string, plainText: string): DocumentStructureNode {
  const root: DocumentStructureNode = {
    id: genId(), type: 'document', text: '', children: [],
  };

  // Use regex to parse block-level elements (avoiding full DOMParser for non-browser contexts)
  const blockRegex = /<(h[1-6]|p|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  let charOffset = 0;

  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const content = stripHtmlTags(match[2]);

    const start = plainText.indexOf(content, charOffset);
    const end = start >= 0 ? start + content.length : charOffset;
    if (start >= 0) charOffset = end;

    let type: DocumentStructureNode['type'] = 'paragraph';
    let headingLevel: DocumentStructureNode['headingLevel'] | undefined;

    if (tag.startsWith('h') && tag.length === 2) {
      type = 'heading';
      headingLevel = parseInt(tag[1]) as any;
    } else if (tag === 'li') {
      type = 'list-item';
    } else if (tag === 'blockquote') {
      type = 'blockquote';
    } else if (tag === 'pre') {
      type = 'code-block';
    }

    root.children.push({
      id: genId(), type, headingLevel, text: content, children: [],
      sourceRange: { start: start >= 0 ? start : 0, end },
    });
  }

  return root;
}

function buildStructureFromPlainText(text: string): DocumentStructureNode {
  const root: DocumentStructureNode = {
    id: genId(), type: 'document', text: '', children: [],
  };

  const paragraphs = text.split(/\n\n+/);
  let charOffset = 0;

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    const start = text.indexOf(para, charOffset);
    const end = start + para.length;
    charOffset = end;

    root.children.push({
      id: genId(), type: 'paragraph', text: para, children: [],
      sourceRange: { start, end },
    });
  }

  return root;
}

function injectCharAttributes(html: string, plainText: string): string {
  // Inject data-char-start/data-char-end into block-level HTML elements
  let charOffset = 0;
  const blockRegex = /(<(?:h[1-6]|p|li|blockquote|pre|div)\b)([^>]*>)([\s\S]*?)(<\/(?:h[1-6]|p|li|blockquote|pre|div)>)/gi;

  return html.replace(blockRegex, (match, openTag, attrs, content, closeTag) => {
    const textContent = stripHtmlTags(content);
    const start = plainText.indexOf(textContent, charOffset);
    const end = start >= 0 ? start + textContent.length : charOffset;
    if (start >= 0) charOffset = end;

    // Don't double-inject if already present
    if (attrs.includes('data-char-start')) return match;

    return `${openTag} data-char-start="${start}" data-char-end="${end}"${attrs}${content}${closeTag}`;
  });
}
