import {
  OUTREACH,
  outreachSignature,
  learnforgeGamesUrl,
  ebookgamezCatalogUrl,
  ebookgamezGamesUrl,
} from "./outreach-constants";

export type OutreachTemplate = {
  id: string;
  org: string;
  where: string;
  subject: string;
  body: (origin: string) => string;
};

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "score",
    org: "SCORE",
    where: "https://www.score.org/ → Find a Mentor",
    subject: "Mentorship request — EbookGamez + LearnForge (free edtech)",
    body: (origin) => `Hello,

I'm ${OUTREACH.name}, founder of EbookGamez.com and LearnForge. We offer 600+ digital ebooks, free browser games, and in-app learning tools (career games, practice exams) — all built in-house with free access for learners.

I'm not looking for paid advertising. I'd like guidance on:
- Reaching readers, homeschool families, and career-changers with zero ongoing marketing cost
- Whether our free tools fit SCORE resource listings or workshops
- A sensible growth plan for a bootstrap edtech/content business

Links:
- EbookGamez catalog: ${ebookgamezCatalogUrl(origin)}
- Free games: ${ebookgamezGamesUrl(origin)}
- LearnForge games: ${learnforgeGamesUrl()}

Thank you,

${outreachSignature()}`,
  },
  {
    id: "sbdc",
    org: "SBDC",
    where: "https://www.sba.gov/local-assistance/find/?type=Small%20Business%20Development%20Center",
    subject: "Free counseling request — digital library & learning platform",
    body: (origin) => `Hello,

I'm ${OUTREACH.name}. I run EbookGamez.com (ebooks + free browser games) and LearnForge (career skill games + AI practice exams). Everything is bootstrap-built; we're focused on free access for learners.

I'd like a free SBDC session to discuss local/online channels, workforce positioning, and community referral programs.

${outreachSignature()}

EbookGamez: ${ebookgamezCatalogUrl(origin)}
LearnForge: ${learnforgeGamesUrl()}`,
  },
  {
    id: "helpful-marketing",
    org: "Helpful Marketing",
    where: "https://helpfulmarketing.org/",
    subject: "Application — pro bono marketing for free edtech & digital library",
    body: (origin) => `Hello Helpful Marketing team,

I'm ${OUTREACH.name}, applying for pro bono support for EbookGamez and LearnForge — free ebooks, browser games, and learning tools for students and career-changers.

We need help with SEO, social strategy, and reaching homeschool audiences without paid ad spend.

- EbookGamez: ${ebookgamezCatalogUrl(origin)}
- LearnForge: ${learnforgeGamesUrl()}

Thank you,

${outreachSignature()}`,
  },
  {
    id: "braven",
    org: "Braven Foundation",
    where: "https://bravenfoundation.com/ (California)",
    subject: "Digital Communities Program — ebooks & educational games",
    body: (origin) => `Hello,

I'm ${OUTREACH.name}, a California small business owner building EbookGamez.com and LearnForge — digital books, free games, and practice tools for students and career-changers.

I'd like to learn if we qualify for the Digital Communities Program.

${outreachSignature()}

EbookGamez: ${OUTREACH.ebookgamezUrl}
LearnForge: ${learnforgeGamesUrl()}`,
  },
  {
    id: "volta",
    org: "Volta NYC",
    where: "https://voltanyc.org/partners (NYC only)",
    subject: "Partner application — NYC edtech / digital content",
    body: (origin) => `Hello Volta NYC,

I'm ${OUTREACH.name}, running EbookGamez.com and LearnForge — ebooks, free games, and learning tools. I'm looking for free help with social content and outreach strategy.

${outreachSignature()}

EbookGamez: ${ebookgamezCatalogUrl(origin)}`,
  },
];
