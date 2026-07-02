const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const GOLD    = '#cca633';
const GOLD2   = '#f0c040';
const ORANGE  = '#e85d04';
const PARCH   = '#e8d5b5';
const WHITE   = '#ffffff';
const OUT     = '/home/runner/workspace/exports';

fs.mkdirSync(OUT, { recursive: true });

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawIcon(ctx, cx, cy, size) {
  const sq=Math.round(size*.42), gap=Math.round(size*.16);
  const ox=cx-sq-gap/2, oy=cy-sq-gap/2, r=Math.round(sq*.15);
  ctx.fillStyle=ORANGE;
  [[ox,oy],[ox+sq+gap,oy],[ox+sq+gap,oy+sq+gap]].forEach(([x,y])=>{ rrect(ctx,x,y,sq,sq,r); ctx.fill(); });
}

function drawBrand(ctx, x, y, iconSize, fontSize, align='left') {
  drawIcon(ctx, align==='center' ? x : x + iconSize/2, y + iconSize/2 - 2, iconSize);
  const iconRight = align==='center' ? x + iconSize*.9 : x + iconSize + 10;
  ctx.textBaseline='middle';
  ctx.textAlign='left';
  ctx.font=`bold ${fontSize}px serif`;
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillText('EbookGamez', iconRight+2, y+iconSize/2+2);
  ctx.fillStyle=GOLD; ctx.fillText('EbookGamez', iconRight, y+iconSize/2);
}

function shadow(ctx, fn) {
  ctx.shadowColor='rgba(0,0,0,0.85)'; ctx.shadowBlur=18; ctx.shadowOffsetX=2; ctx.shadowOffsetY=3;
  fn();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
}

function drawTag(ctx, text, x, y, h=36) {
  ctx.font=`bold ${h*.55}px sans-serif`;
  const w=ctx.measureText(text).width+h*1.2;
  rrect(ctx, x, y-h*.8, w, h, h/2);
  ctx.fillStyle=ORANGE; ctx.fill();
  ctx.fillStyle=WHITE; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(text, x+h*.6, y-h*.8+h/2);
  return w;
}

function drawCTA(ctx, text, cx, cy, h=56) {
  ctx.font=`bold ${h*.48}px sans-serif`;
  const w=ctx.measureText(text).width+h*1.6;
  const x=cx-w/2, y=cy-h/2;
  // glow
  ctx.shadowColor='rgba(232,93,4,0.6)'; ctx.shadowBlur=25;
  rrect(ctx, x, y, w, h, h/2); ctx.fillStyle=ORANGE; ctx.fill();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0;
  // text
  ctx.fillStyle=WHITE; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text, cx, cy);
}

function drawGoldLine(ctx, x, y, w) {
  const g=ctx.createLinearGradient(x,y,x+w,y);
  g.addColorStop(0,'rgba(204,166,51,0)'); g.addColorStop(.2,GOLD); g.addColorStop(.8,GOLD); g.addColorStop(1,'rgba(204,166,51,0)');
  ctx.fillStyle=g; ctx.fillRect(x,y,w,1.5);
}

async function bgFill(ctx, imgPath, W, H) {
  const img=await loadImage(path.resolve(imgPath));
  const scale=Math.max(W/img.width, H/img.height);
  const sw=img.width*scale, sh=img.height*scale;
  ctx.drawImage(img, (W-sw)/2, (H-sh)/2, sw, sh);
}

