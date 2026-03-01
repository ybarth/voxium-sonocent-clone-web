# AudioCanvas — v1 Implementation Spec

> A web-based audio notetaking application inspired by Sonocent Audio Notetaker. Audio is visualized as phrase-level colored/textured bars ("chunks") in a flowing grid layout. The app provides deep integration between Audio, Text, Annotations, and File panes with AI-powered bidirectional sync between audio and text representations.

---

## Table of Contents

1. [Audio Input](#1-audio-input)
2. [Phrase Segmentation & Visualization](#2-phrase-segmentation--visualization)
3. [Audio Cursor, Playback & Navigation](#3-audio-cursor-playback--navigation)
4. [Color, Texture & Styling System](#4-color-texture--styling-system)
5. [Chunk Editing](#5-chunk-editing)
6. [Sections](#6-sections)
7. [Text Pane (Linked Content Pane)](#7-text-pane-linked-content-pane)
8. [Annotations Pane](#8-annotations-pane)
9. [File Pane](#9-file-pane)
10. [Export](#10-export)
11. [Project Management & Multi-Tab](#11-project-management--multi-tab)
12. [Layout & UI Framework](#12-layout--ui-framework)
13. [Keyboard Navigation & Accessibility](#13-keyboard-navigation--accessibility)
14. [Core Data Model](#14-core-data-model)
15. [Technical Architecture Notes](#15-technical-architecture-notes)

---

## 1. Audio Input

### 1A. Live Microphone Recording
- Record audio from the browser microphone via `MediaRecorder` API.
- UI: Red record button in toolbar. Toggles to a pause icon while recording.
- Pause and resume recording without creating a new project.
- On stop, the recorded audio is immediately segmented into chunks (see §2).
- Show a live input level meter during recording.

### 1B. Audio File Import
- Drag-and-drop zone or file picker button.
- Supported formats: mp3, wav, m4a, ogg, webm, flac.
- On import, the file is decoded into an `AudioBuffer` and segmented into chunks.
- The original file is stored untouched; all edits are non-destructive references into the original buffer.
- Support importing multiple files sequentially — each appended as a new section or set of sections.

---

## 2. Phrase Segmentation & Visualization

### 2A. Automatic Silence-Based Segmentation
- On import or recording completion, audio is analyzed for silence gaps and split into chunks.
- Each chunk represents approximately one phrase of speech (~3–15 seconds typically).
- **Configurable parameters** (exposed in a settings panel):
  - **Silence threshold**: dB level below which audio is considered silence (default: -40 dB, adjustable range: -60 dB to -20 dB).
  - **Minimum silence duration**: how long silence must persist to trigger a split (default: 300ms, adjustable range: 100ms–2000ms).
  - **Minimum chunk duration**: prevent micro-chunks shorter than this (default: 500ms).
- Segmentation runs client-side using Web Audio API `OfflineAudioContext` for analysis.
- Each chunk stores a reference to its start and end time within the source audio buffer.

### 2B. Chunk Visualization as Colored Bars
- Chunks are rendered as rectangular bars in a **flow layout** (left-to-right, wrapping top-to-bottom, like words in a paragraph).
- Bar width is proportional to the chunk's duration (configurable scale factor).
- Bar height is uniform within a section (configurable globally).
- Default color is a neutral light grey.

### 2C. Two Visual Modes (User-Toggleable)

**Mode 1: Waveform View**
- Each bar displays a mini waveform of its audio content rendered inside the rectangle.
- Waveform color matches the chunk's assigned color.
- Background of the bar is a slightly lighter/darker shade of the chunk color.
- The waveform is pre-rendered as a canvas or SVG path for performance.

**Mode 2: Flat Color View**
- Each bar is a solid rectangle filled with its assigned color/texture/gradient.
- No waveform detail — clean, minimal, scannable.
- This is the "annotation-first" view where the color/texture pattern is the primary visual information.

**Mode switching**: A toggle button in the toolbar or a keyboard shortcut (e.g., `Ctrl+Shift+W`) switches between modes. The switch should animate smoothly (crossfade or morph).

### 2D. Chunk Numbering
- Every chunk displays a small number badge.
- **Two numbering schemes** (user-selectable, or both shown):
  - **Document-relative**: Chunks numbered 1, 2, 3, ... across the entire project.
  - **Section-relative**: Chunks numbered 1, 2, 3, ... within each section, resetting at section boundaries.
- Number badge position: top-left corner of the chunk bar, small and unobtrusive but readable.
- Font size and visibility of chunk numbers is toggleable.

---

## 3. Audio Cursor, Playback & Navigation

### 3A. Click-to-Play
- Click any chunk bar to position the audio cursor at the start of that chunk.
- Click within a chunk (in waveform mode) to position the cursor at that specific point within the chunk.
- Press `Space` to play/pause from the cursor position.

### 3B. Visual Cursor Tracking
- The cursor is rendered as a vertical line that sweeps through the current chunk during playback.
- **Adaptive cursor color**: The cursor color is computed dynamically to always have high contrast against the current chunk's color/texture and the section background. Use WCAG contrast ratio calculation — if the chunk is dark, the cursor is bright (e.g., white or yellow); if the chunk is light, the cursor is dark (e.g., black or deep blue). For textured/gradient chunks, sample the pixel color at the cursor's position and pick the contrasting color.
- The currently-playing chunk has an additional highlight treatment (e.g., a subtle glow, border, or slight scale-up).
- The view auto-scrolls to keep the cursor visible.

### 3C. Transport Controls
- Toolbar buttons: **Record**, **Play/Pause**, **Stop**, **Rewind** (skip to previous chunk), **Forward** (skip to next chunk).
- Keyboard shortcuts:
  - `Space` — Play / Pause
  - `Ctrl+Space` — Play / Pause (works from any pane)
  - `Home` — Jump to start of project
  - `End` — Jump to end of project

### 3D. Playback Speed Control
- Slider or dropdown: 0.25×, 0.5×, 0.75×, 1.0×, 1.25×, 1.5×, 1.75×, 2.0×, 3.0×.
- Speed is adjustable during playback in real-time.
- Speed setting is saved per project.
- Implemented via `AudioBufferSourceNode.playbackRate` or `playbackRate` on an `<audio>` element.
- **Critical**: Speed changes must not break word-level timecode alignment (see §9 for TTS alignment). The system must recalculate display positions based on actual playback rate.

### 3E. Pitch Shift / Voice Shift
- Independent of speed: make the voice deeper or higher without changing tempo.
- Implemented via Web Audio API pitch-shifting (e.g., using a `BiquadFilterNode` chain or a third-party pitch-shift library like `soundtouch-js`).

### 3F. Volume Control
- Per-project volume slider.
- Volume setting persisted with the project.

### 3G. Pause Mode (Transcription Mode)
- Toggleable mode via toolbar button or shortcut.
- When active: playback automatically pauses at the end of each chunk (if chunk > 2.5 seconds).
- If the user manually pauses within a chunk, on resume the playback rewinds 2 seconds from the pause point.
- Visual indicator in the toolbar showing Pause Mode is active.

### 3H. Chunk Navigation via Keyboard
- When the Audio Pane has focus:
  - `←` / `→` — Move cursor to previous / next chunk.
  - `↑` / `↓` — Move cursor to the chunk directly above / below in the flow layout (visual row navigation).
  - `Ctrl+←` / `Ctrl+→` — Jump to previous / next section.
  - `PageUp` / `PageDown` — Jump to previous / next section.
- Navigation wraps: pressing `→` on the last chunk of a section moves to the first chunk of the next section.

### 3I. Chunk Boundary Sound Effects System

This is a distinctive feature: configurable audio cues that play at the start and/or end of chunks during playback.

**Sound effect triggering:**
- A short audio cue (50ms–500ms) can be configured to play at:
  - The **start** of each chunk.
  - The **end** of each chunk.
  - Both.
- Sound effects are layered over (not replacing) the main audio.

**Sound effect assignment rules (in priority order):**
1. **Color + Texture combination**: A specific sound effect assigned to chunks that have *both* a particular color and a particular texture.
2. **Color-specific**: A sound effect assigned to all chunks of a given color (regardless of texture).
3. **Texture-specific**: A sound effect assigned to all chunks of a given texture (regardless of color).
4. **Global default**: A fallback sound effect for any chunk not matched above.
5. **None**: No sound effect (the default out-of-box state).

**Sound effect library:**
- Ship with a built-in library of ~30+ short sounds across categories:
  - Clicks and taps (mechanical, digital, soft)
  - Tones and chimes (musical intervals, bells, pings)
  - Percussive (subtle snare, hi-hat, woodblock)
  - Transitional (swoosh, fade, whoosh)
  - Spoken cues (for accessibility: "next", "end", short beeps)
- Users can **upload custom sound effect files** (wav, mp3, ogg — max 2 seconds each).
- Sound effects are previewed on hover in the settings panel.

**Sound effect configuration UI:**
- Accessible from the sidebar when the Audio Pane has focus.
- A matrix/table: rows are color/texture/combo entries, columns are "Start SFX" and "End SFX".
- Drag-and-drop or dropdown to assign effects.

### 3J. Chunk Number Announcement via TTS

- Toggleable mode where Text-to-Speech announces chunk metadata during playback.
- **Announcement options** (independently toggleable):
  - Announce at the **start** of each chunk.
  - Announce at the **end** of each chunk.
- **Announcement content** (user-selectable):
  - Section-relative number (e.g., "Chunk 3 of 12").
  - Document-relative number (e.g., "Chunk 47").
  - Section name + chunk number (e.g., "Introduction, chunk 3").
- The TTS announcement is spoken at a configurable speed (independent of playback speed).
- TTS voice is selectable from available HeadTTS/Kokoro voices (see §7C, Engine 1). Falls back to Web Speech API voices if HeadTTS is unavailable.
- Announcements are mixed into a separate audio channel so they don't interfere with the main audio (or can optionally briefly duck the main audio).

---

## 4. Color, Texture & Styling System

This system governs the visual appearance of chunks and section backgrounds. It is far more expressive than a simple 5-color palette.

### 4A. Color System

**Built-in colors:**
- Ship with 20+ preset colors organized into families (warm, cool, neutral, vivid, pastel).
- Each color has a label that the user can rename (e.g., "Key Point", "Question", "Review", "Skip").

**Custom color picker:**
- Full-featured color picker with:
  - **HSL sliders** (Hue, Saturation, Lightness).
  - **RGB sliders** (Red, Green, Blue).
  - **Hex input** field.
  - **HSV/HSB** color wheel.
  - **Opacity/Alpha** slider.
  - **Eyedropper** tool to sample colors from anywhere on screen (using the EyeDropper API where supported).
- Recently-used colors row.
- Saved/favorited colors row.

**AI color generation:**
- Text prompt field: user describes a color in natural language (e.g., "dusty sunset pink", "deep ocean blue", "the color of old parchment").
- AI generates one or more matching hex values.
- User can accept, adjust, or regenerate.
- Implementation: Call an LLM endpoint with the description; the model returns hex values. Cache common descriptions.

### 4B. Texture System

**What textures are:**
- A texture is a repeating visual pattern overlaid on or composited with the chunk's color.
- Textures are rendered via CSS background patterns, SVG patterns, or tiled PNG images.

**Built-in textures (~15–20):**
- Diagonal stripes (thin, thick, crosshatch).
- Dots (small, large, scattered).
- Horizontal/vertical lines.
- Waves, zigzag, chevron.
- Noise/grain.
- Stipple/speckle.
- Checkerboard.
- Solid (no texture — the default).

**Custom texture upload:**
- Users can upload a **PNG file** that is used as a repeating tile.
- The PNG is tiled (CSS `background-repeat: repeat`) at its native resolution, or the user can scale it.
- Preview the texture on a sample chunk before applying.

**AI texture generation:**
- Text prompt field: user describes a texture (e.g., "subtle crosshatch like graph paper", "watercolor wash spots", "crumpled paper").
- AI generates an SVG pattern or a small tileable PNG.
- Implementation: Use an image generation API to create a small (e.g., 64×64 or 128×128) seamless tileable texture.

### 4C. Gradients

Chunks and section backgrounds can have **gradient fills** combining multiple colors and/or textures.

**Gradient configuration:**
- **Color gradients**: Pick 2+ colors, each with a stop position (0%–100%).
- **Texture gradients**: Blend between two textures (via opacity crossfade).
- **Direction options**:
  - Left → Right
  - Right → Left
  - Top → Bottom
  - Bottom → Top
- Gradient editor: visual bar showing the gradient with draggable color stops.

### 4D. Applying Styles to Chunks

- **Select one or more chunks** → Choose a color, texture, and/or gradient from the sidebar.
- **Keyboard shortcuts**: Number keys `1`–`9` (and `0` for default) assign the first 10 colors in the active color key.
- **Right-click context menu** on chunks: "Set Color…", "Set Texture…", "Set Gradient…".
- Styles are applied instantly with a brief animation.

### 4E. Section Background Styling

- Each section has its own background color, texture, and/or gradient, independent of chunk styling.
- Configured via right-click on the section header or via the sidebar when a section is selected.
- Section backgrounds appear behind the chunk flow layout.
- Same color/texture/gradient system as chunks (custom colors, PNG textures, AI generation, gradients with configurable direction).

### 4F. Continuous Coloring Mode

- While recording, select a color/texture and all subsequently recorded chunks automatically receive that style.
- The style persists until the user selects a different one or deactivates the mode.
- Visual indicator in the toolbar showing the active continuous color.

### 4G. Color Keys / Style Templates

**Color Key:**
- A named collection of color+texture+label assignments mapped to shortcut keys.
- Ships with defaults: "Lecture", "Interview", "Meeting", "Research".
- Users can create, edit, duplicate, rename, and delete color keys.

**Full Style Templates:**
- A template saves: color key, section background style, default chunk style, sound effect assignments, texture mappings.
- Templates are savable and loadable across projects.
- Export/import templates as JSON files for sharing.

### 4H. Filter & Extract by Style

**Filter (view only):**
- Filter by **color**: Show only chunks matching a selected color. Non-matching chunks are dimmed/collapsed.
- Filter by **texture**: Show only chunks with a selected texture.
- Filter by **color + texture combination**: Show only chunks matching both.
- Multiple filters can be combined (e.g., show all red OR blue chunks).
- A "Clear filter" button restores the full view.

**Extract into new section:**
- Select a color, texture, or combination → "Extract to New Section".
- All matching chunks are **moved** out of their current sections and placed into a newly created section.
- The original positions show a gap or are closed up (user preference).

**Copy into new section:**
- Same as extract, but matching chunks are **duplicated** — originals remain in place.
- The new section contains copies of the audio chunks.

**Copy into new project:**
- Same as copy-to-section, but a new project (tab) is created containing only the matching chunks.
- The new project inherits the color key and style template of the source project.

**All three operations (extract/copy-to-section/copy-to-project) are available for:**
- Color match
- Texture match
- Color + Texture combination match

### 4I. Adaptive Cursor Contrast

The playback cursor must always be clearly visible regardless of the chunk or background styling.

**Algorithm:**
1. At the cursor's current X position, sample the underlying color (from the chunk fill, texture, or gradient at that point).
2. Compute the relative luminance of the sampled color.
3. If luminance > 0.5 → cursor color is `#000000` (black) or a very dark color.
4. If luminance ≤ 0.5 → cursor color is `#FFFFFF` (white) or a very bright color.
5. For extra visibility, add a 1–2px contrasting outline/shadow around the cursor line.
6. This calculation runs in real-time as the cursor moves (especially important for gradient chunks where the background changes across the bar).

---

## 5. Chunk Editing

### 5A. Split Chunk
- Position the cursor within a chunk.
- Press `Ctrl+T` or click the "Split" toolbar button.
- The chunk divides into two at the cursor position.
- If the cursor is in or near silence, the split creates a transparent "silence chunk" between the two.
- Both resulting chunks inherit the parent's color/texture.

### 5B. Merge Chunks (Sequential)
- Select two or more adjacent chunks (they must be contiguous in the original audio).
- Press `Ctrl+M` or click "Merge".
- All selected chunks combine into a single bar.
- The merged chunk takes the color/texture of the first chunk in the selection (or user is prompted).

### 5C. Merge Chunks (Non-Sequential) — Toggle Mode
- A toggle in settings: **"Allow non-sequential merge"** (off by default).
- When enabled, the user can select any chunks from anywhere in the project and merge them.
- The resulting chunk's audio is concatenated in the order selected (with configurable crossfade: 0ms, 50ms, 100ms, 200ms).
- A visual indicator (e.g., a small stitch icon on the chunk) shows that this chunk contains non-contiguous audio.
- **Warning dialog** on first use explaining that this creates a new audio composite.

### 5D. Delete Chunks
- Select one or more chunks → Press `Delete` or `Backspace`.
- Deleted chunks are removed from the view. The audio is not destroyed — it's marked as deleted and can be recovered via undo.
- Option: "Delete and close gap" (chunks reflow) vs. "Delete and leave gap" (a ghost/placeholder remains).

### 5E. Copy / Cut / Paste Chunks
- Standard clipboard operations: `Ctrl+C`, `Ctrl+X`, `Ctrl+V`.
- Paste inserts after the currently-selected chunk or at the cursor position.
- Pasted chunks are duplicates with their own independent color/texture.

### 5F. Drag-and-Drop Reorder
- Grab a chunk (or multi-selection) and drag it to a new position in the flow.
- Drop indicators show where the chunk(s) will land.
- Reordering changes the playback order but preserves the original audio references.

### 5G. Trim Silence
- Select chunks → "Trim Silence" from toolbar or context menu.
- Reduces silence gaps between selected chunks to a maximum of 0.8 seconds.
- Silences shorter than 0.8s are unaffected.
- Note: After trimming, those chunks can no longer be merged (the audio is no longer contiguous).

### 5H. Undo / Redo
- Full undo/redo stack covering all operations: split, merge, delete, move, recolor, retexture, text edits, section changes.
- `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`).
- Undo history is saved with the project (up to a configurable limit, default: 200 actions).

---

## 6. Sections

Sections are vertical divisions of the project. Each section is a container for a set of audio chunks, text notes, annotations, and an optional file attachment. Sections function like "topics", "slides", or "chapters".

### 6A. Section Basics
- A project has one or more sections.
- Each section has:
  - A **name/title** (editable, shown as a header bar above the chunk flow).
  - A **background color/texture/gradient** (see §4E).
  - Its own chunk flow area.
  - Its own text pane content (see §7).
  - Its own annotations pane content (see §8).
  - An optional file attachment slot (see §9).
- Section boundaries are visually clear: a horizontal divider, distinct background, or a header bar.

### 6B. Section Breaks
- Insert a new section break at any point:
  - Via toolbar button: "New Section".
  - Via keyboard: `Ctrl+Enter` or `Enter` (when a "section break" mode is active).
  - During recording: press a configurable key to insert a section break in real-time (e.g., when the topic changes).
- Chunks after the break point flow into the new section.

### 6C. Section Navigation
- `Ctrl+←` / `Ctrl+→` — Jump cursor to previous / next section.
- `PageUp` / `PageDown` — Jump to previous / next section.
- **Section Overview Panel**: A collapsible sidebar or dropdown showing a list of all sections by name. Click to jump.
- Section names appear in a breadcrumb or header showing: `Project Name > Section Name > Chunk #`.

### 6D. Section Operations
- **Rename**: Double-click the section header to rename.
- **Reorder**: Drag sections up/down in the section overview panel, or use `Ctrl+Shift+↑/↓`.
- **Delete**: Remove a section and all its contents (with confirmation dialog). Chunks can optionally be moved to an adjacent section instead.
- **Duplicate**: Copy an entire section (including all chunks, text, annotations) within the same project.
- **Move to new project**: Extract a section into a new project tab.

### 6E. Section-Level Chunk Numbering
- Chunks within each section are numbered starting from 1.
- The section header shows the total chunk count: e.g., "Introduction (24 chunks)".
- Both section-relative and document-relative numbers are available on each chunk (see §2D).

---

## 7. Text Pane (Linked Content Pane)

The Text Pane is **not a free-form notes area**. It is a **linked alternate representation** of the audio content. Its primary purpose is to show the textual version of what's in the Audio Pane, and to allow bidirectional editing between text and audio.

### 7A. Core Concept: Audio ↔ Text Mirroring

The Text Pane shows text that corresponds to the audio in the Audio Pane. This text is generated via Speech-to-Text and is linked at the word level to specific timecodes in the audio. Conversely, text typed or edited in the Text Pane can generate audio via Text-to-Speech that is placed into the Audio Pane.

**The relationship between Audio and Text Panes is configurable into one of four modes:**

**Mode 1: Audio → Text (Audio is master)**
- Changes in the Audio Pane propagate to the Text Pane.
- Editing audio (delete chunk, reorder, split, merge) causes the corresponding text to be updated.
- Editing text directly does NOT affect the audio.
- Use case: The audio is the canonical content; the text is a read-only-ish transcript.

**Mode 2: Text → Audio (Text is master)**
- Changes in the Text Pane propagate to the Audio Pane.
- Editing text (insert, delete, rearrange words/sentences) triggers TTS regeneration of the affected audio chunks.
- Changes in the Audio Pane do NOT affect the text.
- Use case: The user is composing in text and using TTS to generate an audio version.

**Mode 3: Bidirectional (Reciprocal sync)**
- Changes in either pane propagate to the other.
- Editing a chunk in the Audio Pane updates the corresponding text.
- Editing text updates the corresponding audio (via TTS regeneration).
- Conflict resolution: If changes happen in both panes to the same content region, the system prompts the user to resolve.
- Use case: The user works fluidly between both representations.

**Mode 4: Isolated**
- Audio and Text Panes are decoupled.
- Changes in one do not affect the other.
- Use case: The user wants to diverge the text from the audio (e.g., editing a transcript into a polished document while keeping the raw audio intact).

**Retroactive sync:**
- When switching from Isolated mode back to any linked mode, or at any time the user can trigger a "Sync Now" action.
- This applies all accumulated changes from the source pane to the target pane.
- A diff view is shown: "These changes will be applied to [Audio/Text]. Review?" with accept/reject per change.

### 7B. Speech-to-Text (Audio → Text)

- When audio is imported or recorded, the system runs STT to generate a transcript.
- STT engine options (configurable):
  - **Browser Web Speech API** (free, lower quality).
  - **Whisper API** (high quality, requires API key or backend).
  - **Other cloud STT** (Google, Azure — configurable endpoint).
- The STT output includes **word-level timestamps**: each word has a precise start and end time within the audio.
- These timestamps are the foundation of the Audio ↔ Text linkage.
- Text is segmented into paragraphs that correspond to sections, and sentences/phrases that correspond to chunks.

### 7C. Text-to-Speech (Text → Audio) — Two-Engine Architecture

When the user types or edits text in the Text Pane (in a mode where text is master or bidirectional), the system generates audio via TTS. AudioCanvas uses **two TTS engines** for different purposes:

**Engine 1: HeadTTS + libsonic (Primary — standard synthesis)**

HeadTTS is a browser-compatible wrapper around Kokoro-82M that provides word-level timestamps (`wtimes`, `wdurations`), phoneme data, and viseme data directly from the engine. This is the primary TTS engine for all standard text-to-audio generation.

- **Critical: Word-level timecodes from TTS.**
  - HeadTTS returns the exact start time and duration of every word in the generated audio as part of its response object.
  - This is NOT an estimation or forced-alignment system. The timecodes come directly from HeadTTS's output.
  - HeadTTS response format:
    ```
    { words: ['This', 'is', 'an', 'example.'],
      wtimes: [440, 656, 876, 1050],        // Word start times (ms)
      wdurations: [236, 240, 194, 1035] }   // Word durations (ms)
    ```
  - These timecodes must be stored alongside the audio buffer so that text ↔ audio alignment is always precise.
- **Speed control via libsonic:**
  - For playback speeds beyond HeadTTS's native range, libsonic (compiled to WASM) provides high-quality time-stretching.
  - Hybrid strategy: generate at moderate Kokoro-native speed (e.g., 1.5×–2×), then stretch further with libsonic for extreme speeds.
  - Timestamp adjustment after libsonic stretching is mathematical division: `adjusted_time = original_time / total_stretch_factor`.
- **Speed-invariant alignment:**
  - When the user changes playback speed (§3D), the timecodes are **not** re-estimated.
  - Instead, the display system calculates positions by dividing stored timecodes by the playback rate.
  - Example: If word "hello" starts at 1.0s in the buffer, and playback is at 2×, the display time is 0.5s.
  - This ensures alignment is always mathematically exact, never drifting.

**Engine 2: Chatterbox (Voice cloning — user-voice synthesis)**

When the system needs to generate audio that sounds like the user (to maintain continuity with their existing recordings), Chatterbox provides zero-shot voice cloning.

- **Voice profile creation:** On first recording or import, the system extracts a ~10-second reference clip from the user's audio and stores it as their voice profile.
- **Cloned synthesis flow:**
  1. User edits text in text-master or bidirectional mode.
  2. Chatterbox generates audio using the stored voice profile (via `audio_prompt_path` parameter).
  3. Since Chatterbox does not natively provide word-level timestamps, the generated audio is run through **forced alignment** (using Whisper, which is already in the stack for STT) to recover word-level timecodes.
  4. The recovered timecodes are stored in the chunk's `wordTimecodes` array identically to HeadTTS-generated timecodes.
- **When to use which engine:**
  - HeadTTS: chunk number announcements (§3J), File Pane → Audio generation (§9D), any TTS where a generic voice is acceptable.
  - Chatterbox: Text Pane edits in text-master or bidirectional mode where the user's existing audio is nearby and voice continuity matters.
  - User preference: A setting in Project Settings allows the user to choose "Match my voice" (Chatterbox) or "Standard voice" (HeadTTS) for text-driven audio generation.
- **Chatterbox runs locally** — MIT licensed, free, no API key required. Requires a Python backend or WASM compilation for browser use (see §15).

### 7D. AI-Powered Change Interpolation

When major structural edits are made in one pane (e.g., reordering paragraphs, inserting new content, deleting sections), the corresponding changes in the other pane may be complex. AI assists here:

- **Reorder in Audio → Text update**: If chunks are rearranged in the Audio Pane, the Text Pane's paragraphs/sentences are rearranged to match. This is deterministic (based on the chunk ↔ text linkage) for simple reorders.
- **Insert new text → Audio generation**: If the user inserts a new sentence in the Text Pane, TTS generates the corresponding audio and inserts a new chunk at the matching position.
- **Delete text → Audio handling**: Deleting text removes or marks the corresponding chunk(s).
- **Complex edits (AI-assisted)**: When edits are too ambiguous for deterministic mapping (e.g., the user rewrites a paragraph substantially), the system:
  1. Identifies the affected text/audio region.
  2. Uses an LLM to analyze the change and determine the best mapping.
  3. Generates a proposed set of changes to the other pane.
  4. **If confidence is high** (simple insertion, deletion, or reorder): applies automatically.
  5. **If confidence is low** (substantial rewrite, ambiguous mapping): presents a dialog: "I've detected these changes in [pane]. Here's what I'd update in [other pane]. Approve?"

### 7E. Notes Display in Text Pane

- A toggleable mode where annotations (from the Annotations Pane, §8) are shown inline within the Text Pane.
- When toggled on: annotations appear as highlighted, indented, or differently-styled blocks between or alongside the main transcript text.
- When toggled off: only the core transcript/content text is shown.
- Toggle via a toolbar button: "Show Notes" / "Hide Notes".

### 7F. Text-Audio Selection Linking

- Selecting text in the Text Pane highlights the corresponding chunks in the Audio Pane (and vice versa).
- Selecting a chunk in the Audio Pane highlights the corresponding text range.
- This uses the word-level timecode mapping and is always precise.

---

## 8. Annotations Pane

A separate pane dedicated to user notes, comments, and marginalia. Unlike the Text Pane (which mirrors audio content), the Annotations Pane is free-form.

### 8A. Core Functionality
- Rich text editor for typing notes: bold, italic, underline, font size, color.
- Annotations are **linked to specific chunks, sections, or time ranges** in the audio.
- Creating an annotation: select a chunk or time range in the Audio Pane, then type in the Annotations Pane. The annotation is anchored to that chunk/range.
- Annotations are displayed in the Annotations Pane in chronological order (by their anchor point).
- Each annotation shows a small label indicating its anchor (e.g., "§2, Chunk 5" or "03:24–03:31").

### 8B. Annotation-Audio Navigation
- Click an annotation → the Audio cursor jumps to the linked chunk/time range.
- Click a chunk that has annotations → the Annotations Pane scrolls to show the relevant annotation(s).

### 8C. Toggle in Text Pane
- Annotations can optionally be shown inline in the Text Pane (see §7E). This is a display toggle; the canonical home of annotations is always the Annotations Pane.

---

## 9. File Pane

A pane for importing and viewing reference documents alongside the audio and text content. Replaces Sonocent's "Image Pane" with a more general document viewer.

### 9A. Supported File Types
- **PDF**: Rendered page-by-page with scroll and zoom.
- **Markdown**: Rendered as formatted HTML.
- Both displayed in a scrollable, read-only viewer within the File Pane.

### 9B. Importing Files
- Drag-and-drop or file picker.
- Multiple files can be imported; each appears as a tab or entry within the File Pane.
- Files are stored within the project.

### 9C. Text Extraction: File → Text Pane
- Select text within a PDF or Markdown file in the File Pane.
- "Send to Text Pane" action: the selected plain text is inserted into the Text Pane at the cursor position (or appended).
- If the Audio ↔ Text link is active (Mode 2 or 3), this triggers TTS generation so the inserted text also appears as audio chunks.

### 9D. Audio Generation: File → Audio Pane
- Select text in the File Pane → "Generate Audio" action.
- TTS reads the selected text and creates new audio chunks in the Audio Pane.
- The generated audio has **word-level timecodes** (see §7C) so it is fully linked.

### 9E. Cross-Pane Selection Linking

**File → Text → Audio:**
- Selecting text in the File Pane highlights the corresponding text in the Text Pane (if that text has been sent there).
- The corresponding audio chunks in the Audio Pane are also highlighted.
- This forms a three-way selection link: File ↔ Text ↔ Audio.

**Implementation:**
- When text is extracted from a file, a mapping is stored: `{ fileId, fileRange (start/end offsets) } ↔ { textPaneRange } ↔ { audioChunkIds, wordTimecodes }`.
- Selecting in any pane triggers highlighting in the other two via this mapping.

### 9F. Editing Through File Pane Links
- Where possible, edits in the Text Pane that affect file-sourced text propagate highlights back to the File Pane (the file itself is not edited, but the linked ranges update).
- Edits in the Audio Pane (e.g., deleting a TTS-generated chunk) update the Text Pane and dim the corresponding File Pane source region to indicate the content is no longer active.

### 9G. Word-Level Timecode Integrity for TTS

**This is a critical technical requirement that applies to all TTS generation throughout the app (§7C, §9D, and anywhere else TTS is used).**

- Every word of TTS-generated audio must have an exact start time and end time stored.
- For HeadTTS-generated audio: timecodes come directly from the engine's `wtimes` and `wdurations` arrays (not from post-hoc forced alignment or estimation).
- For Chatterbox-generated audio (voice cloning): timecodes are recovered via Whisper forced alignment immediately after generation. While this is technically post-hoc alignment, Whisper's word-level accuracy on clean, just-generated TTS audio is extremely high (>99%).
- When playback speed is changed (0.5×–3×), display calculations use `stored_time / playback_rate` — never re-estimating.
- When audio is split or merged, the word-level timecodes within each chunk are preserved relative to the chunk's own start time.
- When chunks are reordered, the timecodes remain valid because they reference positions within each chunk's own audio buffer, not global project time.

---

## 10. Export

### 10A. Export Audio
- Export selected chunks or the entire project as a single audio file.
- Supported output formats: WAV, MP3, M4A, OGG.
- Options:
  - Include all chunks or only selected/colored chunks.
  - Include silence gaps or trim them.
  - Export at current playback speed or at normal speed.

### 10B. Export Text
- Export the Text Pane content as:
  - **Plain text** (.txt)
  - **Markdown** (.md)
  - **Rich text** (.rtf)
- Options:
  - Include annotations inline or exclude them.
  - Include chunk/section markers or exclude them.
  - Include timestamps or exclude them.

---

## 11. Project Management & Multi-Tab

### 11A. Project Saving & Loading
- Each project saves its complete state:
  - Audio buffer(s).
  - Chunk array with all metadata (timecodes, colors, textures, gradients).
  - Section structure.
  - Text Pane content with word-level timecodes.
  - Annotations.
  - File attachments.
  - Color key / style template.
  - Sound effect assignments.
  - Playback settings (speed, volume, mode).
  - Undo history.
- Storage: IndexedDB for local persistence. Optional cloud sync (future).
- Auto-save at configurable intervals (default: every 30 seconds).

### 11B. Multi-Tab Interface
- The application supports **multiple open projects in tabs**, similar to a browser or code editor.
- Tab bar at the top shows open projects.
- Operations like "Copy chunks to new project" (§4H) open the new project in a new tab.
- Drag-and-drop chunks between tabs to copy audio between projects.
- Each tab has its own independent Audio/Text/Annotations/File pane state.

### 11C. Project Templates
- Save a project's style configuration (color key, textures, sound effects, section background styles, default settings) as a **template**.
- When creating a new project, choose from available templates or start blank.
- Templates are stored locally and can be exported/imported as JSON.

### 11D. Project Browser
- A home screen / project list showing all saved projects.
- Search, sort by date, filter by template.
- Rename, duplicate, delete projects.

---

## 12. Layout & UI Framework

### 12A. Multi-Pane Resizable Layout

The application has four panes, each independently toggleable and resizable:

| Pane | Purpose | Default Position |
|------|---------|-----------------|
| **Audio Pane** | Chunk flow layout, playback controls | Top/Center (largest) |
| **Text Pane** | Linked transcript/content | Right or Bottom |
| **Annotations Pane** | Free-form notes linked to chunks | Right sidebar or Bottom |
| **File Pane** | PDF/Markdown viewer | Right sidebar or Tab alongside Annotations |

- Pane borders are draggable to resize.
- Each pane has a header with the pane name and a toggle (show/hide) button.
- Panes can be toggled on/off via toolbar buttons or keyboard shortcuts.
- The layout remembers its configuration per project.

### 12B. Contextual Sidebar
- A right sidebar that changes content based on which pane has focus:
  - **Audio Pane focused**: Shows color key, texture picker, sound effect settings, chunk info.
  - **Text Pane focused**: Shows formatting tools, sync mode selector, STT/TTS settings.
  - **Annotations Pane focused**: Shows annotation list, formatting tools.
  - **File Pane focused**: Shows file list, extraction tools.

### 12C. Toolbar
- Top toolbar with primary actions:
  - Record, Import, Play/Pause/Stop, Rewind, Forward.
  - Speed control, Pause Mode toggle.
  - Visual Mode toggle (Waveform / Flat).
  - Section break button.
  - Split / Merge / Delete chunk buttons.
  - Sync mode indicator (Audio→Text, Text→Audio, Bidirectional, Isolated).
  - Project save, export buttons.

### 12D. Status Bar
- Bottom bar showing:
  - Current position (time and chunk number).
  - Project duration.
  - Section name.
  - Active modes (Pause Mode, Continuous Coloring, Non-Sequential Merge enabled).
  - Playback speed.

---

## 13. Keyboard Navigation & Accessibility

### 13A. Keyboard-First Design
- Every feature is accessible via keyboard shortcuts.
- `Tab` cycles focus between panes (Audio → Text → Annotations → File → Audio).
- When a pane has focus, its header highlights with a colored border.

### 13B. Audio Pane Keyboard Controls
| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next chunk |
| `↑` / `↓` | Chunk above / below (visual row) |
| `Ctrl+←` / `Ctrl+→` | Previous / Next section |
| `PageUp` / `PageDown` | Previous / Next section |
| `Home` / `End` | Start / End of project |
| `Space` | Play / Pause |
| `1`–`9` | Assign color 1–9 to selected chunks |
| `0` | Reset selected chunks to default color |
| `Ctrl+T` | Split chunk at cursor |
| `Ctrl+M` | Merge selected chunks |
| `Delete` / `Backspace` | Delete selected chunks |
| `Ctrl+A` | Select all chunks in current section |
| `Ctrl+Shift+A` | Select all chunks in project |
| `Shift+←` / `Shift+→` | Extend selection left/right |
| `Enter` | Insert section break at cursor |

### 13C. Global Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+Space` | Play / Pause (from any pane) |
| `Ctrl+S` | Save project |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+Shift+W` | Toggle Waveform / Flat view |
| `Ctrl+N` | New project (new tab) |
| `Ctrl+O` | Open project |
| `Ctrl+Tab` | Next project tab |
| `Ctrl+Shift+Tab` | Previous project tab |

### 13D. ARIA & Screen Reader Support
- All interactive elements have appropriate ARIA roles and labels.
- Chunk bars: `role="button"` with `aria-label="Chunk 5 of 12, Section Introduction, color: Key Point, duration: 4.2 seconds"`.
- Pane focus announcements via `aria-live` regions.
- Transport controls labeled with state: "Play button, paused at 3 minutes 24 seconds".

---

## 14. Core Data Model

```typescript
interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  audioBuffers: AudioBufferRef[];       // One or more source audio buffers
  chunks: Chunk[];
  sections: Section[];
  colorKey: ColorKey;
  styleTemplate: StyleTemplate;
  soundEffectConfig: SoundEffectConfig;
  textPaneContent: TextPaneState;
  annotationsPaneContent: Annotation[];
  files: ImportedFile[];
  settings: ProjectSettings;
  voiceProfile: VoiceProfile | null;    // User's voice for cloned TTS (§7C)
  undoStack: UndoAction[];
  redoStack: UndoAction[];
}

interface AudioBufferRef {
  id: string;
  originalFileName: string;
  blob: Blob;                           // The raw audio file
  decodedBuffer: AudioBuffer;           // Decoded PCM data
  sampleRate: number;
  duration: number;                     // seconds
}

interface Chunk {
  id: string;
  audioBufferId: string;                // Which source buffer this chunk references
  startTime: number;                    // seconds into the source buffer
  endTime: number;                      // seconds into the source buffer
  sectionId: string;
  orderIndex: number;                   // Position within the section
  color: string | null;                 // Hex color or null for default
  texture: TextureRef | null;
  gradient: GradientConfig | null;
  isDeleted: boolean;
  isNonSequentialMerge: boolean;        // True if created from non-adjacent merge
  mergedFromChunkIds: string[] | null;  // Track provenance for non-sequential merges
  wordTimecodes: WordTimecode[];        // Word-level alignment data
}

interface WordTimecode {
  word: string;
  startTime: number;                    // Relative to the CHUNK's start (not project)
  endTime: number;                      // Relative to the CHUNK's start
  textPaneOffset: number;               // Character offset in the Text Pane
  confidence: number;                   // STT confidence score (0-1)
}

interface Section {
  id: string;
  name: string;
  orderIndex: number;
  backgroundColor: string | null;
  backgroundTexture: TextureRef | null;
  backgroundGradient: GradientConfig | null;
}

interface TextureRef {
  type: 'builtin' | 'custom';
  builtinName?: string;                 // e.g., 'diagonal-stripes', 'dots-small'
  customPngBlob?: Blob;                 // User-uploaded PNG
  scale?: number;                       // Tile scale factor (default: 1)
  opacity?: number;                     // 0–1
}

interface GradientConfig {
  direction: 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';
  stops: GradientStop[];
}

interface GradientStop {
  position: number;                     // 0–100 (percentage)
  color: string;                        // Hex
  texture?: TextureRef;
  opacity?: number;
}

interface ColorKey {
  id: string;
  name: string;
  colors: ColorKeyEntry[];
}

interface ColorKeyEntry {
  hex: string;
  label: string;
  shortcutKey: number;                  // 1–9, 0 for default
  texture?: TextureRef;
}

interface StyleTemplate {
  id: string;
  name: string;
  colorKey: ColorKey;
  defaultChunkColor: string;
  defaultChunkTexture: TextureRef | null;
  defaultSectionBackground: string;
  defaultSectionTexture: TextureRef | null;
  soundEffectConfig: SoundEffectConfig;
}

interface SoundEffectConfig {
  globalStartSfx: SoundEffectRef | null;
  globalEndSfx: SoundEffectRef | null;
  colorRules: SoundEffectRule[];        // Color-specific
  textureRules: SoundEffectRule[];      // Texture-specific
  comboRules: SoundEffectRule[];        // Color+Texture combo — highest priority
}

interface SoundEffectRule {
  matchColor?: string;                  // Hex to match
  matchTexture?: string;               // Texture name/id to match
  startSfx: SoundEffectRef | null;
  endSfx: SoundEffectRef | null;
}

interface SoundEffectRef {
  type: 'builtin' | 'custom';
  builtinName?: string;
  customBlob?: Blob;
}

interface Annotation {
  id: string;
  sectionId: string;
  anchorChunkIds: string[];             // Which chunks this is linked to
  anchorStartTime?: number;
  anchorEndTime?: number;
  content: string;                      // Rich text (HTML or Markdown)
  createdAt: Date;
  updatedAt: Date;
}

interface ImportedFile {
  id: string;
  name: string;
  type: 'pdf' | 'markdown';
  blob: Blob;
  textMappings: FileTextMapping[];      // Links to Text Pane content
}

interface FileTextMapping {
  fileStartOffset: number;
  fileEndOffset: number;
  textPaneStartOffset: number;
  textPaneEndOffset: number;
  chunkIds: string[];
}

interface ProjectSettings {
  playbackSpeed: number;
  volume: number;
  pauseModeEnabled: boolean;
  continuousColoringEnabled: boolean;
  continuousColor: string | null;
  nonSequentialMergeEnabled: boolean;
  visualMode: 'waveform' | 'flat';
  chunkNumberDisplay: 'section-relative' | 'document-relative' | 'both' | 'hidden';
  ttsAnnouncementConfig: TTSAnnouncementConfig;
  ttsEngine: 'headtts' | 'chatterbox-clone'; // Which engine for text→audio generation
  syncMode: 'audio-master' | 'text-master' | 'bidirectional' | 'isolated';
  showNotesInTextPane: boolean;
  silenceThresholdDb: number;
  minSilenceDurationMs: number;
  minChunkDurationMs: number;
}

interface VoiceProfile {
  id: string;
  referenceClipBlob: Blob;              // ~5–10s audio clip of the user's voice
  sourceAudioBufferId: string;          // Which audio buffer the clip was extracted from
  sourceStartTime: number;              // Where in the buffer
  sourceEndTime: number;
  createdAt: Date;
}

interface TTSAnnouncementConfig {
  enabled: boolean;
  announceAt: 'start' | 'end' | 'both';
  content: 'section-relative' | 'document-relative' | 'section-name-and-number';
  voice: string;                        // HeadTTS/Kokoro voice ID (e.g., 'af_bella')
  speed: number;
}
```

---

## 15. Technical Architecture Notes

### Suggested Stack
- **Frontend**: React 18+ with TypeScript
- **State Management**: Zustand (lightweight, good for complex nested state like chunks/sections)
- **Audio Engine**: Web Audio API (`AudioContext`, `AudioBufferSourceNode`, `AnalyserNode`, `GainNode`)
- **Recording**: `MediaRecorder` API
- **STT**: Web Speech API (fallback) + OpenAI Whisper API (primary, for word-level timestamps)
- **TTS Engine 1 (Primary)**: HeadTTS (Kokoro-82M wrapper) — runs in browser, provides word-level timestamps (`wtimes`, `wdurations`), phoneme/viseme data. Used for standard synthesis and chunk announcements.
- **TTS Engine 2 (Voice Cloning)**: Chatterbox (MIT licensed, by Resemble AI) — zero-shot voice cloning from ~5–10 seconds of reference audio. Used when generating audio that matches the user's voice. Runs locally via Python backend. Word-level timestamps recovered via Whisper forced alignment.
- **Time-Stretching**: libsonic compiled to WASM — high-quality PICOLA-based time-stretching for playback speed control beyond native TTS range.
- **AI / LLM**: Anthropic Claude API for change interpolation (§7D) and color/texture description (§4A, §4B)
- **Image Generation**: For AI texture generation, use a small model endpoint that produces tileable patterns
- **Layout**: CSS Grid for the main pane layout; Flexbox for the chunk flow within the Audio Pane
- **Resizable Panes**: `react-resizable-panels` or `allotment`
- **Rich Text**: TipTap or Slate.js for the Annotations Pane
- **PDF Rendering**: `react-pdf` (based on PDF.js)
- **Markdown Rendering**: `react-markdown`
- **Local Storage**: IndexedDB via `idb` library for project persistence
- **Audio Export**: `lamejs` for MP3 encoding, native `AudioBuffer` → WAV conversion

### Key Implementation Priorities (Build Order)

**Phase 1 — Core Loop:**
1. Audio import & recording (§1)
2. Silence-based segmentation (§2A)
3. Chunk bar rendering in flow layout, both visual modes (§2B, §2C)
4. Click-to-play, cursor, transport controls (§3A–§3C)
5. Basic color assignment with keyboard shortcuts (§4A, §4D)
6. Split, merge (sequential), delete, undo/redo (§5A, §5B, §5D, §5H)
7. Basic sections with navigation (§6A–§6C)
8. Multi-pane resizable layout (§12A)

**Phase 2 — Rich Styling:**
9. Full color picker, texture system, gradients (§4A–§4C)
10. Custom PNG texture upload, AI color/texture generation (§4B)
11. Color key templates, section backgrounds (§4E, §4G)
12. Filter & extract/copy by color/texture/combo (§4H)
13. Adaptive cursor contrast (§4I)
14. Sound effects system (§3I)
15. Chunk number announcements via TTS (§3J)

**Phase 3 — Text ↔ Audio Integration:**
16. STT integration with word-level timecodes via Whisper (§7B)
17. HeadTTS integration with native word-level timecodes (§7C, Engine 1)
18. Chatterbox voice cloning integration with Whisper forced alignment for timecodes (§7C, Engine 2)
19. Text Pane with four sync modes (§7A)
20. AI change interpolation (§7D)
21. Annotations Pane (§8)
22. File Pane with PDF/Markdown viewing and cross-pane linking (§9)

**Phase 4 — Polish:**
23. Multi-tab project management (§11B)
24. Project templates and browser (§11C, §11D)
25. Export (§10)
26. Playback speed, pitch shift, volume, pause mode (§3D–§3G)
27. Non-sequential merge (§5C)
28. Full keyboard accessibility and ARIA (§13)
29. Drag-and-drop reorder (§5F)

---

*This document is the complete v1 specification. Each section can be handed to a coding agent or used as a reference during vibe coding sessions.*
