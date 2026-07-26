#!/usr/bin/env bash
# ============================================================
# sync-from-production.sh
# Sync books AND draft content from the live site into dev.
#
# Usage:
#   bash scripts/sync-from-production.sh          # full sync
#   bash scripts/sync-from-production.sh --books  # books metadata only
#   bash scripts/sync-from-production.sh --drafts # draft content only
# ============================================================
set -euo pipefail

MODE="${1:-}"
DO_BOOKS=true
DO_DRAFTS=true
[[ "$MODE" == "--books"  ]] && DO_DRAFTS=false
[[ "$MODE" == "--drafts" ]] && DO_BOOKS=false

LIVE="https://EbookGamez.replit.app"

echo "=== EbookGamez: Sync from Production ==="
echo ""

# ── 1. Authenticate ──────────────────────────────────────────
echo "Authenticating with live site..."
LIVE_TOKEN=$(curl -s -X POST "$LIVE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$ADMIN_PASSWORD\"}" \
  | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')

if [ -z "$LIVE_TOKEN" ]; then
  echo "ERROR: Could not authenticate with live site. Is ADMIN_PASSWORD set?"
  exit 1
fi
echo "Authenticated."
echo ""

# ── 2. Sync book metadata ─────────────────────────────────────
if $DO_BOOKS; then
  echo "--- Step 1: Syncing book metadata ---"

  curl -s "$LIVE/api/books?limit=1000" \
    | grep -o '"id":[0-9]*' | sed 's/"id"://' | sort -n > /tmp/live_ids.txt

  psql "$DATABASE_URL" -c "SELECT id FROM books ORDER BY id;" -t \
    | tr -d ' ' | grep -v '^$' | sort -n > /tmp/local_ids.txt

  MISSING=$(comm -23 /tmp/live_ids.txt /tmp/local_ids.txt | tr '\n' ' ')

  if [ -z "$MISSING" ]; then
    echo "  All books already present locally. Nothing to insert."
  else
    echo "  Missing book IDs: $MISSING"
    echo "BEGIN;" > /tmp/sync_books.sql
    for id in $MISSING; do
      curl -s "$LIVE/api/books/$id" > /tmp/bk_$id.json
      python3 - "$id" << 'PYEOF'
import json, sys
id = sys.argv[1]
with open(f'/tmp/bk_{id}.json') as f:
    b = json.load(f)
def q(v): return "NULL" if v is None else "'" + str(v).replace("'","''") + "'"
def n(v): return "NULL" if v is None else str(v)
print(
  f"INSERT INTO books (id,title,author,genre,category,price,rating,cover_url,visible,cover_fit,source_draft_id,created_at) "
  f"VALUES ({id},{q(b.get('title'))},{q(b.get('author','EbookGamez'))},{q(b.get('genre'))},{q(b.get('category'))},"
  f"{n(b.get('price'))},{n(b.get('rating'))},{q(b.get('coverUrl'))},{str(bool(b.get('visible',True))).lower()},'cover',"
  f"{n(b.get('sourceDraftId'))},{q(b.get('createdAt'))}) ON CONFLICT (id) DO NOTHING;"
)
PYEOF
    done >> /tmp/sync_books.sql
    echo "COMMIT;" >> /tmp/sync_books.sql
    psql "$DATABASE_URL" -f /tmp/sync_books.sql
    echo "  Books synced."
  fi
  echo ""
fi

# ── 3. Sync draft content ─────────────────────────────────────
if $DO_DRAFTS; then
  echo "--- Step 2: Linking books to Content Studio drafts ---"

  # Exact title match first (fast, no API calls)
  LINKED=$(psql "$DATABASE_URL" -c "
    UPDATE books b
    SET source_draft_id = d.id
    FROM draft_ebooks d
    WHERE lower(trim(b.title)) = lower(trim(d.title))
      AND b.source_draft_id IS NULL
    RETURNING b.id;" -t | grep -c '[0-9]' || true)
  echo "  Linked $LINKED books by title match."

  # Find books that are published but still have empty draft content
  EMPTY_DRAFTS=$(psql "$DATABASE_URL" -c "
    SELECT b.id AS book_id, b.title, d.id AS draft_id
    FROM books b
    JOIN draft_ebooks d ON b.source_draft_id = d.id
    WHERE b.visible = true
      AND (d.content IS NULL OR d.content = '')
    ORDER BY b.id;" -t | grep -v '^$')

  if [ -z "$EMPTY_DRAFTS" ]; then
    echo "  All linked drafts have content. Nothing to pull."
  else
    COUNT=$(echo "$EMPTY_DRAFTS" | wc -l | tr -d ' ')
    echo "  Found $COUNT books with empty draft content — pulling from live site..."

    echo "$EMPTY_DRAFTS" | while IFS='|' read -r book_id title draft_id; do
      book_id=$(echo "$book_id" | tr -d ' ')
      draft_id=$(echo "$draft_id" | tr -d ' ')
      title=$(echo "$title" | tr -d ' ' | head -c 50)
      [ -z "$book_id" ] && continue

      # Find correct live draft by book title (not by ID — IDs differ between envs)
      LIVE_DRAFT_ID=$(curl -s "$LIVE/api/content-studio/drafts?status=published" \
        -H "x-admin-token: $LIVE_TOKEN" \
        | python3 -c "
import json,sys
data = json.load(sys.stdin)
drafts = data if isinstance(data,list) else data.get('drafts',[])
title = open('/tmp/bk_title_$book_id.txt').read().strip() if __import__('os').path.exists('/tmp/bk_title_$book_id.txt') else ''
# match by exact title via book_id lookup
import subprocess
r = subprocess.run(['psql', '$DATABASE_URL', '-c', f\"SELECT title FROM books WHERE id=$book_id;\", '-t'], capture_output=True, text=True)
book_title = r.stdout.strip()
matches = [d for d in drafts if d.get('title','').lower().strip() == book_title.lower().strip()]
print(matches[0]['id'] if matches else '')
" 2>/dev/null)

      if [ -z "$LIVE_DRAFT_ID" ]; then
        echo "    [SKIP] Book $book_id — no matching live draft found for '$title'"
        continue
      fi

      curl -s "$LIVE/api/content-studio/drafts/$LIVE_DRAFT_ID" \
        -H "x-admin-token: $LIVE_TOKEN" > /tmp/live_draft_$LIVE_DRAFT_ID.json

      python3 - "$draft_id" "/tmp/live_draft_$LIVE_DRAFT_ID.json" << 'PYEOF'
import json, sys, subprocess, os, tempfile
draft_id = sys.argv[1]
with open(sys.argv[2]) as f:
    d = json.load(f)
pub = d.get('publishedAt') or d.get('published_at')
published = f"'{pub}'" if pub else 'NOW()'
sql = (
  f"UPDATE draft_ebooks SET\n"
  f"  content        = $c${d.get('content','')}$c$,\n"
  f"  cover_url      = $cv${d.get('coverUrl','')}$cv$,\n"
  f"  background_url = $bg${d.get('backgroundUrl','')}$bg$,\n"
  f"  pdf_url        = $pdf${d.get('pdfUrl','')}$pdf$,\n"
  f"  outline        = $o${d.get('outline','')}$o$,\n"
  f"  description    = $dd${d.get('description','')}$dd$,\n"
  f"  status         = 'published',\n"
  f"  published_at   = {published}\n"
  f"WHERE id = {draft_id};\n"
)
f = tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False)
f.write(sql); f.close()
subprocess.run(['psql', os.environ['DATABASE_URL'], '-f', f.name])
os.unlink(f.name)
PYEOF
      echo "    [OK] Book $book_id draft $draft_id updated from live draft $LIVE_DRAFT_ID"
    done
  fi
  echo ""
fi

# ── 4. Summary ───────────────────────────────────────────────
echo "--- Done ---"
psql "$DATABASE_URL" -c "
SELECT
  (SELECT COUNT(*) FROM books) AS total_books,
  (SELECT MAX(id) FROM books) AS latest_book_id,
  (SELECT COUNT(*) FROM books WHERE source_draft_id IS NULL) AS books_without_draft,
  (SELECT COUNT(*) FROM draft_ebooks WHERE status = 'published') AS published_drafts;"
