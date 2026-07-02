import OpenAI from 'openai';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const OUT = '/home/runner/workspace/exports';
fs.mkdirSync(OUT, { recursive: true });

// ── WEBSITE-MATCHED PALETTE ─────────────────────────────────────────────────
const GOLD_HL  = '#fff8cc';
const GOLD_MID = '#e8c040';
const GOLD     = '#cca633';
const GOLD_DK  = '#9a7018';
const GOLD_DM  = '#7a5810';
const PARCH    = '#e8d5b5';
const TXT_DARK = '#1a1005';
const LOGO_SRC = 'uploads/covers/ai-overlay-551-1773455035159.png';

// ── THREE PRECISE ART-DIRECTED PROMPTS ────────────────────────────────────
// Each prompt locks the palette to: near-black + antique gold ONLY
const ADS = [
  {
    key: 'reading-pass',
    size: '1536x1024',  // landscape
    prompt: `Cinematic photorealistic painting. A vast, cathedral-like private library at midnight. Towering dark mahogany bookshelves reach a vaulted ceiling painted black. A single deep leather armchair sits before a roaring fireplace whose flames cast the ONLY light in the scene — warm antique gold and amber light glowing across the spines of hundreds of leather-bound books. A small ornate side table holds a crystal glass and open book. The room is dramatically dark except for the golden firelight. Extreme depth of field, rich cinematic shadows. STRICT COLOR PALETTE: deep black backgrounds, near-black dark mahogany browns, ONLY warm antique gold (#cca633) and amber highlights from firelight. NO blue, NO green, NO red, NO purple, NO bright colors of any kind. Only darkness and gold warmth. NO TEXT. Horizontal widescreen composition, space on left third for text overlay.`,
    headline: 'Read Unlimited Books',
    sub: 'Starting at $4.99 / month',
    tag: 'READING PASS',
    cta: 'Start Your Free Trial',
    extra: 'DRM-Free  ·  Read & Keep  ·  7-Day Free Trial',
    finalName: 'reading-pass-hero-1200x628.png',
    finalW: 1200, finalH: 628,
  },
  {
    key: 'gaming-guides',
    size: '1024x1024',  // square
    prompt: `Cinematic photorealistic painting. An ancient war room and map chamber deep inside a dark stone fortress. A massive weathered map of a fantasy realm is spread across a heavy dark oak table. Antique brass compass, golden quill, ornate candelabra dripping with wax — all illuminated by three golden candle flames. The stone walls are in near-total darkness. A heavy leather-bound tome lies open beside the map. Atmospheric candlelight creates a pool of warm gold light on the table while everything beyond fades to pure black. STRICT COLOR PALETTE: near-black stone and shadows, dark aged oak, ONLY antique gold (#cca633) and warm amber from candle flames. NO blue glow, NO fantasy purple, NO bright greens or reds. Only deep darkness and warm gold candlelight. Rich painterly texture. NO TEXT. Centered composition, space at bottom quarter for text.`,
    headline: 'Master Any Game',
    sub: 'Expert walkthroughs & strategies',
    tag: 'FREE GAMING GUIDES',
    cta: 'Read Free Guides',
    extra: 'Walkthroughs  ·  Tips  ·  Secrets  ·  Speedruns',
    finalName: 'gaming-guides-hero-1200x1200.png',
    finalW: 1200, finalH: 1200,
  },
  {
    key: 'ebook-store',
    size: '1024x1024',  // square → portrait
    prompt: `Cinematic photorealistic painting. A single ancient leather-bound book lies open on a dark mahogany reading desk. The open pages GLOW with warm golden-white light as if illuminated from within, like a portal to another world. The light radiates upward, casting a warm antique gold light on nothing except wisps of dust particles in the air above. The surrounding room is in near-total darkness — old wooden desk edges barely visible. The book is the ONLY subject. STRICT COLOR PALETTE: pure black backgrounds, dark mahogany wood, ONLY warm antique gold (#cca633) light emanating from book pages, parchment cream for the pages themselves. NO other colors. NO blue, NO purple, NO green, NO red. Extreme cinematic contrast between the dark room and the glowing golden book. Overhead slight angle shot. NO TEXT. Space at bottom third completely dark for text overlay.`,
    headline: 'Your Next Read Awaits',
    sub: 'Fiction, Non-Fiction & More',
    tag: '500+ EBOOKS',
    cta: 'Download Instantly',
    extra: 'From $1.99  ·  DRM-Free  ·  Keep Forever',
    finalName: 'ebook-store-hero-1200x1200.png',
    finalW: 1200, finalH: 1200,
  },
];

