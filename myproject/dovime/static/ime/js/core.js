// 龙语输入法核心引擎（纯逻辑，无 DOM；浏览器挂 window.DOVCore，node 可 require）
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DOVCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 字母表与符文 ----------
  // 字体布局：A-Z = 字母；数字 = 双元音符文
  const DIGRAPHS = ['AA', 'AH', 'EI', 'EY', 'II', 'IR', 'OO', 'UU', 'UR'];
  const DIGRAPH_KEY = { AA: '1', AH: '4', EI: '2', EY: '9', II: '3', IR: '7', OO: '8', UU: '5', UR: '6' };
  const KEY_DIGRAPH = { '1': 'AA', '2': 'EI', '3': 'II', '4': 'AH', '5': 'UU', '6': 'UR', '7': 'IR', '8': 'OO', '9': 'EY' };

  // 拉丁龙语 -> 符文字体键位串（C->K，撇号忽略）
  function toRuneKeys(s) {
    const up = (s || '').toUpperCase().replace(/C/g, 'K').replace(/['’]/g, '');
    let out = '';
    for (let i = 0; i < up.length; i++) {
      const two = up.slice(i, i + 2);
      if (DIGRAPHS.includes(two)) { out += DIGRAPH_KEY[two]; i++; continue; }
      const ch = up[i];
      if (/[A-Z0-9]/.test(ch) || ch === ' ' || /[.,;:!?'\-()]/.test(ch)) out += ch;
    }
    return out;
  }
  // 符文键位串 -> 拉丁龙语（键盘反解）
  function runeKeysToLatin(s) {
    return (s || '').split('').map(c => KEY_DIGRAPH[c] || c).join('');
  }
  // 陌生词音译：按龙语字母近似拼写（C->K）
  function translitForeign(w) {
    return (w || '').toLowerCase().replace(/c/g, 'k').replace(/[^a-z' -]/g, '');
  }

  // ---------- 引擎工厂 ----------
  function create(LEXICON, ZH, CORE, ZH_EXTRA, ZH_GRAMMAR, ZH_SYN, ZH_GLOSS, ZH_PHRASE) {
    const lex = LEXICON.slice();
    const lexSet = new Set(lex.map(x => x[0].toLowerCase()));
    (CORE || []).forEach(c => {
      if (!lexSet.has(c[0].toLowerCase())) lex.push(c);
    });

    // en 释义 -> 词条索引（含多义/多词短语）
    const EN_IDX = new Map();   // key(小写短语) -> [lexIdx]
    const DOV_IDX = new Map();   // 龙语词(小写) -> lexIdx
    const addKey = (k, idx) => {
      k = k.trim().toLowerCase();
      if (!k || k.length > 28) return;
      if (!EN_IDX.has(k)) EN_IDX.set(k, []);
      if (!EN_IDX.get(k).includes(idx)) EN_IDX.get(k).push(idx);
    };
    lex.forEach((e, idx) => {
      const dkey = e[0].toLowerCase();
      if (!DOV_IDX.has(dkey)) DOV_IDX.set(dkey, idx);
      const glosses = e[1].split(/\s*;\s*/);
      const seen = new Set();
      glosses.forEach(g => {
        const clean = g.toLowerCase().replace(/\((.*?)\)/g, ' ').replace(/\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim();
        const parts = clean.split(/\s*[,;]\s*|\s+or\s+|\s*\/\s*/);
        // 括注前置部分（如 "you (plural)" -> "you"）单独成键
        const m = g.toLowerCase().match(/^([a-z '-]+)\s*\(/);
        if (m) parts.push(m[1].trim());
        parts.forEach(p => {
          p = p.trim();
          if (!p || seen.has(p)) return;
          seen.add(p);
          addKey(p, idx);
        });
      });
    });

    // 中文词典：HSK 优先，补充词仅在缺键时加入
    const ZH_MAP = new Map();
    const SYN_OF = new Map();
    (ZH || []).forEach(z => { if (!ZH_MAP.has(z[0])) ZH_MAP.set(z[0], z); });
    (ZH_EXTRA || []).forEach(z => { if (!ZH_MAP.has(z[0])) ZH_MAP.set(z[0], z); });
    // 同义变体归一：变体不在词典时，指向规范词的释义
    Object.keys(ZH_SYN || {}).forEach(v => {
      const canon = ZH_SYN[v];
      if (!ZH_MAP.has(v) && ZH_MAP.has(canon)) { ZH_MAP.set(v, ZH_MAP.get(canon)); SYN_OF.set(v, canon); }
    });
    let zhMaxLen = 1;
    ZH_MAP.forEach((v, k) => { if (!/^[a-z]+$/.test(k)) zhMaxLen = Math.max(zhMaxLen, Math.min(k.length, 6)); });

    // 常用英文别名（仅当词典无此键时注入）
    const EN_ALIAS = { be: 'kos', am: 'los', are: 'kos', you: 'hi', your: 'hin', my: 'dii', our: 'un', dad: 'bormah', papa: 'bormah', pa: 'bormah', mom: 'monah', mum: 'monah', ma: 'monah', afraid: 'faas', scared: 'faas', frightened: 'faas', fearless: 'faasnu', seen: 'koraav', saw: 'koraav', risen: 'lok', rose: 'lok', won: 'kron', was: 'lost', were: 'lost', did: 'drey', ate: 'naak', came: 'meyz', flew: 'bo', gone: 'bo', told: 'fun', knew: 'mindok', spoke: 'tinvaak', do: 'dreh', don: 'ni' };
    Object.keys(EN_ALIAS).forEach(k => {
      if (!EN_IDX.has(k)) {
        const di = DOV_IDX.get(EN_ALIAS[k]);
        if (di !== undefined) EN_IDX.set(k, [di]);
      }
    });

    const rankIdx = (a, b) => {
      const A = lex[a], B = lex[b];
      return (B[2] - A[2]) || (A[0].length - B[0].length) || (a - b);
    };
    const candsFor = idxs => idxs.slice().sort(rankIdx).slice(0, 4);

    function lookupEnRaw(key) {
      const v = EN_IDX.get(key.trim().toLowerCase());
      return v ? candsFor(v) : null;
    }
    // 英文词查龙语（带词形还原）
    function lookupEn(word) {
      const w = word.toLowerCase().replace(/['’]s$/, '');
      let via = null, hit = lookupEnRaw(w);
      if (hit) return { cands: hit, lemma: null };
      const tries = [];
      if (/ies$/.test(w)) tries.push(w.slice(0, -3) + 'y');
      if (/es$/.test(w)) tries.push(w.slice(0, -2));
      if (/s$/.test(w)) tries.push(w.slice(0, -1));
      if (/ied$/.test(w)) tries.push(w.slice(0, -3) + 'y');
      if (/ed$/.test(w)) { tries.push(w.slice(0, -2), w.slice(0, -1)); }
      if (/ing$/.test(w)) { tries.push(w.slice(0, -3), w.slice(0, -3) + 'e'); }
      for (const t of tries) {
        hit = lookupEnRaw(t);
        if (hit) return { cands: hit, lemma: t };
      }
      return { cands: null, lemma: null };
    }

    // 中文最长匹配分词
    function segmentZh(text) {
      const out = [];
      let i = 0;
      while (i < text.length) {
        if (!/[\u3400-\u9fff]/.test(text[i])) { out.push(text[i]); i++; continue; }
        // 先试词组整体识别（最长优先）
        if (ZH_PHRASE) {
          let ph = null;
          for (let l = Math.min(5, text.length - i); l >= 2; l--) {
            const seg = text.slice(i, i + l);
            if (/^[\u3400-\u9fff]+$/.test(seg) && ZH_PHRASE[seg]) { ph = seg; break; }
          }
          if (ph) { out.push({ zh: ph, phrase: true }); i += ph.length; continue; }
        }
        let matched = null;
        for (let l = Math.min(zhMaxLen, text.length - i); l >= 1; l--) {
          const seg = text.slice(i, i + l);
          if (/^[\u3400-\u9fff]+$/.test(seg) && ZH_MAP.has(seg)) { matched = seg; break; }
        }
        if (matched) { out.push({ zh: matched }); i += matched.length; }
        else { out.push({ zh: text[i], unk: true }); i++; }
      }
      return out;
    }

    // 英文词素序列：先短语后单词
    function convertEnWords(words) {
      const out = [];
      let i = 0;
      while (i < words.length) {
        let hit = null, len = 0;
        for (let l = Math.min(3, words.length - i); l >= 2; l--) {
          const phrase = words.slice(i, i + l).join(' ');
          const c = lookupEnRaw(phrase);
          if (c) { hit = { kind: 'en', src: phrase, en: phrase, cands: c.map(idx => mkCand(phrase, idx)) }; len = l; break; }
        }
        if (hit) { out.push(hit); i += len; continue; }
        const w = words[i];
        // 先英文释义（避免 am/in/on/do 等英文常用词被龙语同形词劫持，如 Am=狮子）
        const r = lookupEn(w);
        if (r.cands) { out.push({ kind: 'en', src: w, lemma: r.lemma, en: r.lemma ? r.lemma + '（' + w + '）' : w, cands: r.cands.map(idx => mkCand(w, idx)) }); i++; continue; }
        const di = DOV_IDX.get(w.toLowerCase());
        if (di !== undefined) { out.push({ kind: 'dov', src: w, cands: [mkCand(lex[di][1], di)] }); i++; continue; }
        out.push({ kind: 'unk', src: w, translit: translitForeign(w) });
        i++;
      }
      return out;
    }
    const mkCand = (en, idx) => ({ en, lex: idx, dov: lex[idx][0], gloss: lex[idx][1], canon: lex[idx][2], pos: lex[idx][3], note: lex[idx][4] });

    // ---------- 总转换 ----------
    // text: 混合中英；sel: {tokenIdx: candIdx} 用户选词；opts.fix: 语法自动修正
    function convert(text, sel, opts) {
      sel = sel || {};
      const fix = !opts || opts.fix !== false;
      const notes = [];
      // 1) 顶层切分：中文段 / 拉丁段 / 其他
      const runs = [];
      let buf = '', type = null;
      const flush = () => { if (buf) { runs.push({ type, text: buf }); buf = ''; } };
      for (const ch of (text || '')) {
        const t = /[\u3400-\u9fff]/.test(ch) ? 'zh' : (/[A-Za-z']/.test(ch) ? 'en' : 'sep');
        if (t === 'sep') { flush(); runs.push({ type: 'sep', text: ch }); type = null; continue; }
        if (t !== type) { flush(); type = t; }
        buf += ch;
      }
      flush();

      const tokens = [];
      let ti = 0;
      for (const run of runs) {
        if (run.type === 'sep') { tokens.push({ kind: 'sep', src: normPunct(run.text) }); continue; }
        if (run.type === 'en') {
          const words = run.text.split(/\s+/).map(w => w.replace(/^['’]+|['’]+$/g, '')).filter(Boolean);
          convertEnWords(words).forEach(t => { tokens.push(withSel(t, ti, sel)); ti++; });
          continue;
        }
        for (const seg of segmentZh(run.text)) {
          if (typeof seg === 'string') { tokens.push({ kind: 'sep', src: normPunct(seg) }); continue; }
          if (seg.unk) {
            const gu = ZH_GRAMMAR && ZH_GRAMMAR[seg.zh];
            if (gu) tokens.push({ kind: 'gram', src: seg.zh, note: gu });
            else tokens.push(withSel({ kind: 'unk', src: seg.zh }, ti, sel));
            ti++;
            continue;
          }
          if (seg.phrase) {
            const cands = [];
            ZH_PHRASE[seg.zh].split('|').forEach(alt => {
              const di = DOV_IDX.get(alt.toLowerCase());
              if (di !== undefined) cands.push(mkCand(lex[di][1].split(';')[0], di));
            });
            tokens.push(withSel({ kind: 'zh', src: seg.zh, cands }, ti, sel)); ti++;
            continue;
          }
          const g = ZH_GRAMMAR && ZH_GRAMMAR[seg.zh];
          if (g) { tokens.push({ kind: 'gram', src: seg.zh, note: g }); ti++; continue; }
          const z = ZH_MAP.get(seg.zh);
          const synOf = SYN_OF.get(seg.zh);
          const buildCands = senses => {
            const out = [];
            senses.forEach(s => {
              const r = lookupEnRaw(s);
              if (r) r.forEach(idx => out.push(mkCand(s, idx)));
            });
            return out;
          };
          let cands = buildCands(z[2]);
          // 宽匹配：多词语义整体未命中时，尝试末词（如 older brother → brother）
          if (!cands.length) {
            const widened = [];
            z[2].forEach(s => {
              if (/\s/.test(s)) {
                const last = s.split(/\s+/).pop();
                const r = lookupEnRaw(last);
                if (r) r.forEach(idx => widened.push(mkCand(s + '→' + last, idx)));
              }
            });
            cands = widened;
          }
          tokens.push(withSel({ kind: 'zh', src: seg.zh, pinyin: z[1], level: z[3], synOf, cands }, ti, sel)); ti++;
        }
      }
      let res = { tokens, notes };
      if (fix) applyFixes(tokens, notes);
      res.dovSentence = tokens.filter(t => t.kind !== 'gram' && t.cands && t.cands[t.sel] && wordOf(t))
        .map(t => wordOf(t)).join(' ');
      return res;
    }
    function wordOf(t) {
      const c = t.cands && t.cands[t.sel];
      if (!c) return null;
      return t.fixed || t.overrideDov || c.dov;
    }
    // 规则式语法自动修正（离线、确定性）
    function applyFixes(tokens, notes) {
      const isWord = t => t && t.cands && t.cands[t.sel];
      const cand = t => t.cands[t.sel];
      const prevWord = (i, sg) => { for (let j = i - 1; j >= 0; j--) { const t = tokens[j]; if (t.kind === 'sep') continue; if (sg && t.kind === 'gram') continue; return t; } return null; };
      const nextWord = i => { for (let j = i + 1; j < tokens.length; j++) { if (tokens[j].kind !== 'sep') return tokens[j]; } return null; };
      const setOverride = (t, en) => {
        const r = lookupEnRaw(en);
        if (r && r.length) { t.overrideDov = lex[r[0]][0]; t.overrideGloss = lex[r[0]][1]; t.overrideCanon = lex[r[0]][2]; }
      };
      // 预处理：动词后的「过」= 体貌助词，并入完成体并从输出剔除
      tokens.forEach((t, i) => {
        if (t.kind === 'zh' && t.src === '过' && !t.overrideDov) {
          const p = prevWord(i, true);
          if (isWord(p) && cand(p).pos === 'verb') {
            if (!p.fixed) {
              const r = inflect(cand(p).dov, 'perf');
              if (r) { p.fixed = r.word; notes.push('「过」→ 完成体：' + cand(p).dov + ' → ' + r.word); }
            }
            t.kind = 'gram';
            t.note = '体貌助词「过」：并入完成体 -aan，不单独译词';
            t.cands = null;
          }
        }
      });
      tokens.forEach((t, i) => {
        // 了 → 完成体：前一动词 +aan
        if (t.kind === 'gram' && t.src === '了') {
          const p = prevWord(i, true);
          if (isWord(p) && cand(p).pos === 'verb' && !p.fixed) {
            const r = inflect(cand(p).dov, 'perf');
            if (r) { p.fixed = r.word; notes.push('「了」→ 完成体：' + cand(p).dov + ' → ' + r.word); }
          }
        }
        // 们 → 复数：前一名词/代词重复词尾 +e
        if (t.kind === 'gram' && t.src === '们') {
          const p = prevWord(i, true);
          if (isWord(p) && !p.fixed && (cand(p).pos === 'noun' || cand(p).pos === 'pronoun')) {
            const r = inflect(cand(p).dov, 'plural');
            if (r) { p.fixed = r.word; notes.push('「们」→ 复数：' + cand(p).dov + ' → ' + r.word); }
          }
        }
        // 的 → 属格：后一中心名词 +i（前项为代词/名词时）；形容词则直接复合省略
        if (t.kind === 'gram' && t.src === '的') {
          const nx = nextWord(i), pv = prevWord(i, true);
          if (isWord(nx) && cand(nx).pos === 'noun' && !nx.fixed && isWord(pv)) {
            const pp = cand(pv).pos;
            if (pp === 'pronoun' || pp === 'noun') {
              const r = inflect(cand(nx).dov, 'poss');
              if (r) { nx.fixed = r.word; notes.push('「的」→ 属格：' + cand(nx).dov + ' → ' + r.word + '（' + pv.src + '·' + nx.src + '）'); }
            }
          }
        }
        // 在+动词 → 进行体 los；将 → 将来时 fen
        if (t.kind === 'zh' && t.src === '在' && !t.overrideDov) {
          const nx = nextWord(i);
          if (isWord(nx) && cand(nx).pos === 'verb') {
            setOverride(t, 'is');
            if (t.overrideDov) notes.push('「在」+动词 → 进行体 los（' + t.src + ' ' + nx.src + '）');
          }
        }
        if (t.kind === 'zh' && (t.src === '将' || t.src === '将要' || t.src === '将会') && !t.overrideDov) {
          setOverride(t, 'will');
          if (t.overrideDov) notes.push('「' + t.src + '」→ 将来时 fen');
        }
      });
      // 英文侧龙语化：冠词省略 / have+动词→完成体 / 复数名词→龙语复数
      tokens.forEach((t, i) => {
        if (t.kind !== 'en') return;
        const c = t.cands && t.cands[t.sel];
        if (!c) return;
        const src = t.src.toLowerCase();
        // a/an 冠词：龙语常省略
        if ((src === 'a' || src === 'an') && !t.fixed) {
          t.kind = 'gram';
          t.note = '冠词 a/an：龙语无冠词习惯，省略（尊称可用 fin/faal）';
          t.cands = null;
        }
        // have/has + 动词 → 动词 + aan（完成体），助动词不译
        if ((src === 'have' || src === 'has') && !t.overrideDov) {
          const nx = nextWord(i, true);
          if (nx && nx.kind === 'en' && nx.cands && nx.cands[nx.sel] && nx.cands[nx.sel].pos === 'verb' && !nx.fixed) {
            const r = inflect(nx.cands[nx.sel].dov, 'perf');
            if (r) {
              nx.fixed = r.word;
              t.kind = 'gram';
              t.note = '助动词 have/has：龙语完成体为动词 +aan，助词省略';
              t.cands = null;
              notes.push('have/has + 动词 → 完成体：' + nx.cands[nx.sel].dov + ' → ' + r.word);
            }
          }
        }
        // 英文复数名词（词形还原过且以 s 结尾）→ 龙语复数（重复词尾 +e）
        if (!t.fixed && !t.overrideDov && t.lemma && c.pos === 'noun' && /s$/.test(src) && src !== 'his' && src !== 'news') {
          const r = inflect(c.dov, 'plural');
          if (r) { t.fixed = r.word; notes.push('英文复数 ' + src + ' → 龙语复数：' + c.dov + ' → ' + r.word); }
        }
      });
    }
    function withSel(t, ti, sel) {
      if (t.cands && t.cands.length) {
        const s = Math.min(sel[ti] || 0, t.cands.length - 1);
        t.sel = s < 0 ? 0 : s;
        if (!t.cands[t.sel]) t.sel = 0;
      }
      return t;
    }
    function normPunct(p) {
      const map = { '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':', '、': ',', '（': '(', '）': ')', '"': '"', '"': '"', '‘': "'", '’': "'" };
      return map[p] || (/[\sA-Za-z0-9.,;:!?()'\-]/.test(p) ? p : '');
    }

    // ---------- 屈折变化 ----------
    function inflect(word, form) {
      const w = (word || '').trim().toLowerCase();
      if (!/^[a-z'-]+$/.test(w)) return null;
      let r, rule;
      const last = w[w.length - 1];
      if (form === 'plural') { r = w + last + 'e'; rule = '复数：重复末字母并加 e（kel→kelle，grohiik→grohiikke）'; }
      else if (form === 'poss') { r = w.endsWith('ii') ? w + 'l' : w + 'i'; rule = w.endsWith('ii') ? '属格（词尾 ii）：加 l（briinah→briinahl）' : '属格（我的/你的/他的/她的）：加 i（dovah→dovahi）'; }
      else if (form === 'our') { r = w + 'u'; rule = '属格（我们的）：加 u（dov→dovu）'; }
      else if (form === 'perf') { r = w + 'aan'; rule = '完成体：加 aan（bo→boaan 已至）'; }
      else return null;
      return { word: r, rule, runes: toRuneKeys(r) };
    }

    // ---------- 反向：龙语 → 中文（逐词，英文释义作辅助） ----------
    function zhForGloss(gloss) {
      const parts = gloss.toLowerCase().replace(/\(.*?\)/g, ' ').split(/\s*;\s*|\s*\/\s*/).map(s => s.trim()).filter(Boolean);
      const hits = [];
      ZH_MAP.forEach((z, hanzi) => {
        if (hits.length >= 3) return;
        if (z[2].some(s => parts.includes(s))) hits.push(hanzi);
      });
      return hits;
    }
    function convertReverse(text) {
      const tokens = [], zhOut = [], enOut = [];
      // 屈折剥离：完成体 -aan / 复数（重复词尾+e）/ 属格 -i / 我们的 -u
      function stripInflect(l) {
        if (l.length > 5 && /aan$/.test(l)) { const s = l.slice(0, -3); if (DOV_IDX.has(s)) return [s, '完成体 +aan']; }
        const m = l.match(/(.)\1e$/);
        if (m && l.length > 4) { const s = l.slice(0, -2); if (DOV_IDX.has(s)) return [s, '复数（重复词尾+e）']; }
        if (/i$/.test(l) && l.length > 3 && !/ii$/.test(l)) { const s = l.slice(0, -1); if (DOV_IDX.has(s)) return [s, '属格 +i']; }
        if (/u$/.test(l) && l.length > 3) { const s = l.slice(0, -1); if (DOV_IDX.has(s)) return [s, '属格（我们的）+u']; }
        return null;
      }
      (text || '').split(/\s+/).map(w => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '')).filter(Boolean).forEach(w => {
        let di = DOV_IDX.get(w.toLowerCase());
        if (di === undefined) di = DOV_IDX.get(w.toLowerCase().replace(/[\u2019']/g, ''));
        let inflect = null;
        if (di === undefined) {
          const si = stripInflect(w.toLowerCase().replace(/[\u2019']/g, ''));
          if (si) { di = DOV_IDX.get(si[0]); inflect = si[1]; }
        }
        if (di !== undefined) {
          const e = lex[di];
          const glossMain = e[1].split(';')[0].replace(/\(.*?\)/, '').trim();
          let zh = zhForGloss(e[1]);
          if (!zh.length && ZH_GLOSS) {
            const k1 = e[0].toLowerCase();
            const k2 = k1.replace(/[\u2019']/g, '');
            const g = ZH_GLOSS[k1] || ZH_GLOSS[k2];
            if (g) zh = [g];
          }
          tokens.push({ kind: 'dov', src: w, dov: e[0], gloss: e[1], glossMain, canon: e[2], pos: e[3], zh, inflect });
          zhOut.push(zh.length ? zh.join('/') : glossMain);
          enOut.push(glossMain);
        } else {
          tokens.push({ kind: 'unk', src: w, translit: translitForeign(w) });
          zhOut.push(w);
          enOut.push(w);
        }
      });
      return { tokens, zhSentence: zhOut.join(' '), enLine: enOut.join(' · ') };
    }

    // ---------- 词典检索 ----------
    // q: 龙语/英文/中文；canonMin: 0 全部 1 半正典以上 2 正典
    function searchDict(q, canonMin, limit, offset) {
      q = (q || '').trim();
      canonMin = canonMin || 0; limit = limit || 60; offset = offset || 0;
      const ql = q.toLowerCase();
      const pass = i => lex[i][2] >= canonMin;
      let list = [];
      let via = '';
      if (!ql) {
        list = lex.map((_, i) => i).filter(pass);
      } else if (/[\u3400-\u9fff]/.test(q)) {
        via = 'zh';
        const senses = new Set();
        segmentZh(q).forEach(s => {
          if (typeof s !== 'string' && !s.unk) {
            const z = ZH_MAP.get(s.zh);
            if (z) z[2].forEach(x => senses.add(x));
          }
        });
        lex.forEach((e, i) => {
          if (!pass(i)) return;
          const g = e[1].toLowerCase();
          for (const s of senses) if (s.length > 1 && (g === s || g.includes(s) || g.split(/\s*;\s*/).some(x => x.includes(s)))) { list.push(i); break; }
        });
        if (!list.length) via = '';
      }
      if (!list.length && !/[\u3400-\u9fff]/.test(q)) {
        via = via || 'en';
        const starts = [], incl = [];
        lex.forEach((e, i) => {
          if (!pass(i)) return;
          const d = e[0].toLowerCase();
          if (d.startsWith(ql)) starts.push(i);
          else if (d.includes(ql)) incl.push(i);
          else if (e[1].toLowerCase().includes(ql)) incl.push(i);
        });
        list = starts.sort((a, b) => rankIdx(a, b)).concat(incl.sort((a, b) => rankIdx(a, b)));
      }
      const uniq = [...new Set(list)];
      return { total: uniq.length, list: uniq.slice(offset, offset + limit), via };
    }

    const lexGet = i => lex[i];
    const lexCount = () => lex.length;
    const zhGet = h => ZH_MAP.get(h);

    return { toRuneKeys, runeKeysToLatin, translitForeign, lookupEn, lookupEnRaw, segmentZh, convert, convertReverse, inflect, searchDict, lexGet, lexCount, zhGet };
  }

  return { create, toRuneKeys, runeKeysToLatin, translitForeign, DIGRAPHS, DIGRAPH_KEY, KEY_DIGRAPH };
});
