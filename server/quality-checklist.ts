export const EBOOK_QUALITY_CHECKLIST = {
  version: "1.0",
  lastUpdated: "2026-02-27",
  
  checks: [
    {
      id: "TRUNC-001",
      category: "Content Integrity",
      name: "Chapter Truncation",
      description: "Chapters that end mid-sentence or mid-paragraph due to AI token limits being hit during generation",
      detection: "Check if the last non-empty line of each chapter ends with proper punctuation (.!?…\"'—)",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "DUP-001",
      category: "Content Integrity",
      name: "Duplicate Chapters",
      description: "Multiple copies of the same chapter number caused by repair process inserting new chapters without removing the old version",
      detection: "Count occurrences of each chapter number heading — any chapter appearing more than once is a duplicate",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "MISS-001",
      category: "Content Completeness",
      name: "Missing Chapters",
      description: "Chapters listed in the outline/table of contents but not present in the actual content, caused by server restarts during generation",
      detection: "Compare chapter headings found in content against the planned chapter count from the outline",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "SHORT-001",
      category: "Content Quality",
      name: "Too-Short Chapters",
      description: "Chapters with word count far below genre minimum, often caused by AI producing summaries instead of full prose, or partial generation before server restart",
      detection: "Check word count per chapter against genre spec minimum (threshold: less than 30% of minWordsPerChapter)",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "TBC-001",
      category: "Content Integrity",
      name: "TBC/Placeholder Markers",
      description: "Chapters containing 'to be continued', 'TBC', 'the story continues', or placeholder text instead of actual content",
      detection: "Regex scan for /to be continued|tbc|the story continues/i and placeholder patterns",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "PLACEHOLDER-001",
      category: "Content Integrity",
      name: "Generation Placeholders",
      description: "Content containing '[Content generation incomplete]' or 'Please regenerate this ebook' placeholder text from failed generation attempts",
      detection: "Regex scan for placeholder patterns in content",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "TOC-001",
      category: "Structure",
      name: "Table of Contents Mismatch",
      description: "Table of contents listing chapters that don't exist in the content, or content having chapters not listed in the TOC",
      detection: "Compare TOC chapter listings against actual chapter headings in content",
      severity: "high",
      autoDetectable: true
    },
    {
      id: "ORDER-001",
      category: "Structure",
      name: "Chapter Ordering",
      description: "Chapters appearing out of numerical order in the content, caused by repair insertions at wrong positions",
      detection: "Verify chapter numbers appear in ascending sequential order",
      severity: "high",
      autoDetectable: true
    },
    {
      id: "STYLE-001",
      category: "Content Quality",
      name: "Pre-Author-System Content",
      description: "Chapters written before the AI Story Architect system was implemented, resulting in generic or flat prose lacking bestselling author techniques, rich dialogue, and meaningful character development",
      detection: "Check if book was generated before the Story Architect system was added; compare prose quality markers",
      severity: "medium",
      autoDetectable: false
    },
    {
      id: "CORRUPT-001",
      category: "Content Integrity",
      name: "Content Corruption from Incremental Saves",
      description: "Full content overwritten during server restart cycles when incremental streaming save feature was active (now removed). Manifests as content being replaced with partial chapter data",
      detection: "Compare total word count against expected minimum; check if early chapters are missing while later ones exist",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "RESUME-001",
      category: "Content Integrity",
      name: "Bad Resume Logic Overwrites",
      description: "Overly aggressive 'resume from Ch2' logic that deleted existing chapters when attempting to resume generation, caused by treating all books as needing a fresh start from chapter 2",
      detection: "Check if book has content gap where chapters 2-N are missing but chapter 1 and later chapters exist",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "ENDING-001",
      category: "Content Quality",
      name: "Unsatisfying Story Ending",
      description: "Final chapter that doesn't properly resolve central conflicts, character arcs, or provide narrative closure",
      detection: "Manual review — check that final chapter resolves main plot threads and character journeys",
      severity: "high",
      autoDetectable: false
    },
    {
      id: "DIALOGUE-001",
      category: "Content Quality",
      name: "Flat or Generic Dialogue",
      description: "Characters speaking in similar voices without distinct personality, or dialogue that reads like exposition rather than natural conversation",
      detection: "Manual review — check that each character has a distinct voice and dialogue reveals character",
      severity: "medium",
      autoDetectable: false
    },
    {
      id: "CONTINUITY-001",
      category: "Content Quality",
      name: "Chapter Continuity Breaks",
      description: "Story or narrative flow breaking between chapters, especially where repaired/regenerated chapters don't properly connect to surrounding content",
      detection: "Check that each chapter picks up naturally from where the previous one ended",
      severity: "high",
      autoDetectable: false
    },
    {
      id: "META-001",
      category: "Content Integrity",
      name: "AI Meta-Commentary in Content",
      description: "AI-generated text containing meta-commentary like 'As an AI...', 'In this chapter we will...', 'Note to the reader...', or other non-narrative text that breaks immersion",
      detection: "Regex scan for common AI meta-commentary patterns",
      severity: "high",
      autoDetectable: true
    },
    {
      id: "FORMAT-001",
      category: "Structure",
      name: "Markdown Formatting Issues",
      description: "Broken markdown formatting — missing chapter heading separators (---), malformed headings, or inconsistent formatting between chapters",
      detection: "Validate markdown structure: each chapter should have ## heading followed by content, separated by ---",
      severity: "medium",
      autoDetectable: true
    },
    {
      id: "WORDCOUNT-001",
      category: "Content Completeness",
      name: "Total Word Count Below Minimum",
      description: "Book total word count below the minimum threshold (5000 words), indicating incomplete or severely truncated content",
      detection: "Check total word count against MIN_WORD_COUNT constant",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "STATUS-001",
      category: "Process",
      name: "Stuck in Generating Status",
      description: "Book stuck in 'generating' status after server restart killed the generation process, preventing further operations",
      detection: "Check if status is 'generating' but no active generation process exists for this book",
      severity: "high",
      autoDetectable: true
    },
    {
      id: "ILLUST-001",
      category: "Illustration Quality",
      name: "Back-to-Back Illustrations",
      description: "Two or more illustrations placed directly adjacent with no meaningful text between them (≤5 words). Creates empty-looking pages in the reader and makes the book feel padded with images rather than enriched by them.",
      detection: "Scan for consecutive [ILLUSTRATION:...] markers with ≤5 words between them",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "ILLUST-002",
      category: "Illustration Quality",
      name: "Sparse Text Between Illustrations",
      description: "Multiple illustration segments with very little text between them (<30 words). Results in a picture-book feel rather than an illustrated ebook with substantive content.",
      detection: "Count segments between illustrations with <30 words; flag if more than 3 such segments exist",
      severity: "high",
      autoDetectable: true
    },
    {
      id: "ILLUST-003",
      category: "Illustration Quality",
      name: "Unprocessed Illustration Markers",
      description: "Text-based illustration descriptions that were never converted to actual images. Reader shows raw marker text instead of an image.",
      detection: "Scan for [ILLUSTRATION: ...] markers that do NOT contain /uploads/illustrations/ paths",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "ILLUST-004",
      category: "Illustration Quality",
      name: "Excessive Illustration Density",
      description: "A single chapter with more than 8 illustrations, making it image-heavy and diluting the written content. Indicates marker injection over-saturated that chapter.",
      detection: "Count illustrations per chapter and flag any with >8",
      severity: "high",
      autoDetectable: true
    },
    {
      id: "ILLUST-005",
      category: "Illustration Quality",
      name: "Outline Illustration Coverage Gap",
      description: "The book's outline specifies illustrations for a chapter but the actual content has none. This means the text likely references images that don't exist, making it look unprofessional (e.g., 'as shown in the illustration below' with no image).",
      detection: "Compare each chapter's outline [ILLUSTRATION:] markers against the content's actual illustration count. Flag chapters where outline specifies illustrations but content has zero.",
      severity: "critical",
      autoDetectable: true
    },
    {
      id: "ILLUST-006",
      category: "Illustration Quality",
      name: "Dangling Image Reference",
      description: "Text contains phrases like 'as shown in the illustration below' or 'see the diagram' but no illustration exists within 500 characters. The reader sees a reference to a non-existent image.",
      detection: "Regex scan for image-referencing phrases, then check if an [ILLUSTRATION:] marker with a real image path exists within 500 characters of the reference.",
      severity: "critical",
      autoDetectable: true
    }
  ]
};

export type QualityCheckResult = {
  checkId: string;
  passed: boolean;
  details?: string;
};

export type BookQualityReport = {
  bookId: number;
  title: string;
  genre: string;
  wordCount: number;
  chapterCount: number;
  passedAll: boolean;
  checks: QualityCheckResult[];
  readyForDistribution: boolean;
};
