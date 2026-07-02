# Ebook Quality Gate Checklist
## Distribution Readiness Analysis

**Version:** 1.2 | **Last Updated:** 2026-02-27

This checklist documents every problem discovered during ebook generation and completion. Before any ebook can be pushed to "ready" status, it must pass ALL automated checks below. New findings are added as they are discovered.

---

## CRITICAL CHECKS (Auto-Detected — Must Pass)

### 1. TRUNC-001: Chapter Truncation
- **Problem:** Chapters end mid-sentence or mid-paragraph because the AI hit its token limit during generation
- **How Found:** Book 26 "The Forgotten Realms" Chapter 12 ended with "four mortals and one man braided with a" — incomplete sentence
- **Detection:** Check if the last non-empty line of each chapter ends with proper punctuation (.!?..."'—)
- **Fix:** Repair system regenerates the truncated chapter with higher token limits; replaced text uses the "isPlaceholder" path to overwrite rather than insert

### 2. DUP-001: Duplicate Chapters
- **Problem:** Multiple copies of the same chapter number appear in a book — caused by the repair process inserting new chapter versions without removing the old ones
- **How Found:** Book 26 had Chapter 12 appearing 5 times; 10 of 15 fixed books had duplicates (IDs 26, 51, 55, 57, 73, 74, 80, 86, 121, 145)
- **Detection:** Count occurrences of each `## Chapter N` heading — any appearing more than once is a duplicate
- **Fix:** Deduplication function keeps only the longest version of each duplicate chapter and removes shorter copies

### 3. MISS-001: Missing Chapters
- **Problem:** Chapters listed in the outline are not present in the actual content — caused by server restarts killing generation mid-process
- **How Found:** Multiple books had gaps (e.g., Book 15 missing chapters 11-14, Book 86 missing chapters 7-12)
- **Detection:** Compare actual chapter headings against planned chapter count from outline
- **Fix:** Repair system generates missing chapters using context from surrounding chapters

### 4. SHORT-001: Too-Short Chapters
- **Problem:** Chapters with word count far below genre minimum — caused by AI producing summaries instead of full prose, or partial generation before crash
- **How Found:** Book 15 had chapters 7, 8, 9 at ~350 words each (minimum should be ~2000)
- **Detection:** Word count per chapter < 30% of genre minWordsPerChapter
- **Fix:** Repair system treats short chapters as "placeholders" and regenerates them with full prose

### 5. TBC-001: "To Be Continued" / Placeholder Markers
- **Problem:** Chapters contain "to be continued", "TBC", or "the story continues" instead of actual ending
- **How Found:** Book 103 "Stairway to the Vault of Freedom" had TBC markers
- **Detection:** Regex scan: `/to be continued|tbc|the story continues/i`
- **Fix:** Repair system regenerates affected chapters with explicit instruction to avoid placeholder endings

### 6. PLACEHOLDER-001: Generation Placeholders
- **Problem:** Content contains "[Content generation incomplete]" or "Please regenerate this ebook" text from failed generation
- **Detection:** Regex scan for `[Content generation incomplete` and `Please regenerate`
- **Fix:** Full chapter regeneration

### 7. CORRUPT-001: Content Corruption from Incremental Saves
- **Problem:** Incremental streaming save feature (since removed) overwrote full book content with partial chapter data during server restarts — destroyed content for 5 books (38, 51, 65, 80, 145)
- **How Found:** Books suddenly lost all chapters except the one being actively written
- **Detection:** Total word count dramatically lower than expected; early chapters missing while later ones exist
- **Fix:** Feature permanently removed; affected books regenerated from scratch

### 8. RESUME-001: Bad Resume Logic Overwrites  
- **Problem:** Overly aggressive "resume from Ch2" logic deleted existing chapters 3+ when trying to resume — affected 4 books (55, 57, 64, 86)
- **How Found:** Books that had 8+ chapters suddenly showed only chapters 1-2
- **Detection:** Content gap where chapters 2-N are missing
- **Fix:** Logic fixed to only resume from the actual last chapter, not always from chapter 2

---

## HIGH SEVERITY CHECKS

### 9. TOC-001: Table of Contents Mismatch
- **Problem:** Table of contents lists chapters that don't exist in the book body, or content has chapters not listed in the TOC
- **How Found:** Book 26 TOC showed 16 chapters but content only went to Chapter 12
- **Detection:** Compare TOC chapter listings against actual chapter headings
- **Fix:** TOC should be regenerated to match actual content after all repairs are complete

### 10. ORDER-001: Chapter Ordering
- **Problem:** Chapters appear out of numerical order — caused by repair insertions at wrong positions
- **Detection:** Verify chapter numbers appear in ascending sequential order
- **Fix:** Content restructuring to place chapters in correct order

### 11. ENDING-001: Unsatisfying Story Ending
- **Problem:** Final chapter doesn't properly resolve central conflicts or character arcs
- **Detection:** Manual review required
- **Fix:** Regenerate final chapter with explicit instruction to provide narrative closure

### 12. CONTINUITY-001: Chapter Continuity Breaks
- **Problem:** Story flow breaks between chapters, especially where repaired chapters don't connect to surrounding content
- **How Found:** Repaired chapters sometimes start with different character names or locations than where previous chapter ended
- **Detection:** Manual review of chapter transitions
- **Fix:** Regenerate with context from both the preceding and following chapters

### 13. STATUS-001: Stuck in Generating Status
- **Problem:** Book stuck in "generating" status after server restart killed the generation process
- **How Found:** Multiple books were stuck in "generating" with no active process running
- **Detection:** Check if status is "generating" but no active generation exists
- **Fix:** Reset status to "draft" and re-trigger repair

### 14. ILLUST-001: Back-to-Back Illustrations (CRITICAL)
- **Problem:** Two or more illustrations placed directly next to each other with no meaningful text (≤5 words) between them. Creates empty-looking pages in the reader — looks like the same image repeated with nothing to read.
- **How Found:** Book 334 "Dopamine Reset Quotes" had 5 back-to-back illustration pairs; Book 426 had 4. Some pages showed two images side by side with essentially no words.
- **Detection:** Scan for consecutive `[ILLUSTRATION:...]` markers with ≤5 words between them
- **Fix:** Remove redundant adjacent illustrations or inject meaningful text between them

### 15. ILLUST-002: Sparse Text Between Illustrations
- **Problem:** Multiple sections with very little text (<30 words) between illustrations. Makes the book feel like a picture gallery rather than an illustrated ebook with real content.
- **How Found:** Book 334 had 11 segments between illustrations with only 2 words each (just whitespace)
- **Detection:** Count segments between illustrations with <30 words; flag if more than 3 such sparse segments exist
- **Fix:** Either remove excess illustrations or add contextual text between them

### 16. ILLUST-003: Unprocessed Illustration Markers (CRITICAL)
- **Problem:** Text-based illustration descriptions (`[ILLUSTRATION: A scene of...]`) that were never converted to actual images. Reader shows the raw text description instead of a picture.
- **How Found:** Books 462 and 532 have markers permanently blocked by AI safety filter (phishing and street photography descriptions)
- **Detection:** Scan for `[ILLUSTRATION: ...]` markers that do NOT contain `/uploads/illustrations/` paths
- **Fix:** Either rewrite the marker description to pass safety filters, or remove the marker entirely

### 17. ILLUST-004: Excessive Illustration Density
- **Problem:** A single chapter with more than 8 illustrations, over-saturating it with images and diluting the written content
- **How Found:** Marker injection occasionally concentrated too many images in certain chapters
- **Detection:** Count illustrations per chapter and flag any with >8
- **Fix:** Remove excess illustrations to maintain a balanced text-to-image ratio

---

## MEDIUM SEVERITY CHECKS

### 18. META-001: AI Meta-Commentary in Content
- **Problem:** Content contains "As an AI...", "In this chapter we will...", "Note to the reader..." or similar non-narrative AI text
- **How Found:** Book 48 (published) and Book 231 flagged
- **Detection:** Regex scan for AI meta-commentary patterns
- **Fix:** Regenerate affected chapters with stronger instruction to stay in narrative voice

### 19. STYLE-001: Pre-Author-System Content
- **Problem:** Books written before the AI Story Architect system lack bestselling author techniques, rich dialogue, and meaningful character development
- **Detection:** Check if book was generated before Story Architect was added
- **Fix:** Full rewrite using the current author system with genre-specific techniques

### 20. FORMAT-001: Markdown Formatting Issues
- **Problem:** Broken markdown — missing chapter separators (---), malformed headings, inconsistent formatting
- **Detection:** Validate markdown structure
- **Fix:** Automated formatting cleanup

---

## PROCESS NOTES

### Token Limits
- Main generation: `Math.min(16384, Math.max(8000, maxWordsPerChapter * 3))` tokens per chapter
- Repair generation: `Math.min(16384, Math.max(8000, maxWordsPerChapter * 3))` tokens per chapter
- Fantasy/Sci-Fi chapters (3000-5000 words) need up to 15,000 tokens
- Never restrict the AI's creative output — let the art take its course

### Server Restart Resilience
- Server restarts every 3-5 minutes during generation
- Each restart kills any active generation process
- Repairs must be re-triggered after each restart
- The shutdown guard delays SIGTERM up to 10 minutes if generation is active
- DO NOT add incremental saves during streaming — this caused content corruption (CORRUPT-001)

### Quality Gate Enforcement
- The repair system's `isComplete` check enforces ALL critical checks (structural + dialogue) before setting status to "ready"
- Books that fail ANY critical check remain in "draft" status
- The scan-completeness endpoint checks all structural items
- AI Dialogue Quality Check (`checkDialogueQuality()`) reads the ENTIRE book and evaluates dialogue/prose quality using GPT-4o-mini — books scoring below 6/10 stay in draft
- Final Sweep (`POST /api/content-studio/sweep-ready`) runs structural + dialogue checks on ALL "ready" books before bulk publish
- Bulk Publish (`POST /api/content-studio/bulk-publish-ready`) publishes all "ready" books that passed the sweep

---

## AUTOMATED CHECK SUMMARY (enforced before "ready" status)

| Check | Enforced | Gate |
|-------|----------|------|
| No truncated chapters | Yes | critical |
| No duplicate chapters | Yes | critical |
| No missing chapters | Yes | critical |
| No too-short chapters | Yes | critical |
| No TBC markers | Yes | critical |
| No placeholders | Yes | critical |
| No AI meta-commentary | Yes | critical |
| Chapters in order | Yes | critical |
| Minimum word count met | Yes | critical |
| AI dialogue/prose quality ≥6/10 | Yes | critical |
| No back-to-back illustrations | Yes | critical |
| No unprocessed illustration markers | Yes | critical |
| No sparse illustration segments (>3) | Yes | high |
| No excessive illustration density (>8/ch) | Yes | high |
| Status not stuck | Yes | high |

---

*This document is the single source of truth for ebook quality requirements. All new findings must be added here with an ID, description, how it was found, detection method, and fix.*
