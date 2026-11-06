// 龙语输入法 UI（依赖 core.js / data.js / ref.js / font.js 已内联）
(function () {
  'use strict';
  const C = window.DOVCore;
  const E = C.create(window.DOV_LEXICON, window.DOV_ZH, window.DOV_CORE, window.DOV_ZH_EXTRA, window.DOV_ZH_GRAMMAR, window.DOV_ZH_SYN, window.DOV_ZH_GLOSS, window.DOV_ZH_PHRASE);
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const POS_ZH = { noun: '名词', verb: '动词', adjective: '形容词', adverb: '副词', pronoun: '代词', preposition: '介词', conjunction: '连词', interjection: '叹词', phrase: '短语', particle: '助词', numeral: '数词', suffix: '后缀', prefix: '前缀' };
  const CANON_TXT = ['非正典', '半正典', '正典'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function copyText(text, label) {
    const done = () => toast((label || '已复制') + '：' + (text.length > 24 ? text.slice(0, 24) + '…' : text));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择文本'); }
    document.body.removeChild(ta);
  }

  // ---------- 标签页 ----------
  const tabs = $$('.tab');
  tabs.forEach(btn => btn.addEventListener('click', () => activateTab(btn)));
  function activateTab(btn) {
    tabs.forEach(b => { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    $$('.panel').forEach(p => { p.hidden = p.id !== btn.getAttribute('data-panel'); });
    location.hash = btn.getAttribute('data-panel');
  }
  $('.tablist').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); activateTab(n); e.preventDefault();
  });
  const hashTab = () => { const b = $$('.tab').find(t => t.getAttribute('data-panel') === location.hash.slice(1)); activateTab(b || tabs[0]); };

  // ---------- 转换面板 ----------
  const input = $('#ime-input');
  const fixToggle = { checked: true }; // 语法修正常开（不再提供开关）
  const selMap = {};
  let conv = null, rconv = null;
  const state = { dir: 'fwd', aiDov: null, aiSource: '', aiZh: null, aiZhSource: '', inputs: { fwd: '', rev: '' } };
  const dirBtns = $$('#dir-seg button');
  function setDir(d) {
    state.dir = d;
    dirBtns.forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-d') === d));
    $('#ai-btn').textContent = d === 'fwd' ? 'AI 翻译' : 'AI 润成通顺中文';
    input.placeholder = d === 'fwd' ? '例如：我是龙裔' : '输入龙语拉丁拼写，如：Fus Ro Dah';
    input.value = state.inputs[d] || '';
    renderConvert();
  }
  dirBtns.forEach(b => b.addEventListener('click', () => setDir(b.getAttribute('data-d'))));
  function renderReverse(text) {
    rconv = E.convertReverse(text);
    const chips = rconv.tokens.map(t => t.kind === 'dov'
      ? '<span class="tk"><span class="rune tk-rune">' + esc(C.toRuneKeys(t.dov)) + '</span>' +
        '<span class="tk-dov">' + esc(t.dov) + '</span>' +
        '<span class="tk-src">' + esc(t.glossMain) + (t.zh.length ? ' › ' + esc(t.zh.join(' / ')) : '') + '</span>' +
        canonBadge(t.canon) + '</span>'
      : '<span class="tk tk-unk">' + esc(t.src) + '<span class="tk-dov dim">未收录</span></span>').join('');
    const fluent = state.aiZh != null && state.aiZhSource === text ? state.aiZh : null;
    $('#ime-out').innerHTML =
      (fluent ? '<div class="zh-main">' + esc(fluent) + '<span class="tag">AI 通顺</span></div>' : '') +
      '<div class="zh-line">' + esc(rconv.zhSentence) + '<span class="tag">逐词（未收录词显原文）</span></div>' +
      '<div class="mid-line dim num">英文释义（辅助）：' + esc(rconv.enLine) + '</div>' +
      '<div class="rune-hero" aria-hidden="true" style="font-size:28px;min-height:40px">' + esc(C.toRuneKeys(text)) + '</div>' +
      '<div class="tk-flow">' + chips + '</div>' +
      '<div class="copy-row"><button class="btn" id="copy-zh">复制中文</button></div>';
    $('#copy-zh').addEventListener('click', () => copyText(fluent || rconv.zhSentence, '中文'));
  }
  function renderConvert() {
    try { renderConvertInner(); }
    catch (e) {
      $('#ime-out').innerHTML = '<div class="empty"><p>渲染出错：' + esc(e.message) + '</p><p class="dim">换一句试试，或把这句话反馈给开发者。</p></div>';
    }
  }
  function renderConvertInner() {
    const text = input.value;
    const out = $('#ime-out');
    if (!text.trim()) { out.innerHTML = emptyIme(); return; }
    if (state.dir === 'rev') { renderReverse(text); return; }
    conv = E.convert(text, selMap, { fix: fixToggle.checked });
    const aiDov = state.aiDov != null && state.aiSource === text ? state.aiDov : null;
    const dovWords = [], chipHtml = [];
    if (aiDov) {
      E.convertReverse(aiDov).tokens.forEach(t => {
        if (t.kind === 'sep') { if (t.src) chipHtml.push('<span class="tk-sep">' + esc(t.src) + '</span>'); return; }
        if (t.kind === 'dov') {
          dovWords.push(t.dov);
          chipHtml.push('<span class="tk"><span class="rune tk-rune">' + esc(C.toRuneKeys(t.dov)) + '</span>' +
            '<span class="tk-dov">' + esc(t.dov) + '</span>' +
            '<span class="tk-src">' + esc(t.glossMain) + (t.zh.length ? ' › ' + esc(t.zh.join(' / ')) : '') + '</span>' +
            canonBadge(t.canon) + '</span>');
        } else {
          chipHtml.push('<span class="tk tk-unk">' + esc(t.src) + '<span class="tk-dov dim">未收录</span></span>');
        }
      });
    } else conv.tokens.forEach((t, i) => {
      if (t.kind === 'sep') { if (t.src) chipHtml.push('<span class="tk-sep">' + esc(t.src) + '</span>'); return; }
      if (t.kind === 'gram') { chipHtml.push('<span class="tk-gram" title="' + esc(t.note) + '">' + esc(t.src) + '<span class="tk-gram-n">' + esc(t.note) + '</span></span>'); return; }
      if (t.kind === 'unk') {
        const tr = t.translit;
        chipHtml.push('<span class="tk tk-unk">' + esc(t.src) + (tr ? '<span class="tk-dov dim">' + esc(tr) + '</span><span class="rune small">' + esc(C.toRuneKeys(tr)) + '</span><span class="tag">音译</span>' : '<span class="tk-dov dim">未收录</span>') + '</span>');
        if (tr) dovWords.push(tr);
        return;
      }
      const c = t.cands[t.sel];
      if (!c) {
        chipHtml.push('<span class="tk tk-unk">' + esc(t.src) +
          (t.pinyin ? '<span class="tk-src">' + esc(t.pinyin) + '</span>' : '') +
          '<span class="tk-dov dim">暂无龙语对应 · 可换词或用 AI</span></span>');
        return;
      }
      const w = t.fixed || t.overrideDov || c.dov;
      dovWords.push(w);
      chipHtml.push(
        '<span class="tk' + (t.fixed || t.overrideDov ? ' tk-fixed' : '') + '" data-i="' + i + '" tabindex="0" role="button" aria-haspopup="true" aria-expanded="false">' +
        '<span class="rune tk-rune">' + esc(C.toRuneKeys(w)) + '</span>' +
        '<span class="tk-dov">' + esc(w) + '</span>' +
        '<span class="tk-src">' + esc(t.src) + (t.synOf ? ' ≈ ' + esc(t.synOf) : '') + (t.src.toLowerCase() !== c.en.toLowerCase() ? ' › ' + esc(c.en) : '') + ((t.fixed || t.overrideDov) && c.dov.toLowerCase() !== w.toLowerCase() ? '（原 ' + esc(c.dov) + '）' : '') + '</span>' +
        canonBadge(c.canon) +
        '</span>');
    });
    const sentence = aiDov || dovWords.join(' ');
    const keys = C.toRuneKeys(sentence);
    out.innerHTML =
      '<div class="rune-hero" aria-hidden="true">' + esc(keys) + '</div>' +
      '<div class="dov-line num">' + esc(sentence || '（无可译词）') + (aiDov ? '<span class="tag">AI 直译</span>' : '') + '</div>' +
      '<div class="tk-flow" role="listbox" aria-label="逐词候选">' + chipHtml.join('') + '</div>' +
      (conv.notes && conv.notes.length ? '<details class="fix-notes"><summary>已应用语法修正 ' + conv.notes.length + ' 条</summary><ul>' + conv.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul></details>' : '') +
      '<div class="copy-row">' +
      '<button class="btn" data-copy="latin">复制龙语</button>' +
      '<button class="btn" data-copy="keys">复制符文键位</button>' +
      '</div>';
    out.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      copyText(b.getAttribute('data-copy') === 'latin' ? sentence : keys, b.getAttribute('data-copy') === 'latin' ? '龙语' : '符文键位');
    }));
    out.querySelectorAll('.tk[data-i]').forEach(ch => {
      ch.addEventListener('click', e => { if (!e.target.closest('.cand-menu')) toggleMenu(ch); });
      ch.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(ch); } });
    });
  }
  function toggleMenu(chip) {
    const open = chip.querySelector('.cand-menu');
    $$('.cand-menu').forEach(m => m.remove());
    $$('.tk[aria-expanded="true"]').forEach(c => c.setAttribute('aria-expanded', 'false'));
    if (open) return;
    const i = +chip.getAttribute('data-i');
    const t = conv.tokens[i];
    const menu = document.createElement('span');
    menu.className = 'cand-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = t.cands.map((c, ci) =>
      '<button class="cand" role="menuitem" data-ci="' + ci + '">' +
      '<span class="rune small">' + esc(C.toRuneKeys(c.dov)) + '</span><b>' + esc(c.dov) + '</b>' +
      '<span class="cand-en">' + esc(c.en) + ' · ' + esc(c.gloss.split(';')[0]) + '</span>' + canonBadge(c.canon) +
      (ci === t.sel ? '<span class="cand-cur">当前</span>' : '') + '</button>').join('');
    chip.appendChild(menu);
    chip.setAttribute('aria-expanded', 'true');
    menu.querySelectorAll('.cand').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      selMap[i] = +b.getAttribute('data-ci');
      renderConvert();
    }));
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('.tk')) { $$('.cand-menu').forEach(m => m.remove()); $$('.tk[aria-expanded="true"]').forEach(c => c.setAttribute('aria-expanded', 'false')); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $$('.cand-menu').forEach(m => m.remove()); $$('.tk[aria-expanded="true"]').forEach(c => c.setAttribute('aria-expanded', 'false')); }
  });
  function emptyIme() {
    return '<div class="empty">' +
      '<div class="rune-hero" aria-hidden="true">DR2M YOL LOK</div>' +
      '<p class="dim">输入即译（离线）；点「AI 翻译」用 AI 译文。</p></div>';
  }
  let deb;
  input.addEventListener('input', () => { state.inputs[state.dir] = input.value; aiThinkText = ''; clearTimeout(deb); deb = setTimeout(renderConvert, 120); clearTimeout(autoTimer); autoTimer = setTimeout(maybeAutoAI, 3000); });

  // ---------- AI（站点模式=统一接口无需 Key；单文件模式=OpenAI 兼容自备配置） ----------
  const aiBtn = $('#ai-btn'), aiErr = $('#ai-err');
  const aiCfg = { base: $('#ai-base'), model: $('#ai-model'), key: $('#ai-key') };
  const AI_ENDPOINT = window.DOV_AI_ENDPOINT || '';
  let llmController = null;
  let aiThinkText = '';
  function csrfToken() {
    const inp = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (inp && inp.value) return inp.value;
    const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function dropThink(s) { return s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?think>/g, ''); }
  // ---------- AI 记录（本机存储，不上传服务器；无痕模式用 sessionStorage 关标签即清） ----------
  const HKEY = 'dovime_ai_history_v1';
  const histPrivate = $('#hist-private');
  function getStore() {
    const priv = histPrivate ? histPrivate.checked : false;
    return priv ? (typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage) : localStorage;
  }
  function loadHistory() { try { const v = JSON.parse(getStore().getItem(HKEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function saveHistoryList(list) { try { getStore().setItem(HKEY, JSON.stringify(list.slice(0, 50))); } catch (e) {} }
  function pushHistory(rec) { const list = loadHistory(); list.unshift(rec); saveHistoryList(list); renderHistory(); }

  function fmtTime(t) {
    const d = new Date(t), q = n => (n < 10 ? '0' + n : '' + n);
    return (d.getMonth() + 1) + '-' + q(d.getDate()) + ' ' + q(d.getHours()) + ':' + q(d.getMinutes());
  }
  function renderHistory() {
    const box = $('#hist-list'); if (!box) return;
    const list = loadHistory();
    const cnt = $('#hist-count');
    if (cnt) cnt.textContent = list.length ? '共 ' + list.length + ' 条' : '';
    if (!list.length) {
      box.innerHTML = '<div class="empty"><p>还没有记录，完成一次 AI 翻译后会出现在这里。</p></div>';
      return;
    }
    box.innerHTML = list.map((r, i) => {
      const fwd = r.dir === 'fwd';
      const main = fwd ? (r.dov || r.en || '') : (r.zh || '');
      const rune = fwd && r.dov ? '<div class="rune hist-rune" aria-hidden="true">' + esc(C.toRuneKeys(r.dov)) + '</div>' : '';
      return '<div class="hist-row">' +
        '<div class="hist-main">' +
        '<div class="hist-meta"><span class="tag">' + (fwd ? '中 → 龙' : '龙 → 中') + '</span><span class="num dim">' + fmtTime(r.t) + '</span></div>' +
        '<div class="hist-in dim">' + esc(r.input) + '</div>' +
        '<div class="hist-out">' + esc(main) + '</div>' + rune +
        '</div>' +
        '<div class="hist-ops">' +
        '<button class="btn" data-hact="load" data-i="' + i + '">载入</button>' +
        '<button class="btn" data-hact="copy" data-i="' + i + '">复制</button>' +
        '<button class="btn" data-hact="del" data-i="' + i + '">删</button>' +
        '</div></div>';
    }).join('');
  }
  const histList = $('#hist-list');
  if (histList) histList.addEventListener('click', e => {
    const b = e.target.closest('button[data-hact]'); if (!b) return;
    const i = +b.getAttribute('data-i');
    const list = loadHistory(); const r = list[i]; if (!r) return;
    const act = b.getAttribute('data-hact');
    if (act === 'del') { list.splice(i, 1); saveHistoryList(list); renderHistory(); toast('已删除该条记录'); return; }
    if (act === 'copy') { copyText(r.dir === 'fwd' ? (r.dov || r.en || '') : (r.zh || ''), '译文'); return; }
    if (act === 'load') {
      aiThinkText = '';
      state.inputs[r.dir] = r.input;
      if (r.dir === 'fwd') { state.aiDov = r.dov || null; state.aiSource = r.dov ? r.input : ''; }
      else { state.aiZh = r.zh || null; state.aiZhSource = r.zh ? r.input : ''; }
      activateTab(tabs.find(x => x.getAttribute('data-panel') === 'ime') || tabs[0]);
      setDir(r.dir);
      toast('已载入记录');
    }
  });
  const histClear = $('#hist-clear');
  if (histClear) histClear.addEventListener('click', () => {
    if (!loadHistory().length) { toast('记录已是空的'); return; }
    saveHistoryList([]); renderHistory(); toast('已清空');
  });
  if (histPrivate) histPrivate.addEventListener('change', () => {
    const from = histPrivate.checked ? localStorage : getStore();
    const to = histPrivate.checked ? getStore() : localStorage;
    try {
      const data = from.getItem(HKEY);
      if (data) { to.setItem(HKEY, data); from.removeItem(HKEY); }
    } catch (e) {}
    renderHistory();
    toast(histPrivate.checked ? '无痕模式已开：关标签页后记录自动清除' : '无痕模式已关：记录持久保存于本浏览器');
  });
  function ensureThinkBox() {
    let body = document.getElementById('ai-think-body');
    if (!body) {
      const slot = $('#ai-think-slot') || $('#ime-out');
      const box = document.createElement('details');
      box.id = 'ai-think';
      box.className = 'ai-think';
      box.open = true;
      box.innerHTML = '<summary>AI 思考过程</summary><div class="ai-think-body dim" id="ai-think-body"></div>';
      slot.innerHTML = '';
      slot.appendChild(box);
      body = box.querySelector('.ai-think-body');
    }
    return body;
  }
  // ---------- AI 调用（带序号防串、防覆盖；完成后写入记录） ----------
  let aiSeq = 0;
  async function runAI(auto) {
    const text = input.value.trim();
    if (!text) { if (!auto) aiErr.textContent = '先在左侧输入内容，再调用 AI。'; return; }
    if (state.dir === 'fwd' && !/[\u3400-\u9fff]/.test(text)) { if (!auto) aiErr.textContent = '正向模式：输入里没有中文，逐词直译即可，无需 AI。'; return; }
    if (state.dir === 'rev' && !rconv) { if (!auto) aiErr.textContent = '请先输入龙语。'; return; }
    const seq = ++aiSeq;
    const dir0 = state.dir;
    aiBtn.disabled = true; aiBtn.textContent = 'AI 处理中…'; aiErr.textContent = '';
    if (!auto) { input.readOnly = true; $('#ime').classList.add('ai-busy'); }
    try {
      if (dir0 === 'fwd') {
        const ref = (conv && conv.tokens ? conv.tokens : []).map(t => {
          if (t.kind === 'sep') return t.src || '';
          if (t.kind === 'gram') return '[' + t.src + ']';
          if (t.kind === 'unk') return t.src + '=未收录' + (t.translit ? '(音译' + t.translit + ')' : '');
          const c = t.cands[t.sel];
          if (!c) return t.src + '=暂无对应';
          return t.src + '→' + c.dov + '(' + c.en + ')';
        }).filter(Boolean).join('；');
        const user = '中文原文：' + text + '\n离线逐词参考（可能有误）：' + ref;
        const dov = await llm(SYS_FWD, user);
        if (seq !== aiSeq) return;
        const clean = dov.replace(/[。，、．.!！?？"」」']+$|^["「「']/g, '').trim();
        if (!/^[A-Za-z'[\u0027 \-]+$/u.test(clean)) throw new Error('AI 返回的不是龙语拉丁转写，请重试');
        state.aiDov = clean; state.aiSource = text;
        pushHistory({ dir: 'fwd', t: Date.now(), input: text, dov: clean });
        if (input.value.trim() === text) { renderConvert(); toast('AI 已直译为龙语'); }
        else toast('输入已变化，本次 AI 结果已存入记录');
      } else {
        const ref = rconv.tokens.map(t => t.kind === 'dov'
          ? t.dov + '=' + t.glossMain + (t.zh.length ? '/' + t.zh.join(',') : '')
          : t.src + (t.translit ? '≈' + t.translit : '') + '=未收录').join('；');
        const user = '龙语原文：' + text + '\n离线逐词参考（可能有误）：' + ref;
        const zh = await llm(SYS_REV, user);
        if (seq !== aiSeq) return;
        state.aiZh = zh; state.aiZhSource = text;
        pushHistory({ dir: 'rev', t: Date.now(), input: text, zh: zh });
        if (input.value.trim() === text) { renderConvert(); toast('AI 已润成通顺中文'); }
        else toast('输入已变化，本次 AI 结果已存入「记录」');
      }
    } catch (e) {
      const noNet = /Failed to fetch|NetworkError|Load failed/i.test(e.message || '');
      aiErr.textContent = AI_ENDPOINT
        ? 'AI 调用失败：' + e.message
        : noNet
          ? '当前环境（应用内预览）禁止访问外网，AI 功能不可用：请用 Edge/Chrome 双击打开本文件使用；词典、双向转换、符文等其余功能全部离线可用。'
          : 'AI 调用失败：' + e.message + '。接口需允许浏览器跨域(CORS)。';
    } finally {
      if (seq === aiSeq) {
        aiBtn.disabled = false; aiBtn.textContent = state.dir === 'fwd' ? 'AI 翻译' : 'AI 润成通顺中文';
        input.readOnly = false; $('#ime').classList.remove('ai-busy');
      }
    }
  }
  aiBtn.addEventListener('click', () => runAI(false));

  // ---------- 即时翻译：停顿约 1.2s 自动触发一次（可开关） ----------
  let autoTimer = null, lastAutoKey = '';
  const autoToggle = $('#auto-toggle');
  function maybeAutoAI() {
    if (!autoToggle || !autoToggle.checked) return;
    if (aiBtn.disabled) return;
    const text = input.value.trim();
    if (!text) return;
    if (state.dir === 'fwd' && !/[\u3400-\u9fff]/.test(text)) return;
    const key = state.dir + '|' + text;
    if (key === lastAutoKey) return;
    lastAutoKey = key;
    runAI(true);
  }
  const SYS_FWD = '你是《上古卷轴5》龙语(Dovahzul)翻译专家。用户给出一句中文与一条离线逐词参考（可能有误，仅供参考）。请把中文直接译成龙语拉丁转写：主谓宾陈述语序（疑问句也用陈述语序）；动词无时态，需要时用助词 fen=将、fent=应当、drey=曾经、lost=已经、los=正在/是；通常不用冠词（fin/faal=the、aan=a 仅需强调时用）；属格 dii=我的、hin=你的、ok=他的、ek=她的，或词尾 i/u；复数=重复词尾字母加 e；完成体词尾 aan；否定 ni/nid；复合词中心词在前；擇号可省略（Zu\'u 与 Zuu 均可）；没有字母 C，用 K；人名等专名按发音音译。只使用真实存在的龙语词（如 zu\'u=我、los=是、dovah=龙、dovahkiin=龙裔、koraav=看、yol=火、kren=战斗），拿不准就用简单词组合表达。只输出这一句龙语拉丁转写本身，不加任何解释与标点。';
  const SYS_REV = '你是《上古卷轴5》龙语(Dovahzul)翻译专家。用户会给出一行龙语拉丁转写原文，以及一条离线逐词参考（可能有误，仅供参考）。请按龙语语法自己理解原文，译成一句通顺自然的中文。龙语语法要点：语序主谓宾近似英语但更简单；动词无时态变化，助词 fen=将、fent=应当、drey=曾经、lost=已经、los=正在/是；冠词 fin/faal=the、aan=a/an；属格：词尾 i=他的/其、u=我们的，独立代词 dii=我的、hin=你的、ok=他的、ek=她的；复数=重复词尾字母加 e；完成体词尾 aan；否定 ni/nid，前缀 vo- 表相反；复合词中心词在前（vulonkrein=夜+太阳=月）；擇号只是转写记号可忽略；字母 C 一律写作 K。未收录词多为汉字拼音或专有名词音译，请按最合理的中文还原（如人名）。只输出这一句中文本身，不加解释。';
  async function llm(sys, user) {
    if (AI_ENDPOINT) {
      llmController = new AbortController();
      window.addEventListener('pagehide', () => { try { llmController.abort(); } catch (e) {} }, { once: true });
      const r = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify({ direction: state.dir, text: user }),
        signal: llmController.signal
      });
      if (!r.ok) {
        let msg = 'HTTP ' + r.status;
        try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      let raw = '';
      if (r.body && r.body.getReader) {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        aiThinkText = '';
        const box = ensureThinkBox();
        for (;;) {
          const res = await reader.read();
          if (res.done) break;
          raw += dec.decode(res.value, { stream: true });
          const open = raw.indexOf('<think>');
          const close = raw.indexOf('</think>');
          let thinkPart = '';
          if (open >= 0) thinkPart = close >= 0 ? raw.slice(open + 7, close) : raw.slice(open + 7);
          let ansPart = close >= 0 ? raw.slice(close + 8) : '';
          const live = ansPart ? thinkPart + (thinkPart ? '\n\n—— 以下为正文 ——\n' : '') + ansPart : thinkPart;
          box.textContent = live;
          aiThinkText = live;
        }
      } else {
        raw = await r.text();
      }
      const t = dropThink(raw).trim().replace(/^["'「」]+|["'「」。]+$/g, '');
      if (!t) throw new Error('模型返回为空');
      return t;
    }
    const base = aiCfg.base.value.trim().replace(/\/+$/, ''), model = aiCfg.model.value.trim(), key = aiCfg.key.value.trim();
    if (!base || !model || !key) throw new Error('请先展开「AI 接口设置」填好接口地址、模型名和 API Key');
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const t = ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim().replace(/^["'「」]+|["'「」。]+$/g, '');
    if (!t) throw new Error('模型返回为空');
    return t;
  }
  $$('.ex-chip').forEach(b => b.addEventListener('click', () => { input.value = b.getAttribute('data-ex'); aiThinkText = ''; renderConvert(); input.focus(); }));
  function canonBadge(c) { return '<span class="badge b' + c + '">' + CANON_TXT[c] + '</span>'; }

  // ---------- 词典面板 ----------
  const dq = $('#dict-q');
  let dictCanon = 0, dictOffset = 0, dictRes = null;
  const canonSeg = $$('#dict-canon .seg button');
  canonSeg.forEach(b => b.addEventListener('click', () => {
    canonSeg.forEach(x => x.setAttribute('aria-pressed', x === b));
    dictCanon = +b.getAttribute('data-v'); dictOffset = 0; renderDict();
  }));
  let dq2;
  dq.addEventListener('input', () => { clearTimeout(dq2); dq2 = setTimeout(() => { dictOffset = 0; renderDict(); }, 150); });
  function renderDict() {
    const q = dq.value.trim();
    dictRes = E.searchDict(q, dictCanon, 60, dictOffset);
    const total = dictRes.total;
    $('#dict-count').textContent = total ? (q ? '「' + q + '」命中 ' + total + ' 条' + (dictRes.via === 'zh' ? '（经中文→英文桥接）' : '') : '共 ' + total + ' 条') : '';
    const box = $('#dict-list');
    if (!total) {
      box.innerHTML = '<div class="empty"><p>没有找到「' + esc(q) + '」。</p><p class="dim">试试更短的词：龙语词（如 fus）、英文释义（如 force）、或单个汉字（如 龙）。</p></div>';
      $('#dict-more').hidden = true;
      return;
    }
    const rows = dictRes.list.map(i => {
      const e = E.lexGet(i);
      const pos = POS_ZH[e[3]] || e[3] || '';
      const zh = zhSensesFor(e[1]);
      return '<div class="dict-row">' +
        '<span class="rune dict-rune" aria-hidden="true">' + esc(C.toRuneKeys(e[0])) + '</span>' +
        '<div class="dict-main"><div class="dict-word">' + esc(e[0]) + ' ' + canonBadge(e[2]) + (pos ? ' <span class="pos">' + esc(pos) + '</span>' : '') + '</div>' +
        '<div class="dict-en">' + esc(e[1]) + '</div>' +
        (zh ? '<div class="dict-zh">' + esc(zh) + '</div>' : '') +
        (e[4] ? '<details class="dict-note"><summary>构词注</summary>' + esc(e[4]) + '</details>' : '') +
        '</div></div>';
    }).join('');
    box.innerHTML = dictOffset === 0 ? rows : box.innerHTML + rows;
    $('#dict-more').hidden = dictOffset + 60 >= total;
    $('#dict-more').textContent = '再加载 60 条（剩 ' + (total - dictOffset - 60) + '）';
  }
  $('#dict-more').addEventListener('click', () => { dictOffset += 60; renderDict(); });
  const ZH_BIDIR = [];
  window.DOV_ZH.forEach(z => ZH_BIDIR.push(z));
  window.DOV_ZH_EXTRA.forEach(z => ZH_BIDIR.push(z));
  function zhSensesFor(gloss) {
    const g = gloss.toLowerCase();
    const hits = [];
    for (const z of ZH_BIDIR) {
      if (z[2].some(s => s.length > 1 && (g === s || g.split(/\s*;\s*|\s*\/\s*/).some(x => x === s)))) hits.push(z[0]);
      if (hits.length >= 3) break;
    }
    return hits.join(' · ');
  }

  // ---------- 龙吼面板 ----------
  (function renderShouts() {
    const groups = [
      ['base', '本体 Skyrim（20）'], ['DG', 'Dawnguard 黎明守卫（3）'], ['DB', 'Dragonborn 龙裔（4）'], ['npc', 'NPC 专属（龙与英灵，不可习得）']
    ];
    $('#shout-groups').innerHTML = groups.map(([k, label]) => {
      const items = window.DOV_SHOUTS.filter(s => s.src === k);
      return '<section class="shout-group"><h2>' + label + '</h2>' + items.map(s =>
        '<article class="shout">' +
        '<header><b>' + esc(s.cn) + '</b><span class="dim">' + esc(s.n) + '</span></header>' +
        '<div class="shout-words">' + s.w.map(w =>
          '<div class="sw" title="' + esc(w[0]) + '"><span class="rune sw-rune" aria-hidden="true">' + esc(C.toRuneKeys(w[0])) + '</span><b>' + esc(w[0]) + '</b><span class="sw-t">' + esc(w[1]) + '</span></div>').join('') + '</div>' +
        '<p class="shout-e">' + esc(s.e) + '</p></article>').join('') + '</section>';
    }).join('');
  })();

  // ---------- 语法面板：屈折变化器 ----------
  const infIn = $('#inf-word');
  function renderInf() {
    const w = infIn.value.trim() || 'kel';
    const box = $('#inf-out');
    const forms = ['plural', 'poss', 'our', 'perf'];
    const names = { plural: '复数（……们）', poss: '属格（我的/其）', our: '属格（我们的）', perf: '完成体（已……）' };
    const html = forms.map(f => {
      const r = E.inflect(w, f);
      if (!r) return '';
      return '<div class="inf-row"><span class="inf-name">' + names[f] + '</span><b class="inf-word">' + esc(r.word) + '</b><span class="rune small" aria-hidden="true">' + esc(r.runes) + '</span><span class="inf-rule dim">' + esc(r.rule) + '</span></div>';
    }).join('');
    box.innerHTML = html || '<p class="dim">请输入只含拉丁字母的龙语词。</p>';
  }
  infIn.addEventListener('input', renderInf);
  renderInf();

  // ---------- 符文面板：IPA 双元音表 ----------
  (function renderIpa() {
    $('#ipa-table').innerHTML = '<table class="ds-table"><thead><tr><th>双元音</th><th>IPA</th><th>示例</th></tr></thead><tbody>' +
      window.DOV_DIGRAPH_IPA.map(r => '<tr><td><b>' + r[0] + '</b></td><td class="num">' + r[1] + '</td><td class="dim">' + esc(r[2]) + '</td></tr>').join('') + '</tbody></table>';
  })();

  // ---------- 撇号规范还原（zuu → zu'u，词库驱动；node 可测） ----------
  // ==== DOV_APOS:BEGIN (pure, node 可测) ====
  window.DOV_APOS = (function () {
    'use strict';
    // 依据词库构建「无撇号形 -> 规范撇号形」映射（canon 高者优先；无撇号形本身是词条时不映射）
    function buildMap(lexCount, lexGet) {
      const plain = new Set();
      const words = [];
      for (let i = 0; i < lexCount; i++) {
        const e = lexGet(i);
        const w = String(e[0]).toLowerCase();
        words.push({ w: w, canon: e[2] });
        if (!/['’]/.test(w)) plain.add(w);
      }
      const map = new Map();
      words.forEach(x => {
        if (!/['’]/.test(x.w)) return;
        const key = x.w.replace(/['’]/g, '');
        if (plain.has(key)) return;
        const cur = map.get(key);
        if (!cur || x.canon > cur.canon) map.set(key, { v: x.w, canon: x.canon });
      });
      const out = new Map();
      map.forEach((v, k) => out.set(k, v.v));
      return out;
    }
    // 逐词还原（保留空白与标点原样）
    function restore(latin, map) {
      return String(latin || '').split(/(\s+)/).map(t => (/^\s+$/.test(t) ? t : (map.get(t) || t))).join('');
    }
    return { buildMap: buildMap, restore: restore };
  })();
  // ==== DOV_APOS:END ====

  // ---------- 符文面板：符文打字机（打字即符文 + 对照条插入 + 即时逐词中文） ----------
  (function initTypewriter() {
    const ta = $('#tw-in');
    if (!ta) return;
    const APOS = window.DOV_APOS.buildMap(E.lexCount(), E.lexGet);
    function normalizeCaret(s, caret) {
      const text = C.toRuneKeys(s);
      const len = (s || '').length;
      const c = (typeof caret === 'number' && caret >= 0) ? Math.min(caret, len) : len;
      return { text: text, caret: C.toRuneKeys(s.slice(0, c)).length };
    }
    let composing = false;
    ta.addEventListener('compositionstart', () => { composing = true; });
    ta.addEventListener('compositionend', () => { composing = false; ta.dispatchEvent(new Event('input')); });
    function render() {
      const k = ta.value;
      const latin = window.DOV_APOS.restore(C.runeKeysToLatin(k).toLowerCase(), APOS);
      $('#tw-latin').textContent = k ? latin : '—';
      $('#tw-keys').textContent = k || '—';
      $('#tw-count').textContent = (k.match(/[^ ]/g) || []).length + ' 个符文';
      if (k.trim()) {
        const rc = E.convertReverse(latin);
        $('#tw-zh').textContent = rc.zhSentence || '—';
        $('#tw-en').textContent = rc.enLine || '';
      } else { $('#tw-zh').textContent = '—'; $('#tw-en').textContent = ''; }
      ta.style.height = 'auto';
      ta.style.height = (ta.scrollHeight + 4) + 'px';
    }
    ta.addEventListener('input', () => {
      if (composing) { render(); return; }
      const v = ta.value;
      if (v !== C.toRuneKeys(v)) {
        const r = normalizeCaret(v, ta.selectionStart);
        ta.value = r.text;
        try { ta.setSelectionRange(r.caret, r.caret); } catch (e) {}
      }
      render();
    });
    $$('.ex-chip[data-tw]').forEach(b => b.addEventListener('click', () => {
      ta.value = C.toRuneKeys(b.getAttribute('data-tw'));
      render();
      const L = ta.value.length;
      try { ta.setSelectionRange(L, L); } catch (e) {}
    }));
    $('#tw-strip').innerHTML = window.DOV_ALPHABET.map(a =>
      '<button class="tw-key" type="button" data-k="' + a[1] + '" aria-label="插入符文 ' + a[0] + '" title="' + esc(a[0] + ' — ' + a[2]) + '">' +
      '<span class="rune" aria-hidden="true">' + esc(a[1]) + '</span><span>' + esc(a[0]) + '</span></button>').join('');
    $('#tw-strip').addEventListener('click', e => {
      const b = e.target.closest('.tw-key');
      if (!b) return;
      const k = b.getAttribute('data-k');
      const s = ta.selectionStart, en = ta.selectionEnd;
      if (s == null) ta.value += k;
      else ta.setRangeText(k, s, en, 'end');
      render();
      ta.focus();
    });
    $('#tw-copy-latin').addEventListener('click', () => { if (ta.value) copyText(window.DOV_APOS.restore(C.runeKeysToLatin(ta.value).toLowerCase(), APOS), '转写'); });
    $('#tw-ai').addEventListener('click', () => {
      const latin = window.DOV_APOS.restore(C.runeKeysToLatin(ta.value).toLowerCase(), APOS);
      if (!latin.trim()) { toast('先打点龙语，再 AI 翻译'); return; }
      aiThinkText = '';
      state.inputs.rev = latin;
      activateTab(tabs.find(x => x.getAttribute('data-panel') === 'ime') || tabs[0]);
      setDir('rev');
      runAI(false);
    });
    $('#tw-clear').addEventListener('click', () => { ta.value = ''; render(); ta.focus(); });
    render();
  })();

  // ---------- 学习面板：三档小测（纯出题逻辑，node 可测） ----------
  // ==== DOV_QUIZ:BEGIN (pure, node 可测) ====
  window.DOV_QUIZ = (function () {
    'use strict';
    // 句子题库：人工编写（龙语词均可在词库查到，中文为规范译法）；另有 buildGenSentences 用词库动态扩展
    const SENTENCES = [
      ["Zu'u los dovahkiin.", '我是龙裔。'],
      ['Los hi dovahkiin?', '你是龙裔吗？'],
      ['Rok los dovahkiin.', '他是龙裔。'],
      ['Los rok dovahkiin?', '他是龙裔吗？'],
      ['Geh, rok los dovahkiin.', '是的，他是龙裔。'],
      ["Zu'u los dovah.", '我是一条龙。'],
      ['Hi los dii zeymah.', '你是我的兄弟。'],
      ['Rok los dii zeymah.', '他是我的兄弟。'],
      ['Hi los dii kiim.', '你是我的妻子。'],
      ['Wo los hin bormah?', '谁是你的父亲？'],
      ['Wo los hin monah?', '谁是你的母亲？'],
      ['Bormah los pruzah.', '父亲是好的。'],
      ['Monah los pruzah.', '母亲是好的。'],
      ['Dovah los sahrot.', '龙是强大的。'],
      ['Krein los sahrot.', '太阳是强大的。'],
      ["Su'um los sahrot.", '气息是强大的。'],
      ["Thu'um los sahrot.", '龙吼是强大的。'],
      ['Jun los sahrot.', '王是强大的。'],
      ['Thur los sahrot.', '霸主是强大的。'],
      ['Vokun los sahrot.', '暗影是强大的。'],
      ['Mu los kril.', '我们是勇敢的。'],
      ['Nust los kril.', '他们是勇敢的。'],
      ['Grohiik los kril.', '狼是勇敢的。'],
      ["Zu'u los sahlo.", '我是弱小的。'],
      ['Los hi sahlo?', '你弱小吗？'],
      ['Laas los pruzah.', '生命是好的。'],
      ['Yol ahrk iiz.', '火与冰。'],
      ['Vulon ahrk krein.', '夜与日。'],
      ['Dovah ahrk dovahkiin.', '龙与龙裔。'],
      ['Bormah ahrk monah.', '父与母。'],
      ['Wo los hin zeymah?', '谁是你的兄弟？'],
      ["Su'um ahrk morah.", '气息与智慧。', '灰胡子修行语'],
      ['Geh ahrk nid.', '是与非。'],
      ['Drem yol lok.', '你好。', '字面：和平·火·天空'],
      ['Zeymah, drem yol lok.', '兄弟，你好。'],
      ['Nox, zeymah.', '谢谢你，兄弟。'],
      ['Ful nii los.', '就是这样。'],
      ['Rinik pruzah.', '很好。'],
      ["Zu'u dreh ni mindok.", '我不知道。'],
      ["Krosis, zu'u ni mindok.", '抱歉，我不知道。'],
      ["Nid, zu'u ni drey tinvaak.", '不，我没有说话。'],
      ["Zu'u koraav dovah.", '我看见龙。'],
      ["Zu'u fen koraav dovah.", '我将看见龙。'],
      ["Zu'u koraav vokun.", '我看见暗影。'],
      ["Zu'u lost mindok.", '我已经知道了。'],
      ['Hi lost mindok?', '你已经知道了吗？'],
      ["Zu'u drey naak.", '我吃过东西了。'],
      ['Mu drey naak.', '我们吃过东西了。'],
      ['Mu drey kren.', '我们战斗过。'],
      ['Dovah drey bo.', '龙曾到来。'],
      ['Vulon los dii.', '夜是我的。']
    ];
    function shuffle(arr, rnd) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rnd ? rnd() : Math.random()) * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    }
    function pickDistractors(all, correctVal, labelOf, n, rnd) {
      const seen = new Set([correctVal]);
      const out = [];
      for (const c of shuffle(all, rnd)) {
        if (out.length >= n) break;
        const lb = labelOf(c);
        if (seen.has(lb)) continue;
        seen.add(lb); out.push(c);
      }
      return out;
    }
    function buildBasicPool(alphabet) {
      return (alphabet || []).map(a => ({ name: a[0], key: a[1], hint: a[2], digraph: /[0-9]/.test(a[1]) }));
    }
    function buildWordPool(lexCount, lexGet, zhFor) {
      const POS = { noun: 1, verb: 1, adjective: 1 };
      const pool = [];
      for (let i = 0; i < lexCount; i++) {
        const e = lexGet(i);
        if (e[2] !== 2 || !POS[e[3]]) continue;
        const zh = zhFor(e[1]);
        if (!zh) continue;
        pool.push({ dov: e[0], gloss: e[1].split(';')[0].trim(), zh: zh.split(' · ')[0], pos: e[3] });
      }
      return pool;
    }
    // 用词库动态生成简单句（六种模板：名+形 / 名与名 / 我看见 / 你看见 / 我们看见 / 否定句），中文由词义拼装
    function buildGenSentences(wordPool, n, rnd) {
      const R = rnd || Math.random;
      const nouns = wordPool.filter(w => w.pos === 'noun');
      const adjs = wordPool.filter(w => w.pos === 'adjective');
      const out = [];
      const used = new Set();
      let guard = 0;
      const want = n || 200;
      while (out.length < want && guard++ < want * 30) {
        let dov = null, zh = null;
        const t = R();
        if (t < 0.30 && nouns.length && adjs.length) {
          const nn = nouns[Math.floor(R() * nouns.length)];
          const aa = adjs[Math.floor(R() * adjs.length)];
          if (nn.dov === aa.dov) continue;
          dov = nn.dov + ' los ' + aa.dov + '.';
          zh = nn.zh + '是' + aa.zh + '的。';
        } else if (t < 0.44 && nouns.length && adjs.length) {
          const nn = nouns[Math.floor(R() * nouns.length)];
          const aa = adjs[Math.floor(R() * adjs.length)];
          if (nn.dov === aa.dov) continue;
          dov = nn.dov + ' ni los ' + aa.dov + '.';
          zh = nn.zh + '不是' + aa.zh + '的。';
        } else if (t < 0.64 && nouns.length >= 2) {
          const n1 = nouns[Math.floor(R() * nouns.length)];
          const n2 = nouns[Math.floor(R() * nouns.length)];
          if (n1.dov === n2.dov || n1.zh === n2.zh) continue;
          dov = n1.dov + ' ahrk ' + n2.dov + '.';
          zh = n1.zh + '与' + n2.zh + '。';
        } else if (t < 0.76 && nouns.length) {
          const nn = nouns[Math.floor(R() * nouns.length)];
          dov = "Zu'u koraav " + nn.dov + '.';
          zh = '我看见' + nn.zh + '。';
        } else if (t < 0.88 && nouns.length) {
          const nn = nouns[Math.floor(R() * nouns.length)];
          dov = 'Hi koraav ' + nn.dov + '.';
          zh = '你看见' + nn.zh + '。';
        } else if (nouns.length) {
          const nn = nouns[Math.floor(R() * nouns.length)];
          dov = 'Mu koraav ' + nn.dov + '.';
          zh = '我们看见' + nn.zh + '。';
        } else continue;
        if (used.has(dov) || used.has(zh)) continue;
        used.add(dov); used.add(zh);
        out.push([dov, zh]);
      }
      return out;
    }
    function makeQuestion(tier, deps, rnd) {
      const R = rnd || Math.random;
      if (tier === 'basic') {
        const p = deps.alphabet;
        if (!p.length) return null;
        const item = p[Math.floor(R() * p.length)];
        const cat = p.filter(x => x.digraph === item.digraph && x.name !== item.name);
        const dis = pickDistractors(cat, item.name, c => c.name, 3, R);
        if (dis.length < 3) return null;
        if (R() < 0.5) {
          const opts = shuffle([{ label: item.key, display: 'rune' }].concat(dis.map(d => ({ label: d.key, display: 'rune' }))), R);
          return { tier: tier, kind: 'l2r', key: 'alpha|' + item.name, explain: item.name + ' = 键位 ' + item.key + (item.hint ? ' · ' + item.hint : ''), prompt: { text: item.name, sub: '对应的符文是？' }, options: opts, answer: opts.findIndex(o => o.label === item.key) };
        }
        const opts = shuffle([{ label: item.name, display: 'text' }].concat(dis.map(d => ({ label: d.name, display: 'text' }))), R);
        return { tier: tier, kind: 'r2l', key: 'alpha|' + item.name, explain: item.name + ' = 键位 ' + item.key + (item.hint ? ' · ' + item.hint : ''), prompt: { rune: item.key, sub: '这个符文是？' }, options: opts, answer: opts.findIndex(o => o.label === item.name) };
      }
      if (tier === 'word') {
        if (R() < 0.22 && deps.shouts && deps.shouts.length >= 4) {
          const s = deps.shouts[Math.floor(R() * deps.shouts.length)];
          const dis = pickDistractors(deps.shouts.filter(x => x.n !== s.n), s.cn, c => c.cn, 3, R);
          if (dis.length >= 3) {
            const opts = shuffle([{ label: s.cn, display: 'text' }].concat(dis.map(d => ({ label: d.cn, display: 'text' }))), R);
            return { tier: tier, kind: 'shout', key: 'shout|' + s.n, explain: s.n + '：' + s.w.map(x => x[0] + '=' + x[1]).join(' · '), prompt: { rune: s.w.map(w => deps.toRuneKeys(w[0])).join(' '), text: s.w.map(w => w[0]).join(' '), sub: '这条龙吼是？' }, options: opts, answer: opts.findIndex(o => o.label === s.cn) };
          }
        }
        const p = deps.wordPool;
        if (p.length < 8) return null;
        const w = p[Math.floor(R() * p.length)];
        // 干扰项过滤：排除中文近义（包含关系）与英文释义相同的词，避免「两个选项都像对的」
        const cand = p.filter(x => x.pos === w.pos
          && x.zh !== w.zh && !x.zh.includes(w.zh) && !w.zh.includes(x.zh)
          && x.gloss.toLowerCase() !== w.gloss.toLowerCase());
        const dis = pickDistractors(cand, w.zh, c => c.zh, 3, R);
        if (dis.length < 3) return null;
        if (R() < 0.5) {
          const opts = shuffle([{ label: w.zh, display: 'text' }].concat(dis.map(d => ({ label: d.zh, display: 'text' }))), R);
          return { tier: tier, kind: 'w2z', key: 'word|' + w.dov, explain: w.dov + ' — ' + w.gloss + '（' + w.zh + '）', prompt: { rune: deps.toRuneKeys(w.dov), text: w.dov, sub: '这个词的意思是？' }, options: opts, answer: opts.findIndex(o => o.label === w.zh) };
        }
        const opts = shuffle([{ label: w.dov, display: 'dov' }].concat(dis.map(d => ({ label: d.dov, display: 'dov' }))), R);
        return { tier: tier, kind: 'z2w', key: 'word|' + w.dov, explain: w.dov + ' — ' + w.gloss + '（' + w.zh + '）', prompt: { text: w.zh, sub: '表示这个意思的龙语词是？（英文提示：' + w.gloss.split(/[,;]/)[0].trim() + '）' }, options: opts, answer: opts.findIndex(o => o.label === w.dov) };
      }
      if (tier === 'sent') {
        const bank = deps.sentences;
        if (bank.length < 4) return null;
        const s = bank[Math.floor(R() * bank.length)];
        if (R() < 0.5) {
          const dis = pickDistractors(bank.filter(x => x !== s), s[1], c => c[1], 3, R);
          if (dis.length < 3) return null;
          const opts = shuffle([{ label: s[1], display: 'text' }].concat(dis.map(d => ({ label: d[1], display: 'text' }))), R);
          return { tier: tier, kind: 's2z', key: 'sent|' + s[0], explain: s[0] + ' — ' + s[1] + (s[2] ? '（注：' + s[2] + '）' : ''), prompt: { rune: deps.toRuneKeys(s[0]), text: s[0], sub: '这句龙语的含义是？' }, options: opts, answer: opts.findIndex(o => o.label === s[1]) };
        }
        const dis = pickDistractors(bank.filter(x => x !== s), s[0], c => c[0], 3, R);
        if (dis.length < 3) return null;
        const opts = shuffle([{ label: s[0], display: 'dov' }].concat(dis.map(d => ({ label: d[0], display: 'dov' }))), R);
        return { tier: tier, kind: 'z2s', key: 'sent|' + s[0], explain: s[0] + ' — ' + s[1] + (s[2] ? '（注：' + s[2] + '）' : ''), prompt: { text: s[1], sub: '表示这个意思的龙语句是？' }, options: opts, answer: opts.findIndex(o => o.label === s[0]) };
      }
      return null;
    }
    return { SENTENCES: SENTENCES, buildBasicPool: buildBasicPool, buildWordPool: buildWordPool, buildGenSentences: buildGenSentences, makeQuestion: makeQuestion };
  })();
  // ==== DOV_QUIZ:END ====

  // ---------- 学习面板：无限连刷 DOM（无任何系统弹窗，全部页内反馈；不计分） ----------
  (function initQuizPanel() {
    const stage = $('#quiz-stage');
    if (!stage) return;
    const deps = {
      alphabet: window.DOV_QUIZ.buildBasicPool(window.DOV_ALPHABET),
      wordPool: window.DOV_QUIZ.buildWordPool(E.lexCount(), E.lexGet, zhSensesFor),
      shouts: window.DOV_SHOUTS.filter(s => s.src !== 'npc'),
      sentences: window.DOV_QUIZ.SENTENCES.concat(window.DOV_QUIZ.buildGenSentences(window.DOV_QUIZ.buildWordPool(E.lexCount(), E.lexGet, zhSensesFor), 800)),
      toRuneKeys: C.toRuneKeys
    };
    const tierBtns = $$('#quiz-tier button');
    let tier = 'basic';
    let count = 0, lock = false, cur = null;
    const seen = new Set();
    tierBtns.forEach(b => b.addEventListener('click', () => {
      tierBtns.forEach(x => x.setAttribute('aria-pressed', x === b));
      tier = b.getAttribute('data-t');
      count = 0; seen.clear();
      showStart();
    }));
    function tierName(t) { return { basic: '基础 · 字母', word: '词组 · 词义', sent: '句子 · 翻译', mix: '混合 · 全部' }[t] || t; }
    function optHtml(o) {
      if (o.display === 'rune') return '<span class="rune" aria-hidden="true">' + esc(o.label) + '</span>';
      if (o.display === 'dov') return '<span class="rune" aria-hidden="true">' + esc(C.toRuneKeys(o.label)) + '</span><span class="opt-sub">' + esc(o.label) + '</span>';
      return '<span>' + esc(o.label) + '</span>';
    }
    function showStart() {
      lock = false; cur = null;
      stage.innerHTML =
        '<div class="quiz-sum" style="padding-top:34px">' +
        '<div class="rune" style="font-size:44px;color:var(--accent)">DR2M YOL LOK</div>' +
        '<p>无限连刷：一道接一道，答错当场亮出正确答案与解析；随时切难度，不设终点、不计分。</p>' +
        '<div class="copy-row" style="justify-content:center"><button class="btn" id="quiz-go">开始答题</button></div>' +
        '</div>';
      $('#quiz-go').addEventListener('click', nextQuestion);
    }
    function nextQuestion() {
      let q = null, guard = 0;
      while (guard++ < 120) {
        const t = tier === 'mix' ? ['basic', 'word', 'sent'][Math.floor(Math.random() * 3)] : tier;
        const cand = window.DOV_QUIZ.makeQuestion(t, deps);
        if (!cand) continue;
        const sig = cand.key || (cand.kind + '|' + (cand.prompt.rune || '') + '|' + (cand.prompt.text || ''));
        if (seen.has(sig)) { if (seen.size > 400) seen.clear(); continue; }
        seen.add(sig);
        q = cand;
        break;
      }
      if (!q) { toast('这个难度暂时没题了，换一档试试'); showStart(); return; }
      lock = false;
      cur = q;
      count++;
      const promptHtml =
        (q.prompt.rune ? '<div class="big-rune rune">' + esc(q.prompt.rune) + '</div>' : '') +
        (q.prompt.text ? '<div class="big-text">' + esc(q.prompt.text) + '</div>' : '') +
        (q.prompt.sub ? '<div class="sub">' + esc(q.prompt.sub) + '</div>' : '');
      stage.innerHTML =
        '<div class="quiz-meta"><span>' + tierName(tier) + ' · 已答 ' + count + ' 题</span><span class="dim">随时切换难度</span></div>' +
        '<div class="quiz-prompt">' + promptHtml + '</div>' +
        '<div class="quiz-opts">' + q.options.map((o, i) => '<button class="quiz-opt" type="button" data-i="' + i + '">' + optHtml(o) + '</button>').join('') + '</div>';
      stage.querySelectorAll('.quiz-opt').forEach(b => b.addEventListener('click', () => answer(+b.getAttribute('data-i'), b)));
    }
    function answer(i, btn) {
      if (lock || !cur) return;
      lock = true;
      const q = cur;
      const right = i === q.answer;
      const btns = stage.querySelectorAll('.quiz-opt');
      btns.forEach(b => { b.disabled = true; });
      if (right) {
        btn.classList.add('is-right');
      } else {
        btn.classList.add('is-wrong');
        btns[q.answer].classList.add('is-right');
      }
      if (q.explain) {
        const ex = document.createElement('div');
        ex.className = 'quiz-explain';
        ex.textContent = (right ? '✓ ' : '正确答案：') + q.explain;
        stage.querySelector('.quiz-opts').insertAdjacentElement('afterend', ex);
      }
      setTimeout(nextQuestion, right ? 850 : 1600);
    }
    showStart();
  })();

  // ---------- 启动 ----------
  setDir('fwd');
  renderDict();
  renderHistory();
  hashTab();
  window.addEventListener('hashchange', hashTab);
})();
