/**
 * Schoolbooks catalog — Cover Review placers only (NO content generation).
 *
 * Research basis (US market):
 * - K–12 cores follow Common Core ELA/Math + typical state science/social studies sequences
 * - High school uses course-based titles (Algebra I, Biology, US History…) like McGraw Hill / Pearson / HMH catalogs
 * - College = high-enrollment gen-ed intros (composition, calc, psych, chem…)
 * - Trade/career = high-demand credential & skilled-trade foundations (HVAC, CNA, CDL, IT support…)
 *
 * Quality bar in writing briefs: clear objectives, worked examples, practice, checks for understanding,
 * accessible voice — modeled on what top US textbook lines emphasize (not copying any trademarked series).
 *
 *   npx tsx --import ./script/load-env.ts script/seed-schoolbook-placers.ts
 *   npx tsx --import ./script/load-env.ts script/seed-schoolbook-placers.ts --dry-run
 */
import "./load-env.ts";
import { bulkCreateTitlePlacers, type ResearchWritingBrief } from "../server/contentStudio";

const dryRun = process.argv.includes("--dry-run");

type Placer = {
  title: string;
  genre: string;
  topic: string;
  description: string;
  writingBrief: ResearchWritingBrief;
  band: "elementary" | "middle" | "high" | "college" | "trade";
};

function eduBrief(opts: {
  audience: string;
  gradeOrLevel: string;
  subject: string;
  beats: string[];
  themes?: string[];
  standardsFocus?: string[];
  learningObjectives?: string[];
}): ResearchWritingBrief {
  return {
    targetAudience: opts.audience,
    marketRationale: `US school/college demand for ${opts.subject} at ${opts.gradeOrLevel}; compete with Big-3 textbook clarity (objectives, examples, practice) in affordable ebook form that a teacher can assign and a student can take home`,
    toneAndVoice: `STUDENT TEXTBOOK voice — written TO the ${opts.gradeOrLevel} learner, not to parents or teachers. Second person ("you") addressing the student. Grade-appropriate vocabulary and sentence length. Encouraging, clear, never condescending. This is the book a classroom teacher hands out for students to read, practice, and take home — NOT a teacher manual, NOT a parent guide.`,
    dialogueGuidance:
      "Short student-friendly Q&A, think-alouds in kid language, and peer-style prompts. Never address 'your child', 'parents', or 'teachers' as the reader. Optional brief teacher tips only as a short sidebar labeled for adults — default body is 100% student-facing.",
    characterVoices: [
      "Narrator/coach: speaks directly to the student as 'you'",
      "Student examples: diverse classmates solving problems at this grade level",
    ],
    narrativeBeats: opts.beats,
    themes: opts.themes ?? ["mastery", "confidence", "real-world application"],
    gradeBand: opts.gradeOrLevel,
    subjectArea: opts.subject,
    standardsFocus: opts.standardsFocus ?? [
      `US ${opts.gradeOrLevel} ${opts.subject} sequence (Common Core / state frameworks / course syllabus as applicable)`,
    ],
    learningObjectives: opts.learningObjectives,
    instructionalPattern: "objective → explain → worked example → practice → check for understanding",
  };
}

const placers: Placer[] = [];

function add(p: Placer) {
  placers.push(p);
}

// ─── Elementary K–5: 4 cores × 6 grades = 24 ───────────────────────────────
const elemSubjects = [
  { key: "ELA", label: "Reading & Writing", genre: "Textbooks" },
  { key: "Math", label: "Mathematics", genre: "Textbooks" },
  { key: "Science", label: "Science", genre: "Textbooks" },
  { key: "Social Studies", label: "Social Studies", genre: "Textbooks" },
] as const;

for (const grade of ["K", "1", "2", "3", "4", "5"] as const) {
  const gradeLabel = grade === "K" ? "Kindergarten" : `Grade ${grade}`;
  const ages =
    grade === "K"
      ? "ages 5–6"
      : grade === "1"
        ? "ages 6–7"
        : grade === "2"
          ? "ages 7–8"
          : grade === "3"
            ? "ages 8–9"
            : grade === "4"
              ? "ages 9–10"
              : "ages 10–11";
  for (const sub of elemSubjects) {
    const title = `${gradeLabel} ${sub.label}: Complete School Year`;
    add({
      band: "elementary",
      title,
      genre: sub.genre,
      topic: `Full-year ${sub.label.toLowerCase()} curriculum for ${gradeLabel} aligned to US standards expectations`,
      description: `A complete ${gradeLabel} ${sub.label.toLowerCase()} schoolbook with lessons, examples, practice, and checks for understanding.`,
      writingBrief: eduBrief({
        audience: `${gradeLabel} students (${ages}) — the learner who reads and practices from this take-home textbook (teachers assign it; parents may help, but the book speaks to the student)`,
        gradeOrLevel: gradeLabel,
        subject: sub.label,
        beats: [
          `Unit openers with clear learning goals for ${gradeLabel} ${sub.key}`,
          "Worked examples then guided practice then independent practice",
          "End-of-unit review and confidence-building assessment",
        ],
        themes: ["foundations", "practice", "growth mindset"],
      }),
    });
  }
}

