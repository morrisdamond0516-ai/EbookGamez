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

const GOLD_HL='#fff8cc', GOLD_MID='#e8c040', GOLD='#cca633', GOLD_DK='#9a7018', GOLD_DM='#7a5810';
const PARCH='#e8d5b5', TXT_DARK='#1a1005';

// Descriptions now let the AI paint vivid cinematic scenes — like real book covers.
// Website colours (gold/dark) come from the overlay, NOT by restricting the AI.
const CAMPAIGNS = [
  {
    key: 'reading-pass',
    title: 'Midnight Reading Pass',
    genre: 'fiction',
    description: 'A breathtaking private cathedral library at midnight — towering mahogany bookshelves lined with thousands of leather-bound books, a roaring fireplace casting warm amber and gold light, a plush leather armchair with a glowing open book, rich wood panelling, ornate gold candelabras, stained glass windows, atmospheric cinematic lighting, painterly oil-on-canvas style, extremely detailed and vivid.',
    tag:'READING PASS', headline:'Read Unlimited Books',
    sub:'Starting at $4.99 / month', cta:'Start Your Free Trial',
    extra:'DRM-Free  ·  Read & Keep  ·  7-Day Free Trial',
  },
  {
    key: 'gaming-guides',
    title: 'The Ultimate Game Master',
    genre: 'adventure',
    description: 'An epic ancient stone war room lit by gold candlelight — a massive hand-drawn fantasy map spread across a heavy oak table, chess-like game pieces marking territories, a brass compass, rolled parchment scrolls, a flickering gold candelabra, dramatic atmospheric lighting with deep shadows and warm amber highlights, painterly cinematic style, extremely detailed and vivid.',
    tag:'FREE GAMING GUIDES', headline:'Master Any Game',
    sub:'Expert walkthroughs & strategies', cta:'Read Free Guides',
    extra:'Walkthroughs  ·  Tips  ·  Secrets  ·  Speedruns',
  },
  {
    key: 'ebook-store',
    title: 'The Golden Library',
    genre: 'mystery',
    description: 'A single ancient leather-bound book open on a dark mahogany pedestal, surrounded by dramatic golden light rays bursting from the pages, fine gold dust motes floating in warm amber air, rich atmospheric setting with deep mahogany shelves in soft focus behind, dramatic chiaroscuro lighting, cinematic painterly style, extremely detailed and vivid.',
    tag:'500+ EBOOKS', headline:'Your Next Read Awaits',
    sub:'Fiction, Non-Fiction & More', cta:'Download Instantly',
    extra:'From $1.99  ·  DRM-Free  ·  Keep Forever',
  },
];

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
    `SELECT cover_url, background_url FROM draft_ebooks WHERE id = $1`, [id]
  );
  return rows[0] || {};
}
async function deleteDraft(id) {
  await db.query('DELETE FROM draft_ebooks WHERE id = $1', [id]);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function triggerAndWait(draftId) {
  const tr = await fetch(`${APP}/api/content-studio/regenerate-selected-backgrounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftIds: [draftId], modelStyleId: 'test-style-d' }),
  });
  if (!tr.ok) throw new Error(`Trigger ${tr.status}: ${await tr.text()}`);
  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    const sr = await fetch(`${APP}/api/content-studio/regeneration-status`);
    const st = await sr.json();
    process.stdout.write(`\r  Poll ${i+1}: ${st.running ? 'running' : 'done'} — ${st.progress||'-'}   `);
    if (!st.running) { console.log(); return; }
  }
  throw new Error('Timed out');
}

// ── Canvas helpers ─────────────────────────────────────────────────────────
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function addGrain(ctx,W,H,s){const id=ctx.getImageData(0,0,W,H),d=id.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*s;d[i]=Math.max(0,Math.min(255,d[i]+n));d[i+1]=Math.max(0,Math.min(255,d[i+1]+n));d[i+2]=Math.max(0,Math.min(255,d[i+2]+n));}ctx.putImageData(id,0,0);}

function goldText(ctx,t,x,y,mW,al){
  al=al||'left'; ctx.textAlign=al; ctx.textBaseline='alphabetic';
  // shadow
  ctx.save(); ctx.filter='blur(12px)'; ctx.globalAlpha=0.6; ctx.fillStyle=GOLD_MID; ctx.fillText(t,x,y,mW); ctx.restore();
  // dark drop shadow
  ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillText(t,x+3,y+4,mW);
  // gold gradient fill
  const as2=Math.abs(ctx.measureText('M').actualBoundingBoxAscent)||60;
  const gy=ctx.createLinearGradient(x,y-as2,x,y);
  gy.addColorStop(0,GOLD_HL); gy.addColorStop(0.25,GOLD_MID);
  gy.addColorStop(0.55,GOLD); gy.addColorStop(0.82,GOLD_DK); gy.addColorStop(1,GOLD_DM);
  ctx.fillStyle=gy; ctx.fillText(t,x,y,mW);
}

function ornament(ctx,cx,y,w){
  const hw=w/2,dSz=6;
  const gl=ctx.createLinearGradient(cx-hw,y,cx+hw,y);
  gl.addColorStop(0,'rgba(204,166,51,0)'); gl.addColorStop(0.12,'rgba(204,166,51,0.9)');
  gl.addColorStop(0.48,'rgba(204,166,51,0.9)'); gl.addColorStop(0.5,'rgba(204,166,51,0)');
  gl.addColorStop(0.52,'rgba(204,166,51,0.9)'); gl.addColorStop(0.88,'rgba(204,166,51,0.9)');
  gl.addColorStop(1,'rgba(204,166,51,0)');
  ctx.fillStyle=gl; ctx.fillRect(cx-hw,y-1,w,2);
  ctx.beginPath(); ctx.moveTo(cx,y-dSz); ctx.lineTo(cx+dSz,y); ctx.lineTo(cx,y+dSz); ctx.lineTo(cx-dSz,y); ctx.closePath();
  const dg=ctx.createRadialGradient(cx,y,0,cx,y,dSz); dg.addColorStop(0,GOLD_HL); dg.addColorStop(1,GOLD);
  ctx.fillStyle=dg; ctx.fill();
}

function drawTag(ctx,t,cx,y,h){
  ctx.save(); ctx.font=`bold ${Math.round(h*.46)}px sans-serif`;
  const tw=ctx.measureText(t).width,px=h*1.2,W2=tw+px*2,H2=h,rx=cx-W2/2,ry=y-H2*.9;
  rrect(ctx,rx,ry,W2,H2,H2/2);
  const bg=ctx.createLinearGradient(rx,ry,rx,ry+H2); bg.addColorStop(0,'#b08820'); bg.addColorStop(1,'#7a5c10');
  ctx.fillStyle=bg; ctx.fill();
  // inner highlight
  ctx.save(); rrect(ctx,rx+2,ry+2,W2-4,H2*.45,H2/2); ctx.clip(); ctx.fillStyle='rgba(255,235,130,0.18)'; ctx.fill(); ctx.restore();
  rrect(ctx,rx,ry,W2,H2,H2/2); ctx.strokeStyle=GOLD_MID; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#fffaee'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(t,cx,ry+H2/2);
  ctx.restore();
}

function drawCTA(ctx,t,cx,cy,h){
  ctx.save(); ctx.font=`bold ${Math.round(h*.42)}px sans-serif`;
  const tw=ctx.measureText(t).width,W2=tw+h*3.4,H2=h,rx=cx-W2/2,ry=cy-H2/2;
  ctx.shadowColor='rgba(204,166,51,0.7)'; ctx.shadowBlur=40;
  rrect(ctx,rx,ry,W2,H2,H2/2);
  const bg=ctx.createLinearGradient(rx,ry,rx,ry+H2);
  bg.addColorStop(0,'#f0d848'); bg.addColorStop(0.45,GOLD); bg.addColorStop(1,GOLD_DK);
  ctx.fillStyle=bg; ctx.fill(); ctx.shadowBlur=0;
  // inner shine
  ctx.save(); rrect(ctx,rx,ry,W2,H2,H2/2); ctx.clip(); ctx.fillStyle='rgba(255,250,190,0.32)'; ctx.fillRect(rx,ry,W2,H2*.45); ctx.restore();
  rrect(ctx,rx,ry,W2,H2,H2/2); ctx.strokeStyle='rgba(255,245,160,0.55)'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillText(t,cx+1,cy+2);
  ctx.fillStyle=TXT_DARK; ctx.fillText(t,cx,cy);
  ctx.restore();
}

let LOGO_IMG=null;
async function drawBrand(ctx,x,y,sz,fz){
  if(!LOGO_IMG) LOGO_IMG=await loadImage(path.resolve(LOGO));
  ctx.save(); rrect(ctx,x,y,sz,sz,sz*.12); ctx.clip();
  ctx.drawImage(LOGO_IMG,0,0,1024,1024,x,y,sz,sz); ctx.restore();
  ctx.strokeStyle=GOLD_MID; ctx.lineWidth=1.5; rrect(ctx,x,y,sz,sz,sz*.12); ctx.stroke();
  ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.font=`bold ${fz}px serif`;
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillText('EbookGamez',x+sz+12,y+sz/2+2);
  ctx.fillStyle=GOLD; ctx.fillText('EbookGamez',x+sz+11,y+sz/2);
}

function corners(ctx,W,H,sz,pad){
  ctx.strokeStyle='rgba(204,166,51,0.5)'; ctx.lineWidth=2;
  const C=[[pad,pad],[W-pad,pad],[W-pad,H-pad],[pad,H-pad]];
  const D=[[1,1],[-1,1],[-1,-1],[1,-1]];
  for(let i=0;i<4;i++){
    const [cx,cy]=[C[i][0],C[i][1]],[dx,dy]=[D[i][0],D[i][1]];
    ctx.beginPath(); ctx.moveTo(cx,cy+dy*sz); ctx.lineTo(cx,cy); ctx.lineTo(cx+dx*sz,cy); ctx.stroke();
  }
}

function drawBg(ctx,img,W,H){
  const s=Math.max(W/img.width,H/img.height);
  ctx.drawImage(img,(W-img.width*s)/2,(H-img.height*s)/2,img.width*s,img.height*s);
}
function fitFz(ctx,t,mW,st,mn){
  let fz=st; ctx.font=`bold ${fz}px serif`;
  while(ctx.measureText(t).width>mW&&fz>mn){fz-=2;ctx.font=`bold ${fz}px serif`;}
  return fz;
}
async function save(cv,n){
  const s=fs.createWriteStream(`${OUT}/${n}`); cv.createPNGStream().pipe(s);
  await new Promise(r=>s.on('finish',r)); console.log('    ✓',n);
}

// ── Lighter overlays — let the art SHOW ───────────────────────────────────
async function makeLandscape(bg,ad,fn){
  const W=1200,H=628,cv=createCanvas(W,H),c=cv.getContext('2d');
  drawBg(c,bg,W,H);
  // Left panel — dark enough for text but not hiding art on right
  const gL=c.createLinearGradient(0,0,W,0);
  gL.addColorStop(0,'rgba(8,5,0,0.96)');
  gL.addColorStop(0.32,'rgba(8,5,0,0.90)');
  gL.addColorStop(0.52,'rgba(8,5,0,0.30)');
  gL.addColorStop(0.72,'rgba(8,5,0,0.05)');
  gL.addColorStop(1,'rgba(8,5,0,0)');
  c.fillStyle=gL; c.fillRect(0,0,W,H);
  // Bottom strip
  const gB=c.createLinearGradient(0,H*.55,0,H);
  gB.addColorStop(0,'rgba(8,5,0,0)');
  gB.addColorStop(0.5,'rgba(8,5,0,0.75)');
  gB.addColorStop(1,'rgba(8,5,0,0.95)');
  c.fillStyle=gB; c.fillRect(0,0,W,H);
  addGrain(c,W,H,14);
  const PAD=58,TW=W*.50;
  await drawBrand(c,PAD,26,50,27);
  const tagCX=PAD+(TW-PAD)*.40;
  drawTag(c,ad.tag,tagCX,H*.355,34);
  const fz=fitFz(c,ad.headline,TW-PAD-20,80,34);
  c.font=`bold ${fz}px serif`; goldText(c,ad.headline,PAD,H*.520,TW-PAD,'left');
  c.font=`${Math.round(fz*.40)}px sans-serif`;
  c.fillStyle='rgba(0,0,0,0.7)'; c.textAlign='left'; c.textBaseline='alphabetic';
  c.fillText(ad.sub,PAD+2,H*.520+fz*.64+2,TW-PAD);
  c.fillStyle=PARCH; c.fillText(ad.sub,PAD,H*.520+fz*.64,TW-PAD);
  ornament(c,tagCX,H*.520+fz*.90,(TW-PAD)*.75);
  c.font=`${Math.round(fz*.29)}px sans-serif`;
  c.fillStyle='rgba(232,213,181,0.65)'; c.textAlign='left'; c.textBaseline='alphabetic';
  c.fillText(ad.extra,PAD,H*.520+fz*1.16,TW-PAD);
  drawCTA(c,ad.cta,tagCX,H*.848,58);
  await save(cv,fn);
}

async function makeSquare(bg,ad,fn){
  const W=1200,H=1200,cv=createCanvas(W,H),c=cv.getContext('2d');
  drawBg(c,bg,W,H);
  // Top half: show the art. Bottom half: dark panel for text.
  const gB=c.createLinearGradient(0,H*.42,0,H);
  gB.addColorStop(0,'rgba(8,5,0,0)');
  gB.addColorStop(0.20,'rgba(8,5,0,0.88)');
  gB.addColorStop(0.35,'rgba(8,5,0,0.97)');
  gB.addColorStop(1,'rgba(8,5,0,1)');
  c.fillStyle=gB; c.fillRect(0,0,W,H);
  // Subtle top vignette
  const gT=c.createLinearGradient(0,0,0,H*.18);
  gT.addColorStop(0,'rgba(0,0,0,0.45)'); gT.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=gT; c.fillRect(0,0,W,H);
  addGrain(c,W,H,14);
  const CX=W/2,PAD=68;
  await drawBrand(c,PAD,44,54,29);
  corners(c,W,H,42,22);
  drawTag(c,ad.tag,CX,H*.600,36);
  const fz=fitFz(c,ad.headline,W-PAD*2,100,42);
  c.font=`bold ${fz}px serif`; goldText(c,ad.headline,CX,H*.720,W-PAD*2,'center');
  c.font=`${Math.round(fz*.39)}px sans-serif`;
  c.fillStyle='rgba(0,0,0,0.7)'; c.textAlign='center'; c.textBaseline='alphabetic';
  c.fillText(ad.sub,CX+2,H*.720+fz*.58+2,W-PAD*2);
  c.fillStyle=PARCH; c.fillText(ad.sub,CX,H*.720+fz*.58,W-PAD*2);
  ornament(c,CX,H*.720+fz*.84,W-PAD*2-80);
  c.font=`${Math.round(fz*.30)}px sans-serif`;
  c.fillStyle='rgba(232,213,181,0.65)'; c.textAlign='center'; c.textBaseline='alphabetic';
  c.fillText(ad.extra,CX,H*.720+fz*1.10,W-PAD*2);
  drawCTA(c,ad.cta,CX,H*.912,68);
  await save(cv,fn);
}

async function makePortrait(bg,ad,fn){
  const W=960,H=1200,cv=createCanvas(W,H),c=cv.getContext('2d');
  drawBg(c,bg,W,H);
  const gB=c.createLinearGradient(0,H*.40,0,H);
  gB.addColorStop(0,'rgba(8,5,0,0)');
  gB.addColorStop(0.20,'rgba(8,5,0,0.88)');
  gB.addColorStop(0.35,'rgba(8,5,0,0.97)');
  gB.addColorStop(1,'rgba(8,5,0,1)');
  c.fillStyle=gB; c.fillRect(0,0,W,H);
  const gT=c.createLinearGradient(0,0,0,H*.14);
  gT.addColorStop(0,'rgba(0,0,0,0.4)'); gT.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=gT; c.fillRect(0,0,W,H);
  addGrain(c,W,H,14);
  const CX=W/2,PAD=55;
  await drawBrand(c,PAD,36,48,25);
  corners(c,W,H,36,18);
  drawTag(c,ad.tag,CX,H*.598,34);
  const fz=fitFz(c,ad.headline,W-PAD*2,90,36);
  c.font=`bold ${fz}px serif`; goldText(c,ad.headline,CX,H*.718,W-PAD*2,'center');
  c.font=`${Math.round(fz*.39)}px sans-serif`;
  c.fillStyle='rgba(0,0,0,0.7)'; c.textAlign='center'; c.textBaseline='alphabetic';
  c.fillText(ad.sub,CX+2,H*.718+fz*.58+2,W-PAD*2);
  c.fillStyle=PARCH; c.fillText(ad.sub,CX,H*.718+fz*.58,W-PAD*2);
  ornament(c,CX,H*.718+fz*.84,W-PAD*2-60);
  c.font=`${Math.round(fz*.30)}px sans-serif`;
  c.fillStyle='rgba(232,213,181,0.65)'; c.textAlign='center'; c.textBaseline='alphabetic';
  c.fillText(ad.extra,CX,H*.718+fz*1.10,W-PAD*2);
  drawCTA(c,ad.cta,CX,H*.910,62);
  await save(cv,fn);
}

// ── MAIN ──────────────────────────────────────────────────────────────────
const tempIds=[];
try {
  for (const c of CAMPAIGNS) {
    console.log(`\n═══ ${c.key} ═══`);
    const bgPath=`${OUT}/bg-v3-${c.key}.png`;

    const id=await createDraft(c); tempIds.push(id);
    console.log(`  Draft id=${id}`);
    let rawUrl;
    try {
      await triggerAndWait(id);
      const urls=await getDraftUrls(id);
      rawUrl=urls.background_url||urls.cover_url;
      if(!rawUrl) throw new Error('No URL in DB');
      const lf=rawUrl.startsWith('/')?rawUrl.slice(1):rawUrl;
      if(!fs.existsSync(lf)) throw new Error(`Not found: ${lf}`);
      fs.copyFileSync(lf,bgPath);
      console.log(`  ✓ Background saved`);
    } finally {
      await deleteDraft(id).catch(()=>{});
    }

    const bgImg=await loadImage(bgPath);
    await makeLandscape(bgImg,c,`v3-${c.key}-landscape-1200x628.png`);
    await makeSquare(bgImg,c,`v3-${c.key}-square-1200x1200.png`);
    await makePortrait(bgImg,c,`v3-${c.key}-portrait-960x1200.png`);
  }
} finally {
  await db.end();
}

// Pack into a fresh-named zip
const files=[
  'v3-reading-pass-landscape-1200x628.png','v3-reading-pass-square-1200x1200.png','v3-reading-pass-portrait-960x1200.png',
  'v3-gaming-guides-landscape-1200x628.png','v3-gaming-guides-square-1200x1200.png','v3-gaming-guides-portrait-960x1200.png',
  'v3-ebook-store-landscape-1200x628.png','v3-ebook-store-square-1200x1200.png','v3-ebook-store-portrait-960x1200.png',
  'ebookgamez-logo-square-1200x1200.png','ebookgamez-logo-horizontal-1200x300.png',
].filter(f=>fs.existsSync(`${OUT}/${f}`));
execSync(`cd ${OUT} && zip -j ebookgamez-google-ads-v3.zip ${files.join(' ')}`,{stdio:'inherit'});
console.log('\n✅ Done — ebookgamez-google-ads-v3.zip');