// ── CANVAS HELPERS ──────────────────────────────────────────────────────────
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

function addGrain(ctx, W, H, s) {
  const id = ctx.getImageData(0,0,W,H), d = id.data;
  for (let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*s;d[i]=Math.max(0,Math.min(255,d[i]+n));d[i+1]=Math.max(0,Math.min(255,d[i+1]+n));d[i+2]=Math.max(0,Math.min(255,d[i+2]+n));}
  ctx.putImageData(id,0,0);
}

function goldText(ctx, text, x, y, maxW, align) {
  if(!align) align='left'; ctx.textAlign=align; ctx.textBaseline='alphabetic';
  ctx.save(); ctx.filter='blur(16px)'; ctx.globalAlpha=0.5; ctx.fillStyle=GOLD_MID;
  ctx.fillText(text,x,y,maxW); ctx.restore();
  ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillText(text,x+3,y+4,maxW);
  const asc=Math.abs(ctx.measureText('M').actualBoundingBoxAscent)||60;
  const gy=ctx.createLinearGradient(x,y-asc,x,y);
  gy.addColorStop(0,GOLD_HL); gy.addColorStop(0.25,GOLD_MID); gy.addColorStop(0.55,GOLD);
  gy.addColorStop(0.82,GOLD_DK); gy.addColorStop(1,GOLD_DM);
  ctx.fillStyle=gy; ctx.fillText(text,x,y,maxW);
}

function ornament(ctx, cx, y, w) {
  const hw=w/2,dSz=5;
  const gl=ctx.createLinearGradient(cx-hw,y,cx+hw,y);
  gl.addColorStop(0,'rgba(204,166,51,0)'); gl.addColorStop(0.15,'rgba(204,166,51,0.9)');
  gl.addColorStop(0.46,'rgba(204,166,51,0.9)'); gl.addColorStop(0.5,'rgba(204,166,51,0)');
  gl.addColorStop(0.54,'rgba(204,166,51,0.9)'); gl.addColorStop(0.85,'rgba(204,166,51,0.9)');
  gl.addColorStop(1,'rgba(204,166,51,0)');
  ctx.fillStyle=gl; ctx.fillRect(cx-hw,y-0.75,w,1.5);
  ctx.beginPath(); ctx.moveTo(cx,y-dSz); ctx.lineTo(cx+dSz,y); ctx.lineTo(cx,y+dSz); ctx.lineTo(cx-dSz,y); ctx.closePath();
  const dg=ctx.createRadialGradient(cx,y,0,cx,y,dSz); dg.addColorStop(0,GOLD_HL); dg.addColorStop(1,GOLD);
  ctx.fillStyle=dg; ctx.fill();
}

function drawTag(ctx, text, cx, y, h) {
  ctx.save(); ctx.font=`bold ${Math.round(h*.46)}px sans-serif`;
  const tw=ctx.measureText(text).width,padX=h*1.1,W2=tw+padX*2,H2=h;
  const rx=cx-W2/2,ry=y-H2*.9;
  rrect(ctx,rx,ry,W2,H2,H2/2);
  const bg=ctx.createLinearGradient(rx,ry,rx,ry+H2);
  bg.addColorStop(0,'#a07818'); bg.addColorStop(1,'#6e5010');
  ctx.fillStyle=bg; ctx.fill();
  ctx.save(); rrect(ctx,rx+2,ry+2,W2-4,H2/2,H2/2); ctx.clip();
  ctx.fillStyle='rgba(255,230,120,0.12)'; ctx.fill(); ctx.restore();
  rrect(ctx,rx,ry,W2,H2,H2/2); ctx.strokeStyle=GOLD; ctx.lineWidth=1.2; ctx.stroke();
  ctx.fillStyle='#fff8e0'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,cx,ry+H2/2); ctx.restore();
}