// Elementary extras often required / high-demand (K–5 Health + Phonics K–2) = 6 + 3 = 9
for (const grade of ["K", "1", "2", "3", "4", "5"] as const) {
  const gradeLabel = grade === "K" ? "Kindergarten" : `Grade ${grade}`;
  add({
    band: "elementary",
    title: `${gradeLabel} Health & Wellness`,
    genre: "Education / Learning",
    topic: `Age-appropriate health, safety, nutrition, and social-emotional skills for ${gradeLabel}`,
    description: `A ${gradeLabel} health schoolbook covering body basics, safety, feelings, and healthy habits.`,
    writingBrief: eduBrief({
      audience: `${gradeLabel} students — student take-home health text (caregivers may assist; voice addresses the student)`,
      gradeOrLevel: gradeLabel,
      subject: "Health",
      beats: ["Safety & body awareness", "Feelings and friendships", "Healthy habits project"],
    }),
  });
}
for (const grade of ["K", "1", "2"] as const) {
  const gradeLabel = grade === "K" ? "Kindergarten" : `Grade ${grade}`;
  add({
    band: "elementary",
    title: `${gradeLabel} Phonics & Early Reading`,
    genre: "Workbooks",
    topic: `Systematic phonics, decoding, and early fluency for ${gradeLabel}`,
    description: `A ${gradeLabel} phonics workbook with letter-sound lessons, blending practice, and reading fluency drills.`,
    writingBrief: eduBrief({
      audience: `${gradeLabel} early readers — student phonics workbook the child uses (adults may sit nearby; text speaks to the student)`,
      gradeOrLevel: gradeLabel,
      subject: "Phonics",
      beats: ["Letter-sound mapping", "Blending & segmenting", "Decodable reading practice"],
      themes: ["literacy", "decoding", "fluency"],
    }),
  });
}

// ─── Middle school 6–8: 4 cores × 3 = 12 + Health + Coding = 18 ─────────────
for (const grade of [6, 7, 8] as const) {
  for (const sub of elemSubjects) {
    add({
      band: "middle",
      title: `Grade ${grade} ${sub.label}`,
      genre: "Textbooks",
      topic: `Standards-aligned ${sub.label.toLowerCase()} for Grade ${grade} with deeper reasoning and projects`,
      description: `A Grade ${grade} ${sub.label.toLowerCase()} textbook built for middle-school rigor and engagement.`,
      writingBrief: eduBrief({
        audience: `Grade ${grade} students (ages ${grade + 5}–${grade + 6}) — student take-home textbook teachers assign`,
        gradeOrLevel: `Grade ${grade}`,
        subject: sub.label,
        beats: [
          "Hook problem or phenomenon",
          "Concept build with models/diagrams",
          "Practice sets + real-world application project",
        ],
      }),
    });
  }
  add({
    band: "middle",
    title: `Grade ${grade} Health & Life Skills`,
    genre: "Education / Learning",
    topic: `Middle-school health, digital citizenship, and life skills for Grade ${grade}`,
    description: `A Grade ${grade} health and life-skills book for modern middle schoolers.`,
    writingBrief: eduBrief({
      audience: `Grade ${grade} students — student take-home health & life-skills text`,
      gradeOrLevel: `Grade ${grade}`,
      subject: "Health & Life Skills",
      beats: ["Physical & mental health basics", "Digital citizenship", "Decision-making scenarios"],
    }),
  });
  add({
    band: "middle",
    title: `Grade ${grade} Computer Science Foundations`,
    genre: "Textbooks",
    topic: `Intro coding, computational thinking, and digital literacy for Grade ${grade}`,
    description: `A Grade ${grade} computer science foundations textbook with unplugged + coding activities.`,
    writingBrief: eduBrief({
      audience: `Grade ${grade} beginners in CS`,
      gradeOrLevel: `Grade ${grade}`,
      subject: "Computer Science",
      beats: ["Computational thinking", "Block/text coding intro", "Mini project showcase"],
      themes: ["problem solving", "creativity", "digital literacy"],
    }),
  });
}

