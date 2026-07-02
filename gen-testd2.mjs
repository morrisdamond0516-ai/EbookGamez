import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pg from 'pg';
const { Client } = pg;

const APP  = 'http://localhost:5000';
const OUT  = '/home/runner/workspace/exports';
const LOGO = 'uploads/covers/ai-overlay-551-1773455035159.png';
fs.mkdirSync(OUT, { recursive: true });

const GOLD_HL='#fff8cc',GOLD_MID='#e8c040',GOLD='#cca633',GOLD_DK='#9a7018',GOLD_DM='#7a5810';
const PARCH='#e8d5b5',TXT_DARK='#1a1005';

// ── The 3 campaign drafts ─────────────────────────────────────────────────────
// The 'description' field is forwarded to getAICreativeDirection() inside
// generateTestStyleD — so we use it to pin the palette to the site's exact
// colours: deep near-black #0d0a05 + antique gold #cca633 only.
const CAMPAIGNS = [
  {
    key: 'reading-pass',
    title: 'The Reading Pass',
    genre: 'fiction',
    description: 'STRICT COLOR PALETTE — use ONLY deep near-black #0d0a05 and antique gold #cca633. Zero blue, teal, purple, green, red. Scene: cathedral private library at midnight — floor-to-ceiling mahogany shelves, a leather chair beside a fireplace that glows antique gold, candles everywhere, total darkness beyond the gold light.',
    tag:'READING PASS', headline:'Read Unlimited Books',
    sub:'Starting at $4.99 / month', cta:'Start Your Free Trial',
    extra:'DRM-Free  ·  Read & Keep  ·  7-Day Free Trial',
  },
  {
    key: 'gaming-guides',
    title: 'Master Any Game',
    genre: 'history',
    description: 'STRICT COLOR PALETTE — use ONLY deep near-black #0d0a05 and antique gold #cca633. Zero blue, teal, purple, green, red. Scene: ancient stone war room, heavy dark oak table with a hand-drawn fantasy map, one gold three-candle candelabra as the sole light source casting warm gold, brass compass and rolled scrolls, pure blackness beyond the table edge.',
    tag:'FREE GAMING GUIDES', headline:'Master Any Game',
    sub:'Expert walkthroughs & strategies', cta:'Read Free Guides',
    extra:'Walkthroughs  ·  Tips  ·  Secrets  ·  Speedruns',
  },
  {
    key: 'ebook-store',
    title: 'Your Next Read Awaits',
    genre: 'mystery',
    description: 'STRICT COLOR PALETTE — use ONLY pure black #0d0a05 and antique gold #cca633. Zero blue, teal, purple, green, red. Scene: a single ancient leather-bound book on a dark mahogany pedestal, its open pages radiating pure antique gold light upward into absolute darkness, fine gold dust motes suspended in the black air above.',
    tag:'500+ EBOOKS', headline:'Your Next Read Awaits',
    sub:'Fiction, Non-Fiction & More', cta:'Download Instantly',
    extra:'From $1.99  ·  DRM-Free  ·  Keep Forever',
  },
];

// ── DB ────────────────────────────────────────────────────────────────────────
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

