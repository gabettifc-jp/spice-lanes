/* 「繋ぐ」が選択になっているかを測る物差し。
   構造を変えたら、これを走らせて前後を比べる。使い方：
     node tools/keizai.mjs [prototype/index.html] [種の数]

   測るのは五つ。
     1 繋げる組の数と、赤字になる組の割合  ── 選ぶ余地があるか
     2 元が取れるまでのターン数            ── 賭けになっているか
     3 初手で引ける本数                    ── 諦めが要るか
     4 何も考えずに引けるだけ引いた通し    ── **考えなくても勝てるか**
     5 取り立てとの比                      ── 締め切りが効いているか            */
import { chromium } from 'playwright';
import path from 'node:path';

const SRC = path.resolve(process.argv[2] || 'prototype/index.html');
const SEEDS = Number(process.argv[3] || 5);
const b = await chromium.launch({ args:['--allow-file-access-from-files'] });
const 中央 = a => a.length ? a.slice().sort((x,y)=>x-y)[a.length>>1] : NaN;

const 一回 = async (seed) => {
  const p = await b.newPage({ viewport:{width:1280,height:800} });
  p.setDefaultTimeout(120000);
  await p.goto('file://'+SRC+'?seed='+seed);
  await p.waitForTimeout(1200);
  const r = await p.evaluate(()=>{
    /* 全部めくった状態で測る。地図の出方ではなく、規則を測りたい */
    for(let i=0;i<ST.length;i++) ST[i]=ST[i]||(P[i]<0.5?1:2);
    CITIES.forEach(c=>c.shown=true); dirty=true; stVer++; recalcRoute();

    const 組=[];
    for(let i=0;i<CITIES.length;i++) for(let j=i+1;j<CITIES.length;j++){
      const sp=seaPath(CITIES[i],CITIES[j]); if(!sp) continue;
      S.lanes.length=0;
      const l={a:CITIES[i],b:CITIES[j],path:sp.path,len:sp.len,age:0};
      S.lanes.push(l);
      組.push({a:i,b:j,len:sp.len,path:sp.path,
               開く:Math.round(sp.len*K.OPEN_COST), 実り:laneIncome(l)});
    }
    S.lanes.length=0;
    const 赤字=組.filter(x=>x.実り<=0).length;
    const 回収=組.filter(x=>x.実り>0).map(x=>x.開く/x.実り);

    /* 初手：安い順に買えるだけ */
    let 金=K.GOLD0, 初手=0;
    for(const x of 組.slice().sort((u,v)=>u.開く-v.開く)){ if(金<x.開く) break; 金-=x.開く; 初手++; }

    /* 何も考えずに引けるだけ引く通し ── **順番も選ばない。安い順に、毎ターン買えるだけ** */
    S.lanes.length=0; S.gold=K.GOLD0;
    const 残り=組.slice().sort((u,v)=>u.開く-v.開く);
    let quotaIx=0, 詰み=0, 最終=0;
    const 終わり=K.QUOTA_TURNS[K.QUOTA_TURNS.length-1];
    for(let turn=1; turn<=終わり+1; turn++){
      while(残り.length && S.gold>=残り[0].開く){
        const x=残り.shift();
        S.gold-=x.開く;
        S.lanes.push({a:CITIES[x.a],b:CITIES[x.b],path:x.path,len:x.len,age:0});
      }
      S.gold += Math.round(S.lanes.reduce((s,l)=>s+laneIncome(l),0));
      S.lanes.forEach(l=>l.age++);
      if(quotaIx<K.QUOTAS.length && turn>K.QUOTA_TURNS[quotaIx]){
        if(S.gold>=K.QUOTAS[quotaIx]){ S.gold-=K.QUOTAS[quotaIx]; quotaIx++; }
        else { 詰み=turn; break; }
      }
      最終=S.gold;
    }
    return {組:組.length, 赤字,
            回収中央: 回収.length? 回収.slice().sort((a,b)=>a-b)[回収.length>>1] : null,
            回収最小: 回収.length? Math.min(...回収) : null,
            初手, 引いた本数:S.lanes.length, 最終, 詰み,
            越えた取り立て:quotaIx, 取り立て:K.QUOTAS.slice()};
  });
  await p.close();
  return r;
};

const 全部=[];
for(let s=1;s<=SEEDS;s++) 全部.push(await 一回(s*137));
await b.close();

const col=(k)=>全部.map(r=>r[k]);
console.log('── 「繋ぐ」の物差し　'+path.basename(SRC)+'　種 '+SEEDS+'つ ──\n');
console.log('繋げる組            ', 中央(col('組')), '（うち赤字', 中央(col('赤字'))+'）');
console.log('元が取れるまで       中央', col('回収中央').map(v=>v==null?'—':v.toFixed(2)).join(' / '), 'ターン');
console.log('　　　　　　　　　　 最短', col('回収最小').map(v=>v==null?'—':v.toFixed(2)).join(' / '), 'ターン');
console.log('初手で引ける本数    ', col('初手').join(' / '));
console.log('');
console.log('★ 何も考えずに安い順に引けるだけ引いた通し');
console.log('　 引いた本数        ', col('引いた本数').join(' / '));
console.log('　 越えた取り立て    ', col('越えた取り立て').join(' / '), '（全部で '+全部[0].取り立て.length+'）');
console.log('　 最後の所持金      ', col('最終').join(' / '));
console.log('　 詰んだターン      ', col('詰み').map(v=>v||'—').join(' / '));
const 勝ち=全部.filter(r=>r.越えた取り立て>=r.取り立て.length).length;
console.log('');
console.log(勝ち===全部.length
  ? '⚠ 種 '+全部.length+'つ全部で、**何も考えなくてもクリアできる。**「繋ぐ」は選択になっていない'
  : '　 '+勝ち+'／'+全部.length+' でクリア。考えないと勝てない種がある');