// ─── High school course-based (~24) ────────────────────────────────────────
const hsCourses: Array<{ title: string; subject: string; topic: string }> = [
  { title: "English 9: Literature & Composition", subject: "ELA", topic: "Freshman English — literary analysis, grammar, and essay foundations" },
  { title: "English 10: World Literature & Argument", subject: "ELA", topic: "Sophomore English — world texts, rhetoric, and research writing" },
  { title: "English 11: American Literature", subject: "ELA", topic: "Junior English — American literature survey and college-ready writing" },
  { title: "English 12: College & Career Writing", subject: "ELA", topic: "Senior English — advanced composition, rhetoric, and career communication" },
  { title: "Algebra I", subject: "Math", topic: "Linear equations, functions, inequalities, and intro to quadratic thinking" },
  { title: "Geometry", subject: "Math", topic: "Proofs, congruence, similarity, circles, and coordinate geometry" },
  { title: "Algebra II", subject: "Math", topic: "Polynomials, exponentials, logs, sequences, and advanced functions" },
  { title: "Precalculus", subject: "Math", topic: "Trigonometry, analytic geometry, and limits readiness for calculus" },
  { title: "High School Statistics", subject: "Math", topic: "Data analysis, probability, inference, and real-world statistical literacy" },
  { title: "Biology", subject: "Science", topic: "Cells, genetics, evolution, ecology — lab-ready high school biology" },
  { title: "Chemistry", subject: "Science", topic: "Atomic structure, bonding, stoich, reactions — high school chemistry" },
  { title: "Physics", subject: "Science", topic: "Mechanics, energy, waves, electricity — conceptual + problem-solving physics" },
  { title: "Earth & Environmental Science", subject: "Science", topic: "Earth systems, climate, resources, and environmental problem-solving" },
  { title: "United States History", subject: "Social Studies", topic: "US history survey from founding through modern America" },
  { title: "World History", subject: "Social Studies", topic: "Global civilizations, revolutions, and modern world connections" },
  { title: "US Government & Civics", subject: "Social Studies", topic: "Constitution, branches, rights, and civic participation" },
  { title: "Economics for High School", subject: "Social Studies", topic: "Micro/macro basics, personal finance links, and economic decision-making" },
  { title: "Spanish I", subject: "World Language", topic: "Beginner Spanish — communication, culture, and foundational grammar" },
  { title: "Spanish II", subject: "World Language", topic: "Intermediate Spanish — expanded conversation, reading, and culture" },
  { title: "High School Health", subject: "Health", topic: "Teen health, nutrition, mental wellness, relationships, and safety" },
  { title: "Computer Science Principles", subject: "CS", topic: "Algorithms, data, internet, and creative computing for high school" },
  { title: "Personal Finance for Teens", subject: "Career Ready", topic: "Budgeting, banking, credit, taxes, and smart money habits for teens" },
  { title: "Public Speaking & Debate", subject: "ELA Elective", topic: "Speech writing, delivery, argumentation, and respectful debate" },
  { title: "Psychology for High School", subject: "Elective", topic: "Intro psychology — brain, behavior, development, and mental health literacy" },
];

for (const c of hsCourses) {
  add({
    band: "high",
    title: c.title,
    genre: "Textbooks",
    topic: c.topic,
    description: `A complete high school ${c.subject.toLowerCase()} course book: lessons, worked examples, practice, and assessments.`,
    writingBrief: eduBrief({
      audience: `High school students (grades 9–12) — student course textbook teachers assign for class and homework`,
      gradeOrLevel: "High School",
      subject: c.subject,
      beats: [
        "Chapter objectives + why it matters",
        "Worked examples with common mistakes called out",
        "Practice + chapter test + project option",
      ],
      themes: ["college readiness", "career readiness", "mastery"],
    }),
  });
}

