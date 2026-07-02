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

// ── CAMPAIGNS ────────────────────────────────────────────────────────────────
// Description is passed directly to getAICreativeDirection — so we use it to
// lock the color palette to exactly the EbookGamez website colors.
const CAMPAIGNS = [
  {
    key: 'reading-pass',
    title: 'The Reading Pass',
    genre: 'fiction',
    description: 'STRICT COLOR PALETTE — use ONLY these website-exact colors: deep near-black #0d0a05, antique gold #cca633, dark warm mahogany brown. No blue, no teal, no purple, no green, no red, no other hues. Scenario: a breathtaking private cathedral library at midnight, towering mahogany bookshelves, leather armchair, roaring fireplace as the sole light source bathing everything in antique gold warmth.',
    tag:'READING PASS', headline:'Read Unlimited Books',
    sub:'Starting at $4.99 / month', cta:'Start Your Free Trial',
    extra:'DRM-Free  ·  Read & Keep  ·  7-Day Free Trial',
  },
  {
    key: 'gaming-guides',
    title: 'Master Any Game',
    genre: 'history',
    description: 'STRICT COLOR PALETTE — use ONLY these website-exact colors: deep near-black #0d0a05, antique gold #cca633, dark oak brown. No blue, no teal, no purple, no green, no red, no other hues. Scenario: an ancient stone war room with a massive fantasy map spread on a heavy dark oak table, a gold three-candle candelabra as the sole light source, brass compass and rolled scrolls, pure shadow beyond the table.',
    tag:'FREE GAMING GUIDES', headline:'Master Any Game',
    sub:'Expert walkthroughs & strategies', cta:'Read Free Guides',
    extra:'Walkthroughs  ·  Tips  ·  Secrets  ·  Speedruns',
  },
  {
    key: 'ebook-store',
    title: 'Your Next Read Awaits',
    genre: 'mystery',
    description: 'STRICT COLOR PALETTE — use ONLY these website-exact colors: pure black #0d0a05, antique gold #cca633, aged parchment. No blue, no teal, no purple, no green, no red. Scenario: a single ancient leather-bound book open on a dark mahogany pedestal, its pages radiating pure antique gold light upward into total darkness, golden dust motes floating in the black air.',
    tag:'500+ EBOOKS', headline:'Your Next Read Awaits',
    sub:'Fiction, Non-Fiction & More', cta:'Download Instantly',
    extra:'From $1.99  ·  DRM-Free  ·  Keep Forever',
  },
];

// ── DB: create + delete temp draft ───────────────────────────────────────────
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
async function deleteDraft(id) {
  await db.query('DELETE FROM draft_ebooks WHERE id = $1', [id]);
  console.log(`  Deleted temp draft ${id}`);
}

// ── COVER GENERATION via app's test-style-d endpoint ────────────────────────
async function generateTestStyleD(draftId) {
  const r = await fetch(
    `${APP}/api/content-studio/regenerate-cover-with-style/${draftId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ styleId: 'test-style-d' }),
    }
  );
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Cover gen failed ${r.status}: ${text.slice(0, 200)}`);
  }
  const data = await r.json();
  console.log(`  ✓ test-style-d cover: ${data.coverUrl}`);
  return data.coverUrl;   // e.g. "/uploads/covers/ai-bg-test-style-d-1234.png"
}

