/* prototype/index.html の相対パスの素材を、一枚に埋め込む。
   builds/ に残す通し版を作るため。使い方：
     node tools/inline.mjs prototype/index.html builds/YYYY-MM-DD-何の版か.html */
import fs from 'node:fs';
import path from 'node:path';
const [src, out] = process.argv.slice(2);
const root = path.dirname(path.dirname(path.resolve(src)));
let s = fs.readFileSync(src, 'utf8');
const mime = { '.png':'image/png', '.ogg':'audio/ogg', '.jpg':'image/jpeg', '.webp':'image/webp' };
let n = 0;
s = s.replace(/"\.\.\/((?:sozai|oto)\/[^"]+)"/g, (m, rel) => {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) throw new Error('素材が無い: ' + f);
  n++;
  return '"data:' + mime[path.extname(f)] + ';base64,' + fs.readFileSync(f).toString('base64') + '"';
});
fs.writeFileSync(out, s);
console.log('埋め込んだ', n, '件 →', out, (s.length/1024|0)+'KB');