async function createDraft(c) {
  const { rows } = await db.query(
    `INSERT INTO draft_ebooks (title, genre, topic, description, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
    [c.title, c.genre, c.description, c.description]
  );
  return rows[0].id;
}
async function getDraftUrls(id) {
  const { rows } = await db.query(
    'SELECT "coverUrl", "backgroundUrl" FROM draft_ebooks WHERE id = $1', [id]
  );
  return rows[0] || {};
}
async function deleteDraft(id) {
  await db.query('DELETE FROM draft_ebooks WHERE id = $1', [id]);
  console.log(`  Cleaned up draft ${id}`);
}

// ── Trigger generation & poll ─────────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function triggerAndWait(draftId) {
  // Trigger test-style-d via the real Cover Review endpoint
  const tr = await fetch(`${APP}/api/content-studio/regenerate-selected-backgrounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftIds: [draftId], modelStyleId: 'test-style-d' }),
  });
  if (!tr.ok) throw new Error(`Trigger failed ${tr.status}: ${await tr.text()}`);
  console.log(`  Generation started...`);

  // Poll until not running
  for (let i = 0; i < 120; i++) {          // max 4 min
    await sleep(2000);
    const sr = await fetch(`${APP}/api/content-studio/regeneration-status`);
    const status = await sr.json();
    console.log(`  Poll ${i+1}: running=${status.running} progress=${status.progress||'-'}`);
    if (!status.running) {
      if (status.lastError) throw new Error(`Generation error: ${status.lastError}`);
      console.log(`  ✓ Generation complete`);
      return;
    }
  }
  throw new Error('Timed out waiting for cover generation');
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function addGrain(ctx,W,H,s){const id=ctx.getImageData(0,0,W,H),d=id.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*s;d[i]=Math.max(0,Math.min(255,d[i]+n));d[i+1]=Math.max(0,Math.min(255,d[i+1]+n));d[i+2]=Math.max(0,Math.min(255,d[i+2]+n));}ctx.putImageData(id,0,0);}
function goldText(ctx,t,x,y,mW,al){al=al||'left';ctx.textAlign=al;ctx.textBaseline='alphabetic';ctx.save();ctx.filter='blur(14px)';ctx.globalAlpha=0.45;ctx.fillStyle=GOLD_MID;ctx.fillText(t,x,y,mW);ctx.restore();ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillText(t,x+3,y+4,mW);const as=Math.abs(ctx.measureText('M').actualBoundingBoxAscent)||60;const gy=ctx.createLinearGradient(x,y-as,x,y);gy.addColorStop(0,GOLD_HL);gy.addColorStop(0.25,GOLD_MID);gy.addColorStop(0.55,GOLD);gy.addColorStop(0.82,GOLD_DK);gy.addColorStop(1,GOLD_DM);ctx.fillStyle=gy;ctx.fillText(t,x,y,mW);}
function ornament(ctx,cx,y,w){const hw=w/2,dSz=5;const gl=ctx.createLinearGradient(cx-hw,y,cx+hw,y);gl.addColorStop(0,'rgba(204,166,51,0)');gl.addColorStop(0.15,'rgba(204,166,51,0.9)');gl.addColorStop(0.5,'rgba(204,166,51,0)');gl.addColorStop(0.85,'rgba(204,166,51,0.9)');gl.addColorStop(1,'rgba(204,166,51,0)');ctx.fillStyle=gl;ctx.fillRect(cx-hw,y-0.75,w,1.5);ctx.beginPath();ctx.moveTo(cx,y-dSz);ctx.lineTo(cx+dSz,y);ctx.lineTo(cx,y+dSz);ctx.lineTo(cx-dSz,y);ctx.closePath();const dg=ctx.createRadialGradient(cx,y,0,cx,y,dSz);dg.addColorStop(0,GOLD_HL);dg.addColorStop(1,GOLD);ctx.fillStyle=dg;ctx.fill();}
function drawTag(ctx,t,cx,y,h){ctx.save();ctx.font=`bold ${Math.round(h*.46)}px sans-serif`;const tw=ctx.measureText(t).width,px=h*1.1,W2=tw+px*2,H2=h,rx=cx-W2/2,ry=y-H2*.9;rrect(ctx,rx,ry,W2,H2,H2/2);const bg=ctx.createLinearGradient(rx,ry,rx,ry+H2);bg.addColorStop(0,'#a07818');bg.addColorStop(1,'#6e5010');ctx.fillStyle=bg;ctx.fill();rrect(ctx,rx,ry,W2,H2,H2/2);ctx.strokeStyle=GOLD;ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle='#fff8e0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,cx,ry+H2/2);ctx.restore();}
function drawCTA(ctx,t,cx,cy,h){ctx.save();ctx.font=`bold ${Math.round(h*.42)}px sans-serif`;const tw=ctx.measureText(t).width,W2=tw+h*3.2,H2=h,rx=cx-W2/2,ry=cy-H2/2;ctx.shadowColor='rgba(204,166,51,0.65)';ctx.shadowBlur=32;rrect(ctx,rx,ry,W2,H2,H2/2);const bg=ctx.createLinearGradient(rx,ry,rx,ry+H2);bg.addColorStop(0,'#eed045');bg.addColorStop(0.45,GOLD);bg.addColorStop(1,GOLD_DK);ctx.fillStyle=bg;ctx.fill();ctx.shadowBlur=0;ctx.save();rrect(ctx,rx,ry,W2,H2,H2/2);ctx.clip();ctx.fillStyle='rgba(255,248,180,0.30)';ctx.fillRect(rx,ry,W2,H2*.44);ctx.restore();rrect(ctx,rx,ry,W2,H2,H2/2);ctx.strokeStyle='rgba(255,240,150,0.5)';ctx.lineWidth=1.5;ctx.stroke();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillText(t,cx+1,cy+2);ctx.fillStyle=TXT_DARK;ctx.fillText(t,cx,cy);ctx.restore();}
let LOGO_IMG=null;
async function drawBrand(ctx,x,y,sz,fz){if(!LOGO_IMG)LOGO_IMG=await loadImage(path.resolve(LOGO));ctx.save();rrect(ctx,x,y,sz,sz,sz*.1);ctx.clip();ctx.drawImage(LOGO_IMG,0,0,1024,1024,x,y,sz,sz);ctx.restore();ctx.strokeStyle=GOLD;ctx.lineWidth=1.2;rrect(ctx,x,y,sz,sz,sz*.1);ctx.stroke();ctx.textBaseline='middle';ctx.textAlign='left';ctx.font=`bold ${fz}px serif`;ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillText('EbookGamez',x+sz+11,y+sz/2+2);ctx.fillStyle=GOLD;ctx.fillText('EbookGamez',x+sz+10,y+sz/2);}
function corners(ctx,W,H,sz,pad){ctx.strokeStyle='rgba(204,166,51,0.45)';ctx.lineWidth=1.5;const C=[[pad,pad],[W-pad,pad],[W-pad,H-pad],[pad,H-pad]],D=[[1,1],[-1,1],[-1,-1],[1,-1]];for(let i=0;i<4;i++){const cx=C[i][0],cy=C[i][1],dx=D[i][0],dy=D[i][1];ctx.beginPath();ctx.moveTo(cx,cy+dy*sz);ctx.lineTo(cx,cy);ctx.lineTo(cx+dx*sz,cy);ctx.stroke();}}
function drawBg(ctx,img,W,H){const s=Math.max(W/img.width,H/img.height);ctx.drawImage(img,(W-img.width*s)/2,(H-img.height*s)/2,img.width*s,img.height*s);}
function fitFz(ctx,t,mW,st,mn){let fz=st;ctx.font=`bold ${fz}px serif`;while(ctx.measureText(t).width>mW&&fz>mn){fz-=2;ctx.font=`bold ${fz}px serif`;}return fz;}
async function save(cv,n){const s=fs.createWriteStream(`${OUT}/${n}`);cv.createPNGStream().pipe(s);await new Promise(r=>s.on('finish',r));console.log('    ✓',n);}

async function makeLandscape(bg,ad,fn){const W=1200,H=628,cv=createCanvas(W,H),c=cv.getContext('2d');drawBg(c,bg,W,H);const gL=c.createLinearGradient(0,0,W,0);gL.addColorStop(0,'rgba(4,2,0,0.99)');gL.addColorStop(0.38,'rgba(4,2,0,0.98)');gL.addColorStop(0.60,'rgba(4,2,0,0.35)');gL.addColorStop(0.82,'rgba(4,2,0,0.03)');gL.addColorStop(1,'rgba(4,2,0,0)');c.fillStyle=gL;c.fillRect(0,0,W,H);const gB=c.createLinearGradient(0,H*.48,0,H);gB.addColorStop(0,'rgba(4,2,0,0)');gB.addColorStop(0.28,'rgba(4,2,0,0.94)');gB.addColorStop(1,'rgba(4,2,0,1)');c.fillStyle=gB;c.fillRect(0,0,W,H);addGrain(c,W,H,18);const PAD=58,TW=W*.53;await drawBrand(c,PAD,24,52,28);drawTag(c,ad.tag,PAD+(TW-PAD)*.38,H*.35,33);const fz=fitFz(c,ad.headline,TW-PAD-20,78,34);c.font=`bold ${fz}px serif`;goldText(c,ad.headline,PAD,H*.515,TW-PAD,'left');c.font=`${Math.round(fz*.41)}px sans-serif`;c.fillStyle='rgba(0,0,0,0.75)';c.textAlign='left';c.textBaseline='alphabetic';c.fillText(ad.sub,PAD+2,H*.515+fz*.62+2,TW-PAD);c.fillStyle=PARCH;c.fillText(ad.sub,PAD,H*.515+fz*.62,TW-PAD);ornament(c,PAD+(TW-PAD)*.38,H*.515+fz*.92,(TW-PAD)*.72);c.font=`${Math.round(fz*.30)}px sans-serif`;c.fillStyle='rgba(232,213,181,0.60)';c.textAlign='left';c.textBaseline='alphabetic';c.fillText(ad.extra,PAD,H*.515+fz*1.18,TW-PAD);drawCTA(c,ad.cta,PAD+(TW-PAD)*.38,H*.845,58);await save(cv,fn);}
async function makeSquare(bg,ad,fn){const W=1200,H=1200,cv=createCanvas(W,H),c=cv.getContext('2d');drawBg(c,bg,W,H);const gB=c.createLinearGradient(0,H*.36,0,H);gB.addColorStop(0,'rgba(4,2,0,0)');gB.addColorStop(0.20,'rgba(4,2,0,0.95)');gB.addColorStop(0.38,'rgba(4,2,0,1)');gB.addColorStop(1,'rgba(4,2,0,1)');c.fillStyle=gB;c.fillRect(0,0,W,H);const gT=c.createLinearGradient(0,0,0,H*.15);gT.addColorStop(0,'rgba(0,0,0,0.5)');gT.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gT;c.fillRect(0,0,W,H);addGrain(c,W,H,18);const CX=W/2,PAD=68;await drawBrand(c,PAD,44,54,29);corners(c,W,H,40,20);drawTag(c,ad.tag,CX,H*.595,35);const fz=fitFz(c,ad.headline,W-PAD*2,98,40);c.font=`bold ${fz}px serif`;goldText(c,ad.headline,CX,H*.715,W-PAD*2,'center');c.font=`${Math.round(fz*.40)}px sans-serif`;c.fillStyle='rgba(0,0,0,0.75)';c.textAlign='center';c.textBaseline='alphabetic';c.fillText(ad.sub,CX+2,H*.715+fz*.56+2,W-PAD*2);c.fillStyle=PARCH;c.fillText(ad.sub,CX,H*.715+fz*.56,W-PAD*2);ornament(c,CX,H*.715+fz*.83,W-PAD*2-100);c.font=`${Math.round(fz*.31)}px sans-serif`;c.fillStyle='rgba(232,213,181,0.60)';c.textAlign='center';c.textBaseline='alphabetic';c.fillText(ad.extra,CX,H*.715+fz*1.08,W-PAD*2);drawCTA(c,ad.cta,CX,H*.910,66);await save(cv,fn);}
async function makePortrait(bg,ad,fn){const W=960,H=1200,cv=createCanvas(W,H),c=cv.getContext('2d');drawBg(c,bg,W,H);const gB=c.createLinearGradient(0,H*.36,0,H);gB.addColorStop(0,'rgba(4,2,0,0)');gB.addColorStop(0.20,'rgba(4,2,0,0.95)');gB.addColorStop(0.38,'rgba(4,2,0,1)');gB.addColorStop(1,'rgba(4,2,0,1)');c.fillStyle=gB;c.fillRect(0,0,W,H);const gT=c.createLinearGradient(0,0,0,H*.14);gT.addColorStop(0,'rgba(0,0,0,0.5)');gT.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gT;c.fillRect(0,0,W,H);addGrain(c,W,H,18);const CX=W/2,PAD=55;await drawBrand(c,PAD,36,48,26);corners(c,W,H,36,18);drawTag(c,ad.tag,CX,H*.595,33);const fz=fitFz(c,ad.headline,W-PAD*2,88,36);c.font=`bold ${fz}px serif`;goldText(c,ad.headline,CX,H*.715,W-PAD*2,'center');c.font=`${Math.round(fz*.40)}px sans-serif`;c.fillStyle='rgba(0,0,0,0.75)';c.textAlign='center';c.textBaseline='alphabetic';c.fillText(ad.sub,CX+2,H*.715+fz*.56+2,W-PAD*2);c.fillStyle=PARCH;c.fillText(ad.sub,CX,H*.715+fz*.56,W-PAD*2);ornament(c,CX,H*.715+fz*.83,W-PAD*2-80);c.font=`${Math.round(fz*.31)}px sans-serif`;c.fillStyle='rgba(232,213,181,0.60)';c.textAlign='center';c.textBaseline='alphabetic';c.fillText(ad.extra,CX,H*.715+fz*1.08,W-PAD*2);drawCTA(c,ad.cta,CX,H*.908,62);await save(cv,fn);}

// ── MAIN ─────────────────────────────────────────────────────────────────────
const tempIds = [];
try {
  for (const c of CAMPAIGNS) {
    console.log(`\n═══ Campaign: ${c.key} ═══`);

    // 1) Create temp draft
    const id = await createDraft(c);
    tempIds.push(id);
    console.log(`  Draft id=${id}`);

    // 2) Fire the exact same endpoint Cover Review uses with test-style-d
    await triggerAndWait(id);

    // 3) Read resulting file path from DB
    const { coverUrl, backgroundUrl } = await getDraftUrls(id);
    const rawUrl = backgroundUrl || coverUrl;
    if (!rawUrl) throw new Error(`No cover URL in DB for draft ${id}`);
    const localFile = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
    console.log(`  File: ${localFile}`);
    if (!fs.existsSync(localFile)) throw new Error(`File not found: ${localFile}`);

    // Save background
    const rawOut = `${OUT}/bg-testd-${c.key}.png`;
    fs.copyFileSync(localFile, rawOut);
    console.log(`  ✓ Background saved`);

    // 4) Composite all 3 ad sizes
    const bgImg = await loadImage(rawOut);
    await makeLandscape(bgImg, c, `${c.key}-landscape-1200x628.png`);
    await makeSquare(   bgImg, c, `${c.key}-square-1200x1200.png`);
    await makePortrait( bgImg, c, `${c.key}-portrait-960x1200.png`);
  }
} finally {
  for (const id of tempIds) await deleteDraft(id).catch(()=>{});
  await db.end();
}

// Rebuild zip
const files = [
  'reading-pass-landscape-1200x628.png','reading-pass-square-1200x1200.png','reading-pass-portrait-960x1200.png',
  'gaming-guides-landscape-1200x628.png','gaming-guides-square-1200x1200.png','gaming-guides-portrait-960x1200.png',
  'ebook-store-landscape-1200x628.png','ebook-store-square-1200x1200.png','ebook-store-portrait-960x1200.png',
  'ebookgamez-logo-square-1200x1200.png','ebookgamez-logo-horizontal-1200x300.png',
];
const existingFiles = files.filter(f => fs.existsSync(`${OUT}/${f}`));
execSync(`cd ${OUT} && zip -u ebookgamez-google-ads-assets.zip ${existingFiles.join(' ')}`, {stdio:'inherit'});
console.log('\n✅ All done! Zip updated.');