// ── CANVAS HELPERS ────────────────────────────────────────────────────────────
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function addGrain(ctx,W,H,s){const id=ctx.getImageData(0,0,W,H),d=id.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*s;d[i]=Math.max(0,Math.min(255,d[i]+n));d[i+1]=Math.max(0,Math.min(255,d[i+1]+n));d[i+2]=Math.max(0,Math.min(255,d[i+2]+n));}ctx.putImageData(id,0,0);}
function goldText(ctx,text,x,y,maxW,align){if(!align)align='left';ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.save();ctx.filter='blur(14px)';ctx.globalAlpha=0.45;ctx.fillStyle=GOLD_MID;ctx.fillText(text,x,y,maxW);ctx.restore();ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillText(text,x+3,y+4,maxW);const asc=Math.abs(ctx.measureText('M').actualBoundingBoxAscent)||60;const gy=ctx.createLinearGradient(x,y-asc,x,y);gy.addColorStop(0,GOLD_HL);gy.addColorStop(0.25,GOLD_MID);gy.addColorStop(0.55,GOLD);gy.addColorStop(0.82,GOLD_DK);gy.addColorStop(1,GOLD_DM);ctx.fillStyle=gy;ctx.fillText(text,x,y,maxW);}
function ornament(ctx,cx,y,w){const hw=w/2,dSz=5;const gl=ctx.createLinearGradient(cx-hw,y,cx+hw,y);gl.addColorStop(0,'rgba(204,166,51,0)');gl.addColorStop(0.15,'rgba(204,166,51,0.9)');gl.addColorStop(0.46,'rgba(204,166,51,0.9)');gl.addColorStop(0.5,'rgba(204,166,51,0)');gl.addColorStop(0.54,'rgba(204,166,51,0.9)');gl.addColorStop(0.85,'rgba(204,166,51,0.9)');gl.addColorStop(1,'rgba(204,166,51,0)');ctx.fillStyle=gl;ctx.fillRect(cx-hw,y-0.75,w,1.5);ctx.beginPath();ctx.moveTo(cx,y-dSz);ctx.lineTo(cx+dSz,y);ctx.lineTo(cx,y+dSz);ctx.lineTo(cx-dSz,y);ctx.closePath();const dg=ctx.createRadialGradient(cx,y,0,cx,y,dSz);dg.addColorStop(0,GOLD_HL);dg.addColorStop(1,GOLD);ctx.fillStyle=dg;ctx.fill();}
function drawTag(ctx,text,cx,y,h){ctx.save();ctx.font=`bold ${Math.round(h*.46)}px sans-serif`;const tw=ctx.measureText(text).width,padX=h*1.1,W2=tw+padX*2,H2=h,rx=cx-W2/2,ry=y-H2*.9;rrect(ctx,rx,ry,W2,H2,H2/2);const bg=ctx.createLinearGradient(rx,ry,rx,ry+H2);bg.addColorStop(0,'#a07818');bg.addColorStop(1,'#6e5010');ctx.fillStyle=bg;ctx.fill();ctx.save();rrect(ctx,rx+2,ry+2,W2-4,H2/2,H2/2);ctx.clip();ctx.fillStyle='rgba(255,230,120,0.12)';ctx.fill();ctx.restore();rrect(ctx,rx,ry,W2,H2,H2/2);ctx.strokeStyle=GOLD;ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle='#fff8e0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,cx,ry+H2/2);ctx.restore();}
function drawCTA(ctx,text,cx,cy,h){ctx.save();ctx.font=`bold ${Math.round(h*.42)}px sans-serif`;const tw=ctx.measureText(text).width,W2=tw+h*3.2,H2=h,rx=cx-W2/2,ry=cy-H2/2;ctx.shadowColor='rgba(204,166,51,0.65)';ctx.shadowBlur=32;rrect(ctx,rx,ry,W2,H2,H2/2);const bg=ctx.createLinearGradient(rx,ry,rx,ry+H2);bg.addColorStop(0,'#eed045');bg.addColorStop(0.45,GOLD);bg.addColorStop(1,GOLD_DK);ctx.fillStyle=bg;ctx.fill();ctx.shadowBlur=0;ctx.save();rrect(ctx,rx,ry,W2,H2,H2/2);ctx.clip();ctx.fillStyle='rgba(255,248,180,0.30)';ctx.fillRect(rx,ry,W2,H2*.44);ctx.restore();rrect(ctx,rx,ry,W2,H2,H2/2);ctx.strokeStyle='rgba(255,240,150,0.5)';ctx.lineWidth=1.5;ctx.stroke();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillText(text,cx+1,cy+2);ctx.fillStyle=TXT_DARK;ctx.fillText(text,cx,cy);ctx.restore();}
let LOGO_IMG=null;
async function drawBrand(ctx,x,y,sz,fz){if(!LOGO_IMG)LOGO_IMG=await loadImage(path.resolve(LOGO));ctx.save();rrect(ctx,x,y,sz,sz,sz*.1);ctx.clip();ctx.drawImage(LOGO_IMG,0,0,1024,1024,x,y,sz,sz);ctx.restore();ctx.strokeStyle=GOLD;ctx.lineWidth=1.2;rrect(ctx,x,y,sz,sz,sz*.1);ctx.stroke();ctx.textBaseline='middle';ctx.textAlign='left';ctx.font=`bold ${fz}px serif`;ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillText('EbookGamez',x+sz+11,y+sz/2+2);ctx.fillStyle=GOLD;ctx.fillText('EbookGamez',x+sz+10,y+sz/2);}
function cornerAccents(ctx,W,H,sz,pad){ctx.strokeStyle='rgba(204,166,51,0.45)';ctx.lineWidth=1.5;const C=[[pad,pad],[W-pad,pad],[W-pad,H-pad],[pad,H-pad]],D=[[1,1],[-1,1],[-1,-1],[1,-1]];for(let i=0;i<4;i++){const cx=C[i][0],cy=C[i][1],dx=D[i][0],dy=D[i][1];ctx.beginPath();ctx.moveTo(cx,cy+dy*sz);ctx.lineTo(cx,cy);ctx.lineTo(cx+dx*sz,cy);ctx.stroke();}}
function drawBg(ctx,bgImg,W,H){const s=Math.max(W/bgImg.width,H/bgImg.height);ctx.drawImage(bgImg,(W-bgImg.width*s)/2,(H-bgImg.height*s)/2,bgImg.width*s,bgImg.height*s);}
function fitFz(ctx,text,maxW,start,min){let fz=start;ctx.font=`bold ${fz}px serif`;while(ctx.measureText(text).width>maxW&&fz>min){fz-=2;ctx.font=`bold ${fz}px serif`;}return fz;}
async function saveCanvas(cv,name){const s=fs.createWriteStream(`${OUT}/${name}`);cv.createPNGStream().pipe(s);await new Promise(r=>s.on('finish',r));console.log('    ✓',name);}

async function makeLandscape(bgImg,ad,fname){const W=1200,H=628,cv=createCanvas(W,H),ctx=cv.getContext('2d');drawBg(ctx,bgImg,W,H);const gL=ctx.createLinearGradient(0,0,W,0);gL.addColorStop(0,'rgba(4,2,0,0.99)');gL.addColorStop(0.38,'rgba(4,2,0,0.98)');gL.addColorStop(0.58,'rgba(4,2,0,0.38)');gL.addColorStop(0.80,'rgba(4,2,0,0.04)');gL.addColorStop(1,'rgba(4,2,0,0)');ctx.fillStyle=gL;ctx.fillRect(0,0,W,H);const gBot=ctx.createLinearGradient(0,H*.48,0,H);gBot.addColorStop(0,'rgba(4,2,0,0)');gBot.addColorStop(0.25,'rgba(4,2,0,0.92)');gBot.addColorStop(1,'rgba(4,2,0,1)');ctx.fillStyle=gBot;ctx.fillRect(0,0,W,H);const gTop=ctx.createLinearGradient(0,0,0,H*.12);gTop.addColorStop(0,'rgba(0,0,0,0.5)');gTop.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gTop;ctx.fillRect(0,0,W,H);addGrain(ctx,W,H,18);const PAD=58,TW=W*.52;await drawBrand(ctx,PAD,24,52,28);drawTag(ctx,ad.tag,PAD+(TW-PAD)*.38,H*.35,33);const fz=fitFz(ctx,ad.headline,TW-PAD-20,78,34);ctx.font=`bold ${fz}px serif`;goldText(ctx,ad.headline,PAD,H*.515,TW-PAD,'left');ctx.font=`${Math.round(fz*.41)}px sans-serif`;ctx.fillStyle='rgba(0,0,0,0.75)';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(ad.sub,PAD+2,H*.515+fz*.62+2,TW-PAD);ctx.fillStyle=PARCH;ctx.fillText(ad.sub,PAD,H*.515+fz*.62,TW-PAD);ornament(ctx,PAD+(TW-PAD)*.38,H*.515+fz*.92,(TW-PAD)*.72);ctx.font=`${Math.round(fz*.30)}px sans-serif`;ctx.fillStyle='rgba(232,213,181,0.60)';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(ad.extra,PAD,H*.515+fz*1.18,TW-PAD);drawCTA(ctx,ad.cta,PAD+(TW-PAD)*.38,H*.845,58);await saveCanvas(cv,fname);}
async function makeSquare(bgImg,ad,fname){const W=1200,H=1200,cv=createCanvas(W,H),ctx=cv.getContext('2d');drawBg(ctx,bgImg,W,H);const gB=ctx.createLinearGradient(0,H*.36,0,H);gB.addColorStop(0,'rgba(4,2,0,0)');gB.addColorStop(0.20,'rgba(4,2,0,0.95)');gB.addColorStop(0.35,'rgba(4,2,0,1.0)');gB.addColorStop(1,'rgba(4,2,0,1.0)');ctx.fillStyle=gB;ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(4,2,0,1.0)';ctx.fillRect(0,H*.63,W,H*.37);const gT=ctx.createLinearGradient(0,0,0,H*.15);gT.addColorStop(0,'rgba(0,0,0,0.5)');gT.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gT;ctx.fillRect(0,0,W,H);addGrain(ctx,W,H,18);const CX=W/2,PAD=68;await drawBrand(ctx,PAD,44,54,29);cornerAccents(ctx,W,H,40,20);drawTag(ctx,ad.tag,CX,H*.595,35);const fz=fitFz(ctx,ad.headline,W-PAD*2,98,40);ctx.font=`bold ${fz}px serif`;goldText(ctx,ad.headline,CX,H*.715,W-PAD*2,'center');ctx.font=`${Math.round(fz*.40)}px sans-serif`;ctx.fillStyle='rgba(0,0,0,0.75)';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(ad.sub,CX+2,H*.715+fz*.56+2,W-PAD*2);ctx.fillStyle=PARCH;ctx.fillText(ad.sub,CX,H*.715+fz*.56,W-PAD*2);ornament(ctx,CX,H*.715+fz*.83,W-PAD*2-100);ctx.font=`${Math.round(fz*.31)}px sans-serif`;ctx.fillStyle='rgba(232,213,181,0.60)';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(ad.extra,CX,H*.715+fz*1.08,W-PAD*2);drawCTA(ctx,ad.cta,CX,H*.910,66);await saveCanvas(cv,fname);}
async function makePortrait(bgImg,ad,fname){const W=960,H=1200,cv=createCanvas(W,H),ctx=cv.getContext('2d');drawBg(ctx,bgImg,W,H);const gB=ctx.createLinearGradient(0,H*.36,0,H);gB.addColorStop(0,'rgba(4,2,0,0)');gB.addColorStop(0.20,'rgba(4,2,0,0.95)');gB.addColorStop(0.35,'rgba(4,2,0,1.0)');gB.addColorStop(1,'rgba(4,2,0,1.0)');ctx.fillStyle=gB;ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(4,2,0,1.0)';ctx.fillRect(0,H*.63,W,H*.37);const gT=ctx.createLinearGradient(0,0,0,H*.14);gT.addColorStop(0,'rgba(0,0,0,0.5)');gT.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gT;ctx.fillRect(0,0,W,H);addGrain(ctx,W,H,18);const CX=W/2,PAD=55;await drawBrand(ctx,PAD,36,48,26);cornerAccents(ctx,W,H,36,18);drawTag(ctx,ad.tag,CX,H*.595,33);const fz=fitFz(ctx,ad.headline,W-PAD*2,88,36);ctx.font=`bold ${fz}px serif`;goldText(ctx,ad.headline,CX,H*.715,W-PAD*2,'center');ctx.font=`${Math.round(fz*.40)}px sans-serif`;ctx.fillStyle='rgba(0,0,0,0.75)';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(ad.sub,CX+2,H*.715+fz*.56+2,W-PAD*2);ctx.fillStyle=PARCH;ctx.fillText(ad.sub,CX,H*.715+fz*.56,W-PAD*2);ornament(ctx,CX,H*.715+fz*.83,W-PAD*2-80);ctx.font=`${Math.round(fz*.31)}px sans-serif`;ctx.fillStyle='rgba(232,213,181,0.60)';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(ad.extra,CX,H*.715+fz*1.08,W-PAD*2);drawCTA(ctx,ad.cta,CX,H*.908,62);await saveCanvas(cv,fname);}

// ── MAIN ─────────────────────────────────────────────────────────────────────
const tempIds = [];
try {
  for (const c of CAMPAIGNS) {
    console.log(`\n═══ [${c.key}] ═══`);

    // 1. Create temp draft in DB
    const draftId = await createDraft(c);
    tempIds.push(draftId);
    console.log(`  Created draft id=${draftId}`);

    // 2. Fire through test-style-d — the real app generator
    const coverUrl = await generateTestStyleD(draftId);

    // 3. Map URL to local file & copy
    const localFile = coverUrl.startsWith('/') ? coverUrl.slice(1) : coverUrl;
    if (!fs.existsSync(localFile)) throw new Error(`File not found: ${localFile}`);
    const rawOut = `${OUT}/bg-testd-${c.key}.png`;
    fs.copyFileSync(localFile, rawOut);
    console.log(`  ✓ Background: ${rawOut}`);

    // 4. Show raw so user can see the test-style-d output
    const bgImg = await loadImage(rawOut);

    // 5. Composite all 3 ad sizes
    await makeLandscape(bgImg, c, `${c.key}-landscape-1200x628.png`);
    await makeSquare(   bgImg, c, `${c.key}-square-1200x1200.png`);
    await makePortrait( bgImg, c, `${c.key}-portrait-960x1200.png`);
  }
} finally {
  for (const id of tempIds) await deleteDraft(id);
  await db.end();
}

// Rebuild zip
execSync(`cd ${OUT} && zip -f ebookgamez-google-ads-assets.zip reading-pass-landscape-1200x628.png reading-pass-square-1200x1200.png reading-pass-portrait-960x1200.png gaming-guides-landscape-1200x628.png gaming-guides-square-1200x1200.png gaming-guides-portrait-960x1200.png ebook-store-landscape-1200x628.png ebook-store-square-1200x1200.png ebook-store-portrait-960x1200.png ebookgamez-logo-square-1200x1200.png ebookgamez-logo-horizontal-1200x300.png`, {stdio:'inherit'});
console.log('\nAll done!');