function drawCTA(ctx, text, cx, cy, h) {
  ctx.save(); ctx.font=`bold ${Math.round(h*.42)}px sans-serif`;
  const tw=ctx.measureText(text).width,padX=h*1.6,W2=tw+padX*2,H2=h;
  const rx=cx-W2/2,ry=cy-H2/2;
  ctx.shadowColor='rgba(204,166,51,0.65)'; ctx.shadowBlur=32;
  rrect(ctx,rx,ry,W2,H2,H2/2);
  const bg=ctx.createLinearGradient(rx,ry,rx,ry+H2);
  bg.addColorStop(0,'#eed045'); bg.addColorStop(0.45,GOLD); bg.addColorStop(1,GOLD_DK);
  ctx.fillStyle=bg; ctx.fill(); ctx.shadowBlur=0;
  ctx.save(); rrect(ctx,rx,ry,W2,H2,H2/2); ctx.clip();
  ctx.fillStyle='rgba(255,248,180,0.30)'; ctx.fillRect(rx,ry,W2,H2*.44); ctx.restore();
  rrect(ctx,rx,ry,W2,H2,H2/2); ctx.strokeStyle='rgba(255,240,150,0.5)'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillText(text,cx+1,cy+2);
  ctx.fillStyle=TXT_DARK; ctx.fillText(text,cx,cy); ctx.restore();
}

async function drawBrand(ctx, x, y, sz, fz) {
  const logo=await loadImage(path.resolve(LOGO_SRC));
  ctx.save(); rrect(ctx,x,y,sz,sz,sz*.1); ctx.clip();
  ctx.drawImage(logo,0,0,1024,1024,x,y,sz,sz); ctx.restore();
  ctx.strokeStyle=GOLD; ctx.lineWidth=1.2; rrect(ctx,x,y,sz,sz,sz*.1); ctx.stroke();
  ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.font=`bold ${fz}px serif`;
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillText('EbookGamez',x+sz+11,y+sz/2+2);
  ctx.fillStyle=GOLD; ctx.fillText('EbookGamez',x+sz+10,y+sz/2);
}

function cornerAccents(ctx, W, H, sz, pad) {
  ctx.strokeStyle='rgba(204,166,51,0.45)'; ctx.lineWidth=1.5;
  const corners=[[pad,pad],[W-pad,pad],[W-pad,H-pad],[pad,H-pad]];
  const dirs=[[1,1],[-1,1],[-1,-1],[1,-1]];
  for(let i=0;i<4;i++){
    const cx=corners[i][0],cy=corners[i][1],dx=dirs[i][0],dy=dirs[i][1];
    ctx.beginPath(); ctx.moveTo(cx,cy+dy*sz); ctx.lineTo(cx,cy); ctx.lineTo(cx+dx*sz,cy); ctx.stroke();
  }
}

function fitFz(ctx, text, maxW, start, min) {
  let fz=start; ctx.font=`bold ${fz}px serif`;
  while(ctx.measureText(text).width>maxW&&fz>min){fz-=2;ctx.font=`bold ${fz}px serif`;}
  return fz;
}

async function saveCanvas(cv, name) {
  const s=fs.createWriteStream(`${OUT}/${name}`);
  cv.createPNGStream().pipe(s);
  await new Promise(r=>s.on('finish',r));
  console.log('  ✓ saved:', name);
}

// ── COMPOSITE: LANDSCAPE (text on left panel) ───────────────────────────────
async function compositeLandscape(bgBuf, ad) {
  const W=ad.finalW, H=ad.finalH;
  const cv=createCanvas(W,H), ctx=cv.getContext('2d');
  const bg=await loadImage(bgBuf);
  const scale=Math.max(W/bg.width,H/bg.height);
  ctx.drawImage(bg,(W-bg.width*scale)/2,(H-bg.height*scale)/2,bg.width*scale,bg.height*scale);

  // strong left-panel overlay so text is always readable
  const gL=ctx.createLinearGradient(0,0,W,0);
  gL.addColorStop(0,'rgba(6,3,0,0.97)'); gL.addColorStop(0.38,'rgba(6,3,0,0.94)');
  gL.addColorStop(0.58,'rgba(6,3,0,0.48)'); gL.addColorStop(0.80,'rgba(6,3,0,0.08)');
  gL.addColorStop(1,'rgba(6,3,0,0)');
  ctx.fillStyle=gL; ctx.fillRect(0,0,W,H);

  // top/bottom vignette
  const gV=ctx.createLinearGradient(0,0,0,H);
  gV.addColorStop(0,'rgba(0,0,0,0.5)'); gV.addColorStop(0.25,'rgba(0,0,0,0)');
  gV.addColorStop(0.75,'rgba(0,0,0,0)'); gV.addColorStop(1,'rgba(0,0,0,0.6)');
  ctx.fillStyle=gV; ctx.fillRect(0,0,W,H);

  addGrain(ctx,W,H,20);

  const PAD=58, TW=W*0.52;
  await drawBrand(ctx,PAD,24,52,28);
  drawTag(ctx,ad.tag,PAD+(TW-PAD)*0.38,H*0.35,33);

  const fz=fitFz(ctx,ad.headline,TW-PAD-20,78,34);
  ctx.font=`bold ${fz}px serif`;
  goldText(ctx,ad.headline,PAD,H*0.515,TW-PAD,'left');

  ctx.font=`${Math.round(fz*.41)}px sans-serif`;
  ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillText(ad.sub,PAD+2,H*0.515+fz*.62+2,TW-PAD);
  ctx.fillStyle=PARCH; ctx.fillText(ad.sub,PAD,H*0.515+fz*.62,TW-PAD);

  ornament(ctx,PAD+(TW-PAD)*.38,H*0.515+fz*.92,(TW-PAD)*.72);

  ctx.font=`${Math.round(fz*.30)}px sans-serif`; ctx.fillStyle='rgba(232,213,181,0.62)';
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillText(ad.extra,PAD,H*0.515+fz*1.18,TW-PAD);

  drawCTA(ctx,ad.cta,PAD+(TW-PAD)*.38,H*.845,58);
  await saveCanvas(cv,ad.finalName);
}

