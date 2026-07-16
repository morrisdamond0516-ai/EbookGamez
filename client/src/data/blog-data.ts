export type BlogSection = {
  heading: string;
  body: string;
};

export type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  category: string;
  readMinutes: number;
  sections: BlogSection[];
  relatedHref?: string;
};

export const BLOG_CATEGORIES = [
  "All",
  "Founder",
  "Quality",
  "Reading",
  "Education",
  "Standards",
] as const;

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "why-ebookgamez-exists",
    title: "Why EbookGamez Exists: Building a Digital Library from Las Vegas",
    excerpt:
      "EbookGamez is not a random catalog dump. It started as a practical answer to a simple problem: readers want affordable books they can actually own, and families want learning materials that do not feel like disposable worksheets.",
    author: "Damond Morris",
    publishedAt: "2026-07-12",
    category: "Founder",
    readMinutes: 9,
    relatedHref: "/about",
    sections: [
      {
        heading: "A library you can use, not just browse",
        body: `I built EbookGamez in Las Vegas because I wanted a place where digital books felt like something you keep — not a temporary stream that disappears when a subscription lapses or a platform changes its rules.

Most ebook stores optimize for endless scrolling. That works for discovery, but it rarely answers the questions that matter when you are deciding whether to spend money: Who stands behind this catalog? What happens after I buy? Can I download the file and keep it? If something goes wrong, can I reach a real person?

EbookGamez is my attempt to answer those questions in public. We sell full-length ebooks across fiction, nonfiction, education, and classics. We also host free browser games, verified download links for major titles, and gaming guides — because the people who use this site are not only “book shoppers.” They are families, students, and players who live online and want one honest hub instead of five half-finished tabs.`,
      },
      {
        heading: "What “indie digital publisher” means here",
        body: `I am Damond Morris. EbookGamez is based in Las Vegas, Nevada (P.O. Box 1181, Las Vegas, NV 89125). Support email is ebookgames@yahoo.com. Those details are not marketing flourishes — they are how you reach the person responsible for the storefront.

Indie does not mean “no standards.” It means I own the tradeoffs. When we add a schoolbook series, a thriller, or a planner, the decision is not hidden behind an anonymous corporate brand. When a reader asks about a refund, a missing download, or a Reading Pass credit, the path ends with a human workflow — not a dead chatbot loop.

We use AI-assisted writing and illustration tools to produce books at a pace a one-person operation could never match by hand alone. We also disclose that openly. Assistance is not the same as “publish anything that generates.” Every title that reaches Ready or Published still has to clear cover, structure, and quality checks before it sits next to paid catalog books.`,
      },
      {
        heading: "Why games and guides sit next to books",
        body: `Readers asked for more than PDFs. Some wanted a five-minute break between chapters. Some wanted official installers without hunting sketchy mirrors. Some wanted practical tips for the games their kids already play.

So EbookGamez grew into a hub: ebook store, free HTML5 games, download links that point to official sources, and guides. That mix can look busy from the outside. From the inside, it is one promise — useful digital entertainment without bait-and-switch downloads or locked files you cannot keep.

If you only want books, start in the catalog. If you only want a free game, use the games hub. The blog exists so the “why” behind the hub is readable without buying anything.`,
      },
      {
        heading: "What success looks like for this site",
        body: `Success is not “more titles at any cost.” Success is a reader finishing a book they felt good purchasing, a parent finding a school-year textbook that matches how they actually teach at the kitchen table, and a visitor trusting that the About page names a real founder in a real city.

That is why we publish process essays here: quality gates, DRM-free ownership, Reading Pass honesty, schoolbook design, and AI disclosure. Storefronts without a voice look like content farms. A storefront with a named operator, public standards, and free articles you can evaluate before you buy is something different — and that difference is the point of EbookGamez.`,
      },
    ],
  },
  {
    id: "how-we-quality-check-books",
    title: "How We Quality-Check Books Before They Reach “Ready”",
    excerpt:
      "A book does not go from idea to storefront in one click. Here is the cover-first, outline-driven, gate-checked path EbookGamez uses before a title can be marked ready to publish.",
    author: "Damond Morris",
    publishedAt: "2026-07-12",
    category: "Quality",
    readMinutes: 11,
    relatedHref: "/catalog",
    sections: [
      {
        heading: "Cover first — the visual promise comes before the prose",
        body: `We do not write a full manuscript and then “find a cover later.” For story and educational titles, a publishable cover is required before chapter writing proceeds. That sounds strict until you remember what a cover is for: it is the contract with the reader. If the cover promises a kindergarten classroom and the outline delivers a college lecture, the book has already failed — even if the sentences are clean.

Cover review is where we lock style, title treatment, and the imagery that later chapters and illustrations must respect. When cover and outline disagree, we fix the mismatch before spending more time on chapters.`,
      },
      {
        heading: "Outline as blueprint, not a vague sketch",
        body: `After cover, we build a detailed outline: hooks or learning objectives, chapter sequence, and — for illustrated genres — explicit [ILLUSTRATION:] slots that describe what the reader should see.

For fiction, that means character arcs, stakes, and a climax worth earning. For textbooks and education titles, that means objectives, worked examples, practice, and checks for understanding — the same pillars school and library reviewers look for in instructional materials.

The outline is not decorative. Illustration placement, chapter writing, and later quality gates all read from it. If the outline is weak, regenerating chapters will not save the book.`,
      },
      {
        heading: "Editorial brief and Story Architect before full drafting",
        body: `Fiction outlines are scored before prose. If the brief fails, we revise the outline instead of “writing harder.” Educational books get an instructional editorial pass focused on grade fit, pedagogy, and teachable sequence — not a fake climax score meant for novels.

Story Architect (and our instructional author techniques for textbooks) then assign craft approaches per chapter so the manuscript is not a flat wall of summary. That step exists because long books fail quietly: every chapter starts the same way, or every lesson forgets practice.`,
      },
      {
        heading: "Structural gate, then stricter checks",
        body: `When chapters exist, we run structural checks first: word count floors, missing chapters, placeholders, truncated endings, duplicate chapter headers, and illustration requirements for visual genres.

Only after the book is structurally whole do we invest in deeper dialogue/prose review (fiction) or instructional materials review (education). Strict mode also re-checks cover presence, illustration resolution, and genre-appropriate quality. A book that fails stays draft. It does not get a quiet “ready” badge to clear a queue.

That is why some titles take longer than others. Speed without the gate produces a catalog nobody should trust — including us.`,
      },
      {
        heading: "What “ready” actually means",
        body: `Ready means the current pipeline gate passed for that title’s genre. It does not mean the book is perfect literature, and it does not mean every reader will love it. It means we refused to publish a stub, a cover-less file, or an illustrated textbook with zero figures.

Published is a separate step: catalog visibility, pricing, and storefront presence. Ready is the honesty checkpoint. If you ever wonder why a title is still in draft after a long write, the usual answer is the gate — and that is intentional.`,
      },
    ],
  },
  {
    id: "drm-free-ebooks-ownership",
    title: "DRM-Free Ebooks: What “You Own It” Means on EbookGamez",
    excerpt:
      "We sell downloads you can keep. Here is what DRM-free means in practice, what it does not mean, and why ownership still matters in a streaming-first world.",
    author: "Damond Morris",
    publishedAt: "2026-07-12",
    category: "Reading",
    readMinutes: 8,
    relatedHref: "/catalog",
    sections: [
      {
        heading: "The problem with rented reading",
        body: `A lot of digital reading today is licensed access. That can be convenient. It can also mean your library shrinks when a deal ends, a device ecosystem changes, or an account gets locked.

I wanted EbookGamez purchases to feel closer to buying a paperback: you paid, you received a file, you can read it offline, and you are not begging a platform for permission every year. That is why downloads here are DRM-free PDF deliveries for purchased titles.`,
      },
      {
        heading: "What you get when you buy a download",
        body: `When you choose download or bundle pricing, you receive a digital file you can store on your own devices. There is no artificial expiry baked into the file for normal purchased downloads. You can back it up. You can move it to a tablet or computer you control.

Online reading is a separate convenience path — useful on shared devices or when you do not want another file to manage. Reading Pass adds unlimited online reading with monthly download credits. Different products, different jobs. Ownership lives in the download.`,
      },
      {
        heading: "What DRM-free does not mean",
        body: `DRM-free does not mean “no copyright” or “redistribute this book as your own product.” Authors, public-domain status, and store terms still apply. You own your copy for personal reading and archiving the way you would own a physical book you bought — not a license to republish the catalog.

It also does not mean we ignore abuse. Refunds, chargebacks, and account issues are still handled like any real store. Freedom to keep a file is not freedom to treat the storefront as a free warehouse.`,
      },
      {
        heading: "Why this matters for families and students",
        body: `Schoolbooks and workbooks are especially painful when locked behind apps that stop working mid-semester. A parent who downloads a kindergarten year text should be able to open it during a road trip with spotty Wi‑Fi. A student who buys a study guide should not lose it because a subscription lapsed during finals week.

DRM-free is not a slogan for us. It is the practical answer to those moments. If you only need temporary online access, use the reader or Reading Pass. If you want the book on your shelf — digital shelf included — buy the download.`,
      },
    ],
  },
  {
    id: "reading-pass-explained-honestly",
    title: "Reading Pass Explained Honestly: Who It Is For (and Who Should Skip It)",
    excerpt:
      "Subscriptions are easy to oversell. Here is a plain-language guide to EbookGamez Reading Pass — when it saves money, when a single purchase is smarter, and how credits actually work.",
    author: "Damond Morris",
    publishedAt: "2026-07-12",
    category: "Reading",
    readMinutes: 9,
    relatedHref: "/subscription",
    sections: [
      {
        heading: "What Reading Pass is",
        body: `Reading Pass is our monthly (or annual) subscription for unlimited online reading across the library, plus a monthly allotment of download credits depending on the tier. Tiers range from lighter plans for casual readers up through VIP for heavy downloaders. Annual billing discounts the monthly rate. The Value plan includes a free trial window so you can test the habit before you commit.

Unlimited online reading means you can open catalog titles in our browser reader without buying each one individually. Download credits are for the keep-forever files. Unused credits roll over within the plan’s cap rules — they are not a blank check to stockpile forever without limit.`,
      },
      {
        heading: "Who Reading Pass is for",
        body: `Choose Reading Pass if you read several books a month online, sample widely across genres, or want a predictable monthly cost instead of deciding purchase-by-purchase.

It is also a fit for households that share a reading habit on tablets and laptops — open a book, finish it, start another — without downloading every title to every device.

If you are exploring educational titles or fiction series and you are not sure which ones stick, unlimited online reading reduces the fear of wasting a one-off purchase.`,
      },
      {
        heading: "Who should buy single titles instead",
        body: `Skip the subscription if you only want one or two specific books this year. Buying those downloads outright is usually simpler and cheaper than paying months of Pass fees.

Also skip it if your entire goal is offline archives. Pass is strongest for online reading; downloads are credit-limited by design. A collector who wants twenty permanent PDFs this month should compare credit math carefully — a bundle of individual purchases may be the better path.

Students buying one textbook for a class should usually buy that book, not a Pass, unless they will also read heavily in the wider catalog.`,
      },
      {
        heading: "How we try to stay honest about subscriptions",
        body: `We cancel without contract punishment. You keep access through the end of the paid period. Refunds on purchases follow our published refund policy. We do not hide the AI-assisted nature of much of the catalog.

A subscription should feel like a tool, not a trap. If Pass stops matching how you read, cancel and buy singles. If singles feel noisy because you read constantly, Pass is there. The right answer is the one that matches your actual behavior — not the one that sounds best in an ad.`,
      },
    ],
  },
  {
    id: "kindergarten-complete-school-year-at-home",
    title: "Using a “Complete School Year” Kindergarten Textbook at Home",
    excerpt:
      "A practical parent and caregiver guide to pacing a year-long kindergarten reading, math, science, or social studies text without turning your kitchen into a miniature public school.",
    author: "Damond Morris",
    publishedAt: "2026-07-12",
    category: "Education",
    readMinutes: 12,
    relatedHref: "/catalog",
    sections: [
      {
        heading: "What “complete school year” is trying to mean",
        body: `Our kindergarten titles are built as sequenced courses — not random activity packets. A complete school year text aims to walk a child through a coherent progression: routines and print concepts before heavier phonics loads; counting and number sense before rushing symbols; science practices before memorizing trivia; social studies habits before abstract civics.

That does not replace a licensed teacher, an IEP, or your school’s adopted curriculum. It is a structured companion for home learning days, summer bridges, tutoring, or co-op settings where adults want a spine instead of a pile of printables.`,
      },
      {
        heading: "A simple weekly rhythm that survives real life",
        body: `Most families cannot run a perfect five-day academic schedule. Aim for four short sessions a week, 15–25 minutes each, with one flexible catch-up day.

Use the book’s lesson shape when it is present: teach or read aloud → model → guided practice → independent try → quick check. If a chapter spans multiple days, that is normal. Kindergarten stamina is short. Stopping while the child is still successful beats finishing a chapter while everyone is frustrated.

Keep materials boring and ready: pencil, crayons, a pointer finger for tracking print, and a small tray of counting objects. Fancy setups die by Wednesday.`,
      },
      {
        heading: "How to use illustrations and worked examples",
        body: `Textbook illustrations are not decoration. Pause on diagrams. Ask: What do you notice? What stayed the same? What changed? Have the child point to labels.

Worked examples are for modeling out loud. Read the example the way a coach would: “Watch how I tap each sound… now you try the next one.” Then move to practice items. If practice is hard, return to the example instead of pushing forward for the sake of the schedule.

Checks for understanding should be low-stress. A wrong answer is information, not a verdict on the child. Note what to reteach tomorrow.`,
      },
      {
        heading: "Pacing by subject without panic",
        body: `Reading & writing: protect phonemic awareness and print tracking early. Do not skip handwriting posture because it feels “not academic.”

Math: prioritize number sense and ten-frames over racing into worksheets that look impressive on Instagram.

Science: favor observe → wonder → try → tell. A short notebook entry beats a perfect poster.

Social studies: practice classroom and community habits — taking turns, same/different, fair shares — before big abstract units.

If you fall behind the “year” calendar, shorten practice sets before you skip concept chapters. Sequence matters more than date labels.`,
      },
      {
        heading: "When to get extra help",
        body: `If a child cannot hear rhymes or initial sounds after patient practice, or number sense is not budding after weeks of concrete objects, talk with a teacher, pediatrician, or reading specialist. A home textbook is a tool. It is not a diagnostic replacement.

Celebrate small wins in public: “You tracked every word with your finger today.” Kindergarten progress is often invisible until it suddenly is not. Your job is consistency and kindness — the book’s job is sequence and practice.`,
      },
    ],
  },
  {
    id: "schoolbooks-catalog-not-pdf-dumps",
    title: "What Makes Our Schoolbooks Catalog Different from Random PDF Dumps",
    excerpt:
      "Anyone can upload a PDF labeled “Grade 2 Math.” Here is how EbookGamez schoolbooks are designed as course spines — with covers, outlines, pedagogy checks, and interior figures that belong to the lesson.",
    author: "Damond Morris",
    publishedAt: "2026-07-12",
    category: "Education",
    readMinutes: 10,
    relatedHref: "/catalog",
    sections: [
      {
        heading: "The PDF dump problem",
        body: `Search results are full of “complete worksheets” bundles with mismatched fonts, no scope-and-sequence, and covers that have nothing to do with the interior. Some are helpful. Many are noise. Parents and tutors waste hours discovering that Chapter 1 assumes skills Chapter 7 finally teaches.

EbookGamez schoolbooks are built as placers first — researched titles with writing briefs — then covers, then outlines with learning objectives, then chapters, then illustrations tied to those outlines. The point is a teachable path, not a ZIP file of pages.`,
      },
      {
        heading: "Standards-shaped, not standards-washed",
        body: `We design educational books against practical adoption pillars: clarity of objectives, grade-appropriate language, accurate content, pedagogy that moves from example to practice to check, and suitability for the claimed audience.

That does not mean we claim state adoption status or district procurement approval. It means we refuse to ship a “textbook” that is only motivational prose with a chalkboard cover. If it is labeled Kindergarten Mathematics, the interior should teach kindergarten mathematics.`,
      },
      {
        heading: "Illustration as instruction",
        body: `In our Textbooks genre, interior figures are required — diagrams, charts, posters, worked-example visuals — placed from outline slots so images match the lesson they support.

That is expensive and slower than text-only PDFs. It is also the difference between a book a child can point at and a wall of paragraphs pretending to be elementary curriculum.

When illustration placement fails quality checks, the book stays draft. We would rather delay a title than publish a “visual textbook” with no visuals.`,
      },
      {
        heading: "How to choose a title from the catalog",
        body: `Match grade and subject first. Read the description for the schoolbooks catalog tag and the year’s promise. Skim the sample or reader preview when available. Prefer a coherent series spine over mixing random workbooks from unrelated styles.

If you need printable puzzles and mazes, look at activity/workbook genres. If you need a year-long teachable course, pick the Complete School Year textbook line. Different tools. Different jobs.`,
      },
      {
        heading: "What we will keep improving",
        body: `Education catalogs must earn trust repeatedly. We will keep tightening outlines, illustration coverage, and instructional review. We will keep saying clearly when AI assistance is involved. And we will keep treating schoolbooks as products that should survive a skeptical parent asking, “Can I actually teach from this on Monday?”`,
      },
    ],
  },
  {
    id: "ai-assistance-and-human-review",
    title: "How We Use AI Assistance — and What Human Review Still Means",
    excerpt:
      "EbookGamez discloses AI-assisted book creation. Here is what the tools do, what they do not do, and where human judgment still decides whether a title ships.",
    author: "Damond Morris",
    publishedAt: "2026-07-12",
    category: "Standards",
    readMinutes: 10,
    relatedHref: "/about",
    sections: [
      {
        heading: "Disclosure without hand-waving",
        body: `Ebook text, covers, and many interior illustrations on EbookGamez are created with AI assistance and reviewed before publication. We print that on the site because hiding it would be disrespectful to readers and dishonest to partners.

AI assistance means models help draft prose, propose outlines, and generate imagery from detailed prompts. It does not mean “no one looked.” It also does not mean every sentence is hand-typed by a traditionally contracted novelist.`,
      },
      {
        heading: "Where the tools help",
        body: `Tools help us explore structure quickly, maintain chapter volume, generate diagram concepts for educational books, and produce cover directions across many genres. For a small operation, that is the difference between a handful of titles and a real catalog.

They also help with consistency tasks: character look locks for illustrated fiction, illustration markers from outlines, and repetitive formatting that humans hate doing at scale.`,
      },
      {
        heading: "Where humans (and hard gates) still decide",
        body: `Humans set the product rules: cover-first writing, outline quality thresholds, illustration requirements, refusal to mark failed books as ready, refund policies, and what genres belong on the storefront.

Automated and semi-automated gates enforce those rules: missing covers, thin chapters, zero illustrations on visual genres, broken pedagogy signals on educational books. When a gate fails, the title does not quietly become “good enough for ads.” It stays draft until fixed.

I still own the catalog decisions — what series to seed, what to repair, what to withhold from publish, and how we talk about the work in public.`,
      },
      {
        heading: "How to read AI-assisted books as a customer",
        body: `Judge them the way you judge any ebook: Is the writing coherent? Does the educational book teach? Does the story earn its ending? Does the file open? Can you get support if something breaks?

AI origin is context, not a free pass and not an automatic disqualification. Plenty of human-written web content is thin. Plenty of assisted books are carefully gated. Your reading experience is the test that matters — which is why we invest in previews, quality checks, and a refund window rather than slogans.`,
      },
      {
        heading: "What we will not do",
        body: `We will not pretend the catalog is entirely handcrafted nineteenth-century authorship. We will not remove disclosure to look “safer” for advertising networks. We will not treat volume as a substitute for gates.

If that honesty costs us a shortcut, so be it. Long-term trust is the only asset a Las Vegas indie storefront actually has.`,
      },
    ],
  },
  {
    id: "catalog-without-content-farm",
    title: "Building a Catalog Without Becoming a Content Farm",
    excerpt:
      "Scale is tempting. Farms are easy to smell. Here are the editorial standards EbookGamez uses to grow a catalog without turning the storefront into disposable sludge.",
    author: "Damond Morris",
    publishedAt: "2026-07-12",
    category: "Standards",
    readMinutes: 9,
    relatedHref: "/blog",
    sections: [
      {
        heading: "What a content farm looks like",
        body: `A content farm optimizes for page count and keyword coverage. Titles are interchangeable. Pages exist to host ads. There is no named operator, no process essay, no refund seriousness, and no willingness to leave a broken draft unpublished.

Farms can include books, listicles, or “guides” that restate the same internet advice with new headings. Readers feel it even when they cannot name it: nothing is sticky, nothing is owned, nothing is accountable.`,
      },
      {
        heading: "Our anti-farm rules",
        body: `1. Named founder and contact path on the site.
2. Cover-first and outline-driven production for serious titles.
3. Genre-specific quality gates that can fail a book.
4. Illustration requirements when we claim a visual or textbook product.
5. Public AI disclosure instead of stealth generation.
6. Free articles (this blog) that explain process without requiring a purchase.
7. DRM-free downloads for purchased files so the relationship is not pure lock-in.

Rules do not make us perfect. They make us falsifiable. You can catch us when we miss — and we can fix the miss without renaming the company.`,
      },
      {
        heading: "Growth that still respects the reader",
        body: `We seed researched placers (including schoolbooks) so the roadmap is intentional. We generate in batches when quality systems are ready — not because a dashboard demands vanity metrics overnight.

When books fail gates, they wait. When covers letterbox or illustrations prune incorrectly, we repair the pipeline. That work is invisible on a marketing homepage and essential if you want a catalog that survives scrutiny from parents, partners, and ad networks alike.`,
      },
      {
        heading: "How you can hold us to it",
        body: `Read the About page. Read these essays. Sample books. Email ebookgames@yahoo.com when something is wrong. Cancel Reading Pass if it is not serving you. Buy singles when that is smarter.

A storefront that invites that behavior is not a farm. A farm hopes you never look up from the feed. We hope you look carefully — then decide whether EbookGamez deserves a place on your shelf.`,
      },
    ],
  },
];

export function getBlogPost(id: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.id === id);
}

export function getRelatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.id !== post.id && p.category === post.category).slice(0, limit);
}
