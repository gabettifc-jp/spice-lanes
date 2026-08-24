// 升に収まっているかの検査。**落ちたら書かない**（makeplay の QC の型）
import { chromium } from 'playwright';
import fs from 'node:fs';
const [file, rows, cols] = [process.argv[2], +(process.argv[3]||3), +(process.argv[4]||3)];
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('data:text/html,<b>');
const r = await p.evaluate(async ({src, rows, cols}) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.width, H = img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  const bg = [px[0], px[1], px[2]];
  const ink = (x, y) => { const i = (y*W+x)*4;
    return Math.abs(px[i]-bg[0]) + Math.abs(px[i+1]-bg[1]) + Math.abs(px[i+2]-bg[2]) > 165; };
  const CW = W/cols, CH = H/rows, out = [];
  for (let r0 = 0; r0 < rows; r0++) for (let c0 = 0; c0 < cols; c0++) {
    const x0 = Math.round(c0*CW), y0 = Math.round(r0*CH);
    let touch = [], any = false;
    let bx0 = CW, by0 = CH, bx1 = -1, by1 = -1;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (!ink(x0+x, y0+y)) continue;
      any = true;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    if (!any) { out.push({ r:r0, c:c0, empty:true }); continue; }
    const M = 2;   // 端から2画素以内に墨があれば「接している」
    if (bx0 <= M) touch.push('左'); if (bx1 >= CW-1-M) touch.push('右');
    if (by0 <= M) touch.push('上'); if (by1 >= CH-1-M) touch.push('下');
    const fill = Math.max((bx1-bx0+1)/CW, (by1-by0+1)/CH);
    out.push({ r:r0, c:c0, touch, fill:+fill.toFixed(2) });
  }
  return { W, H, CW:Math.round(CW), out };
}, { src:'data:image/png;base64,'+fs.readFileSync(file).toString('base64'), rows, cols });
await b.close();

const bad = r.out.filter(o => o.touch && o.touch.length);
const big = r.out.filter(o => o.fill > 0.80);
console.log(`${file}  ${r.W}x${r.H}  一升 ${r.CW}px`);
for (const o of r.out) {
  if (o.empty) { console.log(`  [${o.r},${o.c}] 空`); continue; }
  const ng = o.touch.length ? `**${o.touch.join('・')}に接している**` : (o.fill > 0.80 ? '端に寄りすぎ' : '');
  console.log(`  [${o.r},${o.c}] 占有 ${(o.fill*100).toFixed(0)}%  ${ng}`);
}
console.log(bad.length
  ? `\nQC 落ちた ── ${bad.length}/${r.out.length} 升が端に接している（切れている）。**書き出さない**`
  : `\nQC 通った ── どの升も端に接していない`);
process.exit(bad.length ? 1 : 0);