// ── COMPOSITE: SQUARE/PORTRAIT (text at bottom) ─────────────────────────────
async function compositeSquare(bgBuf, ad) {
  const W=ad.finalW, H=ad.finalH;
  const cv=createCanvas(W,H), ctx=cv.getContext('2d');
  const bg=await loadImage(bgBuf);
  const scale=Math.max(W/bg.width,H/bg.height);
  ctx.drawImage(bg,(W-bg.width*scale)/2,(H-bg.height*scale)/2,bg.width*scale,bg.height*scale);

  // gradient from 40% down — dark base for text
  const gB=ctx.createLinearGradient(0,H*.35,0,H);
  gB.addColorStop(0,'rgba(5,3,0,0)'); gB.addColorStop(0.2,'rgba(5,3,0,0.88)');
  gB.addColorStop(1,'rgba(5,3,0,0.98)');
  ctx.fillStyle=gB; ctx.fillRect(0,0,W,H);

  // top vignette
  const gT=ctx.createLinearGradient(0,0,0,H*.18);
  gT.addColorStop(0,'rgba(0,0,0,0.5)'); gT.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gT; ctx.fillRect(0,0,W,H);

  addGrain(ctx,W,H,20);

  const CX=W/2, PAD=68;
  await drawBrand(ctx,PAD,44,54,29);
  cornerAccents(ctx,W,H,40,20);
  drawTag(ctx,ad.tag,CX,H*.58,35);

  const fz=fitFz(ctx,ad.headline,W-PAD*2,98,40);
  ctx.font=`bold ${fz}px serif`;
  goldText(ctx,ad.headline,CX,H*.715,W-PAD*2,'center');

  ctx.font=`${Math.round(fz*.40)}px sans-serif`;
  ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText(ad.sub,CX+2,H*.715+fz*.56+2,W-PAD*2);
  ctx.fillStyle=PARCH; ctx.fillText(ad.sub,CX,H*.715+fz*.56,W-PAD*2);

  ornament(ctx,CX,H*.715+fz*.83,W-PAD*2-100);

  ctx.font=`${Math.round(fz*.31)}px sans-serif`; ctx.fillStyle='rgba(232,213,181,0.60)';
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText(ad.extra,CX,H*.715+fz*1.08,W-PAD*2);

  drawCTA(ctx,ad.cta,CX,H*.91,66);
  await saveCanvas(cv,ad.finalName);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
for (const ad of ADS) {
  console.log(`\n[${ad.key}] Generating AI background (${ad.size})...`);
  let bgBuf;
  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: ad.prompt,
      size: ad.size,
      quality: 'high',
    });
    bgBuf = Buffer.from(resp.data[0].b64_json, 'base64');
    fs.writeFileSync(`${OUT}/bg-raw-${ad.key}.png`, bgBuf);
    console.log(`  ✓ AI background generated`);
  } catch (err) {
    console.error(`  ✗ AI gen failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`  Compositing...`);
  if (ad.key === 'reading-pass') {
    await compositeLandscape(bgBuf, ad);
  } else {
    await compositeSquare(bgBuf, ad);
  }
}

console.log('\nAll 3 premium ads complete!');
