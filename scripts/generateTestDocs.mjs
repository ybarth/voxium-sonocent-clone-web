/**
 * Generate test document assets for all supported formats.
 * Run: node scripts/generateTestDocs.mjs
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'document test assets');

const SAMPLE_TEXT = {
  title: 'The Science of Sound',
  sections: [
    {
      heading: 'What is Sound?',
      paragraphs: [
        'Sound is a type of energy made by vibrations. When an object vibrates, it causes movement in surrounding air molecules. These molecules bump into the molecules close to them, causing them to vibrate as well. This chain reaction creates a sound wave that travels through the medium.',
        'Sound waves need a medium to travel through, such as air, water, or solid materials. They cannot travel through a vacuum, which is why there is no sound in outer space.',
      ],
    },
    {
      heading: 'Properties of Sound',
      paragraphs: [
        'Sound has several measurable properties. Frequency determines the pitch of a sound and is measured in Hertz. Amplitude determines the loudness and is measured in decibels. The speed of sound depends on the medium through which it travels.',
        'In air at room temperature, sound travels at approximately 343 meters per second. In water, sound travels about four times faster, at roughly 1,480 meters per second. In steel, sound can travel at speeds up to 5,960 meters per second.',
      ],
    },
    {
      heading: 'Human Hearing',
      paragraphs: [
        'The human ear can detect sounds in the frequency range of approximately 20 Hz to 20,000 Hz. This range tends to decrease with age, particularly the ability to hear higher frequencies. Sounds below 20 Hz are called infrasound, while those above 20,000 Hz are called ultrasound.',
        'The ear converts sound waves into electrical signals that the brain interprets as sound. This process involves three main parts: the outer ear, the middle ear, and the inner ear. Each part plays a crucial role in our ability to perceive sound.',
      ],
    },
    {
      heading: 'Applications of Sound',
      paragraphs: [
        'Sound technology has numerous practical applications. Sonar uses sound waves to navigate and detect objects underwater. Ultrasound imaging allows doctors to see inside the human body without surgery. Acoustic engineering helps design concert halls and recording studios for optimal sound quality.',
        'Music, one of the most universal human experiences, is fundamentally an organized arrangement of sound. From ancient drums to modern synthesizers, humans have always found ways to create and shape sound for artistic expression.',
      ],
    },
  ],
};

// ─── Generate PDF ───────────────────────────────────────────────────────────

async function generatePdf() {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();

  let y = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth() - 2 * margin;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(SAMPLE_TEXT.title, margin, y);
  y += 12;

  for (const section of SAMPLE_TEXT.sections) {
    // Check page break
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Section heading
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    y += 8;
    doc.text(section.heading, margin, y);
    y += 8;

    // Paragraphs
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    for (const para of section.paragraphs) {
      const lines = doc.splitTextToSize(para, pageWidth);
      if (y + lines.length * 5 > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, margin, y);
      y += lines.length * 5 + 4;
    }
  }

  const buffer = doc.output('arraybuffer');
  writeFileSync(join(outDir, 'sample.pdf'), Buffer.from(buffer));
  console.log('Created sample.pdf');
}

// ─── Generate DOCX ──────────────────────────────────────────────────────────

async function generateDocx() {
  const docxLib = await import('docx');
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docxLib;

  const children = [
    new Paragraph({
      text: SAMPLE_TEXT.title,
      heading: HeadingLevel.TITLE,
    }),
  ];

  for (const section of SAMPLE_TEXT.sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }),
    );

    for (const para of section.paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun(para)],
          spacing: { after: 120 },
        }),
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(join(outDir, 'sample.docx'), buffer);
  console.log('Created sample.docx');
}

// ─── Generate EPUB ──────────────────────────────────────────────────────────

async function generateEpub() {
  // Build a minimal valid EPUB manually (it's just a ZIP with specific structure)
  const { zipSync, strToU8 } = await import('fflate');

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${SAMPLE_TEXT.title}</dc:title>
    <dc:identifier id="uid">test-epub-001</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

  function makeChapter(title, paragraphs) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title></head>
<body>
  <h1>${title}</h1>
  ${paragraphs.map(p => `<p>${p}</p>`).join('\n  ')}
</body>
</html>`;
  }

  const ch1 = makeChapter(
    SAMPLE_TEXT.sections[0].heading,
    [...SAMPLE_TEXT.sections[0].paragraphs, ...SAMPLE_TEXT.sections[1].paragraphs],
  );
  const ch2 = makeChapter(
    SAMPLE_TEXT.sections[2].heading,
    [...SAMPLE_TEXT.sections[2].paragraphs, ...SAMPLE_TEXT.sections[3].paragraphs],
  );

  const mimetype = 'application/epub+zip';

  const files = {
    'mimetype': strToU8(mimetype),
    'META-INF/container.xml': strToU8(containerXml),
    'OEBPS/content.opf': strToU8(contentOpf),
    'OEBPS/chapter1.xhtml': strToU8(ch1),
    'OEBPS/chapter2.xhtml': strToU8(ch2),
  };

  const zipped = zipSync(files);
  writeFileSync(join(outDir, 'sample.epub'), Buffer.from(zipped));
  console.log('Created sample.epub');
}

// ─── Run all generators ─────────────────────────────────────────────────────

async function main() {
  console.log('Generating test documents...');
  await generatePdf();
  await generateDocx();
  await generateEpub();
  // sample.md and sample.rtf already exist
  console.log('Done! All test documents generated in "document test assets/"');
}

main().catch(console.error);
