// Find what "Cosmic Dread" was renamed to on production
// by checking TITLE_REPAIR metadata in book descriptions
const liveRes = await fetch('https://EbookGamez.replit.app/api/books?limit=2000');
const liveData = await liveRes.json() as any;
const liveBooks: any[] = Array.isArray(liveData) ? liveData : (liveData.books ?? []);

// Check every book's description for TITLE_REPAIR metadata mentioning old names
// Also check all books for any mention of "cosmic" or "dread" or "dark side"
const renamed: any[] = [];
for (const b of liveBooks) {
  const desc = (b.description || '').toLowerCase();
  if (desc.includes('cosmic dread') || desc.includes('previoustitle') || desc.includes('title_repair')) {
    renamed.push(b);
  }
}

console.log('Books with TITLE_REPAIR or "cosmic dread" in description:');
for (const b of renamed) {
  console.log(`\n  Book #${b.id} "${b.title}"`);
  console.log(`  Description: ${b.description?.slice(0, 300)}`);
}

// The 12 slots that got replaced — fetch each one's full description
const replacedIds = [8, 15, 17, 19, 20, 35, 74, 104, 156, 169, 173, 589];
const byId = new Map(liveBooks.map(b => [b.id, b]));

console.log('\n\nAll 12 replaced book slots — full descriptions:');
for (const id of replacedIds) {
  const b = byId.get(id);
  if (!b) { console.log(`  #${id} — NOT FOUND`); continue; }
  console.log(`\n  Book #${b.id} "${b.title}"`);
  if (b.description) console.log(`  Desc: ${b.description.slice(0, 400)}`);
}

process.exit(0);