// ─── LANDSCAPE 1200×628 ──────────────────────────────────────────────────────
async function makeLandscape(outName, bgPath, tag, headline, sub, cta, extra) {
  const W=1200, H=628;
  const canvas=createCanvas(W,H);
  const ctx=canvas.getContext('2d');

  await bgFill(ctx, bgPath, W, H);

  // Gradient panel left → transparent at 55%
  const g=ctx.createLinearGradient(0,0,W*.62,0);
  g.addColorStop(0,'rgba(8,5,2,0.97)');
  g.addColorStop(.6,'rgba(8,5,2,0.88)');
  g.addColorStop(1,'rgba(8,5,2,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // also darken top+bottom
  const vg=ctx.createLinearGradient(0,0,0,H);
  vg.addColorStop(0,'rgba(0,0,0,0.45)'); vg.addColorStop(.5,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);

  const PAD=60, TW=W*.54;

  // brand
  drawBrand(ctx, PAD, 38, 38, 28);

  // tag
  drawTag(ctx, tag, PAD, H*.36, 34);

  // headline
  const hl_y = H*.5;
  let fs=82;
  ctx.font=`bold ${fs}px serif`;
  while(ctx.measureText(headline).width > TW-PAD && fs>36) { fs-=2; ctx.font=`bold ${fs}px serif`; }
  shadow(ctx, ()=>{
    const gg=ctx.createLinearGradient(PAD, hl_y-fs, PAD, hl_y);
    gg.addColorStop(0,GOLD2); gg.addColorStop(1,GOLD);
    ctx.fillStyle=gg; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.fillText(headline, PAD, hl_y, TW-PAD);
  });

  // sub
  shadow(ctx, ()=>{
    ctx.font=`${fs*.42}px sans-serif`; ctx.fillStyle=PARCH;
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.fillText(sub, PAD, hl_y+fs*.58, TW-PAD);
  });

  drawGoldLine(ctx, PAD, hl_y+fs*.8, TW*.7);

  // extra
  ctx.font=`${fs*.34}px sans-serif`; ctx.fillStyle='rgba(232,213,181,0.72)';
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillText(extra, PAD, hl_y+fs*1.06, TW-PAD);

  // CTA
  drawCTA(ctx, cta, PAD + (TW-PAD)*.36, H*.84, 58);

  const out=fs.createWriteStream(`${OUT}/${outName}`);
  canvas.createPNGStream().pipe(out);
  await new Promise(r=>out.on('finish',r));
  console.log('✓', outName);
}

// ─── SQUARE 1200×1200 ────────────────────────────────────────────────────────
async function makeSquare(outName, bgPath, tag, headline, sub, cta, extra) {
  const W=1200, H=1200;
  const canvas=createCanvas(W,H);
  const ctx=canvas.getContext('2d');

  await bgFill(ctx, bgPath, W, H);

  // bottom dark panel
  const g=ctx.createLinearGradient(0,H*.42,0,H);
  g.addColorStop(0,'rgba(5,3,1,0)');
  g.addColorStop(.3,'rgba(5,3,1,0.82)');
  g.addColorStop(1,'rgba(5,3,1,0.97)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // top vignette
  const tg=ctx.createLinearGradient(0,0,0,H*.25);
  tg.addColorStop(0,'rgba(0,0,0,0.5)'); tg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=tg; ctx.fillRect(0,0,W,H);

  const CX=W/2, PAD=70;

  // brand top-left
  drawBrand(ctx, PAD, 42, 42, 30);

  // tag
  const tw=drawTag(ctx, tag, CX-100, H*.58, 36);

  // headline
  let fs=96;
  ctx.font=`bold ${fs}px serif`;
  while(ctx.measureText(headline).width > W-PAD*2 && fs>40) { fs-=2; ctx.font=`bold ${fs}px serif`; }
  const hl_y=H*.72;
  shadow(ctx, ()=>{
    const gg=ctx.createLinearGradient(CX,hl_y-fs,CX,hl_y);
    gg.addColorStop(0,GOLD2); gg.addColorStop(1,GOLD);
    ctx.fillStyle=gg; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillText(headline, CX, hl_y, W-PAD*2);
  });

  shadow(ctx, ()=>{
    ctx.font=`${fs*.38}px sans-serif`; ctx.fillStyle=PARCH;
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillText(sub, CX, hl_y+fs*.52, W-PAD*2);
  });

  drawGoldLine(ctx, PAD+60, hl_y+fs*.72, W-PAD*2-120);

  ctx.font=`${fs*.3}px sans-serif`; ctx.fillStyle='rgba(232,213,181,0.68)';
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText(extra, CX, hl_y+fs*.98, W-PAD*2);

  drawCTA(ctx, cta, CX, H*.92, 66);

  const out=fs.createWriteStream(`${OUT}/${outName}`);
  canvas.createPNGStream().pipe(out);
  await new Promise(r=>out.on('finish',r));
  console.log('✓', outName);
}

// ─── PORTRAIT 960×1200 ───────────────────────────────────────────────────────
async function makePortrait(outName, bgPath, tag, headline, sub, cta, extra) {
  const W=960, H=1200;
  const canvas=createCanvas(W,H);
  const ctx=canvas.getContext('2d');

  await bgFill(ctx, bgPath, W, H);

  // bottom gradient
  const g=ctx.createLinearGradient(0,H*.44,0,H);
  g.addColorStop(0,'rgba(5,3,1,0)');
  g.addColorStop(.28,'rgba(5,3,1,0.85)');
  g.addColorStop(1,'rgba(5,3,1,0.97)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  const tg=ctx.createLinearGradient(0,0,0,H*.2);
  tg.addColorStop(0,'rgba(0,0,0,0.55)'); tg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=tg; ctx.fillRect(0,0,W,H);

  const CX=W/2, PAD=55;

  drawBrand(ctx, PAD, 40, 40, 28);

  drawTag(ctx, tag, CX-90, H*.56, 34);

  let fs=88;
  ctx.font=`bold ${fs}px serif`;
  while(ctx.measureText(headline).width > W-PAD*2 && fs>38) { fs-=2; ctx.font=`bold ${fs}px serif`; }
  const hl_y=H*.7;
  shadow(ctx, ()=>{
    const gg=ctx.createLinearGradient(CX,hl_y-fs,CX,hl_y);
    gg.addColorStop(0,GOLD2); gg.addColorStop(1,GOLD);
    ctx.fillStyle=gg; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillText(headline, CX, hl_y, W-PAD*2);
  });

  shadow(ctx, ()=>{
    ctx.font=`${fs*.38}px sans-serif`; ctx.fillStyle=PARCH;
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillText(sub, CX, hl_y+fs*.52, W-PAD*2);
  });

  drawGoldLine(ctx, PAD+40, hl_y+fs*.72, W-PAD*2-80);

  ctx.font=`${fs*.3}px sans-serif`; ctx.fillStyle='rgba(232,213,181,0.68)';
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText(extra, CX, hl_y+fs*.98, W-PAD*2);

  drawCTA(ctx, cta, CX, H*.89, 62);

  const out=fs.createWriteStream(`${OUT}/${outName}`);
  canvas.createPNGStream().pipe(out);
  await new Promise(r=>out.on('finish',r));
  console.log('✓', outName);
}

// ─── RUN ALL ─────────────────────────────────────────────────────────────────
const COVERS = {
  readingPass : 'uploads/covers/ebook-36-cover.png',
  gaming      : 'uploads/covers/ebook-26-cover.png',
  ebookStore  : 'uploads/covers/ai-bg-atmospheric-cinema-1769654871123.png',
};
const GROUPS = [
  { key:'reading-pass',  bg: COVERS.readingPass,
    tag:'READING PASS',         headline:'Read Unlimited Books',
    sub:'Starting at $4.99 / month',   cta:'Start Your Free Trial',
    extra:'DRM-Free  ·  Read & Keep  ·  7-Day Free Trial' },
  { key:'gaming-guides', bg: COVERS.gaming,
    tag:'FREE GAMING GUIDES',    headline:'Master Any Game',
    sub:'Expert walkthroughs & strategies', cta:'Read Free Guides',
    extra:'Walkthroughs  ·  Tips  ·  Secrets  ·  Speedruns' },
  { key:'ebook-store',   bg: COVERS.ebookStore,
    tag:'500+ EBOOKS',           headline:'Your Next Read Awaits',
    sub:'Fiction, Non-Fiction & More',  cta:'Download Instantly',
    extra:'From $1.99  ·  DRM-Free  ·  Keep Forever' },
];

(async () => {
  for (const g of GROUPS) {
    await makeLandscape(`${g.key}-landscape-1200x628.png`,  g.bg, g.tag, g.headline, g.sub, g.cta, g.extra);
    await makeSquare   (`${g.key}-square-1200x1200.png`,    g.bg, g.tag, g.headline, g.sub, g.cta, g.extra);
    await makePortrait (`${g.key}-portrait-960x1200.png`,   g.bg, g.tag, g.headline, g.sub, g.cta, g.extra);
  }
  console.log('\nAll 9 done!');
})();