// ─── College gen-ed / high-enrollment (~20) ────────────────────────────────
const college: Array<{ title: string; subject: string; topic: string }> = [
  { title: "College Composition I", subject: "Writing", topic: "Academic essays, research basics, rhetoric, and revision for first-year college" },
  { title: "College Composition II", subject: "Writing", topic: "Research writing, argumentation, source synthesis, and documentation" },
  { title: "College Algebra", subject: "Math", topic: "Functions, equations, modeling — gateway college algebra" },
  { title: "Calculus I", subject: "Math", topic: "Limits, derivatives, applications — first-semester calculus" },
  { title: "Introductory Statistics", subject: "Math", topic: "Descriptive stats, probability, confidence intervals, hypothesis tests" },
  { title: "Introduction to Psychology", subject: "Social Science", topic: "Survey of psychology for college gen-ed" },
  { title: "Introduction to Sociology", subject: "Social Science", topic: "Society, culture, inequality, and research methods intro" },
  { title: "General Biology I", subject: "Science", topic: "Cell biology, genetics, and organismal foundations for majors/non-majors" },
  { title: "General Chemistry I", subject: "Science", topic: "Atoms, bonding, reactions, and quantitative chemistry foundations" },
  { title: "College Physics I", subject: "Science", topic: "Mechanics and energy for algebra-based college physics" },
  { title: "American History Survey", subject: "History", topic: "College US history survey with primary-source practice" },
  { title: "Microeconomics", subject: "Business", topic: "Supply/demand, markets, elasticity, and firm behavior" },
  { title: "Macroeconomics", subject: "Business", topic: "GDP, inflation, unemployment, fiscal and monetary policy" },
  { title: "Introduction to Business", subject: "Business", topic: "Business functions, entrepreneurship basics, and workplace skills" },
  { title: "Financial Accounting Fundamentals", subject: "Business", topic: "Accounting cycle, statements, and decision usefulness" },
  { title: "Introduction to Programming", subject: "CS", topic: "First programming course — variables, control flow, functions, debugging" },
  { title: "Public Speaking for College", subject: "Communication", topic: "Informative/persuasive speaking, visuals, and audience analysis" },
  { title: "College Success & Study Skills", subject: "Student Success", topic: "Time management, note-taking, exam prep, and campus navigation" },
  { title: "Critical Thinking & Logic", subject: "Philosophy", topic: "Arguments, fallacies, evidence, and clear reasoning" },
  { title: "Human Anatomy & Physiology I", subject: "Health Science", topic: "Body systems foundations for nursing and allied-health pathways" },
];

for (const c of college) {
  add({
    band: "college",
    title: c.title,
    genre: "Textbooks",
    topic: c.topic,
    description: `A college-ready ${c.subject.toLowerCase()} textbook with clear explanations, examples, and practice — built for first-year success.`,
    writingBrief: eduBrief({
      audience: `College students, adult learners, community college & university gen-ed`,
      gradeOrLevel: "College / University",
      subject: c.subject,
      beats: [
        "Learning outcomes mapped to chapter sections",
        "Worked problems + 'try it' checkpoints",
        "Chapter summary, key terms, practice set",
      ],
      themes: ["rigor with clarity", "transferable skills", "exam readiness"],
    }),
  });
}

// ─── Trade & careers (~22) ─────────────────────────────────────────────────
const trade: Array<{ title: string; subject: string; topic: string; genre?: string }> = [
  { title: "HVAC Fundamentals", subject: "Skilled Trades", topic: "Heating, ventilation, and air conditioning basics for entry-level techs" },
  { title: "Residential Electrical Wiring Basics", subject: "Skilled Trades", topic: "Safe residential wiring concepts, tools, codes awareness, and practice scenarios" },
  { title: "Plumbing Fundamentals", subject: "Skilled Trades", topic: "Plumbing systems, fixtures, troubleshooting, and jobsite safety" },
  { title: "Automotive Fundamentals", subject: "Skilled Trades", topic: "Engines, systems, diagnostics intro for auto tech beginners" },
  { title: "Welding Basics", subject: "Skilled Trades", topic: "Welding processes, safety, joints, and beginner practice projects" },
  { title: "CNC & Manufacturing Intro", subject: "Manufacturing", topic: "Shop safety, blueprints, CNC concepts, and quality basics" },
  { title: "Construction Safety Essentials", subject: "Construction", topic: "Jobsite hazards, PPE, and safety culture for new construction workers" },
  { title: "Medical Assisting Fundamentals", subject: "Allied Health", topic: "Clinical and admin basics for medical assisting career starters" },
  { title: "CNA Patient Care Basics", subject: "Allied Health", topic: "Nurse aide skills, dignity in care, vitals, and daily living support" },
  { title: "Pharmacy Technician Essentials", subject: "Allied Health", topic: "Pharmacy operations, safety, and exam-oriented foundations" },
  { title: "Dental Assisting Basics", subject: "Allied Health", topic: "Chairside assisting, infection control, and dental office workflow" },
  { title: "Cosmetology Fundamentals", subject: "Personal Services", topic: "Hair, skin, nails foundations and professional salon standards" },
  { title: "Culinary Arts Foundations", subject: "Hospitality", topic: "Knife skills, sanitation, stocks/sauces, and kitchen brigade basics" },
  { title: "CDL Exam Prep Essentials", subject: "Transportation", topic: "Commercial driving knowledge domains and study strategies for CDL" },
  { title: "IT Support Career Starter", subject: "Technology", topic: "Help-desk skills, hardware/software troubleshooting, and customer service" },
  { title: "Cybersecurity Fundamentals", subject: "Technology", topic: "Threats, defenses, networking basics, and security career pathways" },
  { title: "Digital Marketing Career Starter", subject: "Business Careers", topic: "SEO, social, email, analytics — practical marketing for job seekers" },
  { title: "Project Management Foundations", subject: "Business Careers", topic: "Scope, schedule, risk, stakeholders — PMI-aligned fundamentals without trademarked exam dumps" },
  { title: "Entrepreneurship & Small Business Launch", subject: "Business Careers", topic: "Idea validation, lean planning, money basics, and first customers" },
  { title: "Real Estate License Prep Essentials", subject: "Licensure", topic: "Property, contracts, finance, and ethics foundations for license study" },
  { title: "Bookkeeping for Small Business", subject: "Business Careers", topic: "Day-to-day bookkeeping, invoices, payroll basics, and clean records" },
  { title: "Solar & Renewable Energy Tech Intro", subject: "Green Jobs", topic: "Solar systems overview, safety, and entry pathways into renewables" },
];

for (const c of trade) {
  add({
    band: "trade",
    title: c.title,
    genre: c.genre || "Education / Learning",
    topic: c.topic,
    description: `A career-ready training book for ${c.subject.toLowerCase()}: safety-first, step-by-step, job-focused.`,
    writingBrief: eduBrief({
      audience: `Career changers, trade students, apprentices, adult learners`,
      gradeOrLevel: "Trade / Career Training",
      subject: c.subject,
      beats: [
        "Safety & tools first",
        "Step-by-step procedures with checklists",
        "Job-site scenarios + skills checklist for hiring readiness",
      ],
      themes: ["employability", "safety", "hands-on competence"],
    }),
  });
}

// ─── Summary + seed ────────────────────────────────────────────────────────
const byBand = {
  elementary: placers.filter((p) => p.band === "elementary").length,
  middle: placers.filter((p) => p.band === "middle").length,
  high: placers.filter((p) => p.band === "high").length,
  college: placers.filter((p) => p.band === "college").length,
  trade: placers.filter((p) => p.band === "trade").length,
};

console.log(`
=== SCHOOLBOOKS CATALOG RESEARCH → COVER REVIEW PLACERS ===

Quality models studied (US):
  • K–12: Common Core ELA/Math expectations + typical state science/social studies sequences
  • Market leaders: McGraw Hill, Pearson, Houghton Mifflin Harcourt (clarity, examples, practice)
  • College: high-enrollment gen-ed / gateway courses
  • Trade: high-demand skilled trades + allied health + tech careers

Catalog counts:
  Elementary (K–5 cores + health + phonics K–2): ${byBand.elementary}
  Middle (6–8 cores + health + CS):               ${byBand.middle}
  High school (course-based):                     ${byBand.high}
  College (gen-ed / gateway):                     ${byBand.college}
  Trade & careers:                                ${byBand.trade}
  ─────────────────────────────────────────────
  TOTAL PLACERS:                                  ${placers.length}

These are COVER-FIRST placers only — no content generation, no API writing spend.
Generate covers in Cover Review when budget allows; content later.
`);

if (dryRun) {
  console.log("DRY RUN — titles only:\n");
  for (const p of placers) {
    console.log(`  [${p.band}] ${p.title} (${p.genre})`);
  }
  console.log(`\n${placers.length} placers would be created.`);
  process.exit(0);
}

const result = await bulkCreateTitlePlacers(
  placers.map((p) => ({
    title: p.title,
    genre: p.genre,
    topic: p.topic,
    description: `[Schoolbooks Catalog · ${p.band}] ${p.description}`,
    writingBrief: p.writingBrief,
    source: "trending" as const,
  })),
);

console.log(`\nCreated: ${result.createdDraftIds.length} placers`);
console.log(`Skipped duplicates: ${result.skippedDuplicates}`);
if (result.createdDraftIds.length) {
  console.log(`Draft ID range: #${result.createdDraftIds[0]} … #${result.createdDraftIds[result.createdDraftIds.length - 1]}`);
  console.log(`IDs: ${result.createdDraftIds.join(", ")}`);
}
console.log("\nNext: open Cover Review, filter/search Schoolbooks titles, generate covers when you have budget.");
