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
  const fixToggle = $('#fix-toggle');
  const selMap = {};
  let conv = null, rconv = null;
  const state = { dir: 'fwd', aiEnglish: null, aiSource: '', aiZh: null, aiZhSource: '', inputs: { fwd: '', rev: '' } };
  const dirBtns = $$('#dir-seg button');
  function setDir(d) {
    state.dir = d;
    dirBtns.forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-d') === d));
    $('#fix-toggle').closest('.fix-toggle').style.display = d === 'fwd' ? '' : 'none';
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
      '<div class="zh-line">' + esc(rconv.zhSentence) + '<span class="tag">逐词</span></div>' +
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
    const useAI = state.aiEnglish != null && state.aiSource === text;
    conv = E.convert(useAI ? state.aiEnglish : text, selMap, { fix: fixToggle.checked });
    const dovWords = [], chipHtml = [];
    conv.tokens.forEach((t, i) => {
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
    const sentence = dovWords.join(' ');
    const keys = C.toRuneKeys(sentence);
    out.innerHTML =
      '<div class="rune-hero" aria-hidden="true">' + esc(keys) + '</div>' +
      '<div class="dov-line num">' + esc(sentence || '（无可译词）') + '</div>' +
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
  input.addEventListener('input', () => { state.inputs[state.dir] = input.value; clearTimeout(deb); deb = setTimeout(renderConvert, 120); });
  fixToggle.addEventListener('change', renderConvert);

  // ---------- AI（站点模式=统一接口无需 Key；单文件模式=OpenAI 兼容自备配置；正向=中→龙中间英文，反向=润成通顺中文） ----------
  const aiBtn = $('#ai-btn'), aiErr = $('#ai-err');
  const aiCfg = { base: $('#ai-base'), model: $('#ai-model'), key: $('#ai-key') };
  const AI_ENDPOINT = window.DOV_AI_ENDPOINT || '';
  function csrfToken() {
    const inp = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (inp && inp.value) return inp.value;
    const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  const SYS_FWD = '你是《上古卷轴5》龙语(Dovahzul)输入法的翻译前置模块。把用户的中文译成英语，且英文必须按龙语习惯组织，供逐词查龙语词典使用：1) 一律陈述语序（主语+动词+其余），疑问句绝不倒装——龙语疑问句就是陈述语序，例如「你是谁」译为 You are who，「他在哪」译为 He is where；2) 不用任何冠词 a/an/the；3) 不用缩写；物主用 my/your/his/her；名词复数直接加 s；4) 时态用助词明示：将来加 will、过去加 did、完成用 have+过去分词；5) 只用最基础、具象的常见词（火、天空、国王、灵魂这类），避免抽象词与俚语，逐词对应、不增删内容；6) 只输出这一句英文本身，不加任何解释。';
  const SYS_REV = '下面是龙语句子逐词的英文释义，把它连成一句通顺自然的中文，保持原意、不增删内容，只输出这一句中文。';
  async function llm(sys, user) {
    if (AI_ENDPOINT) {
      const r = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify({ direction: state.dir, text: user })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = (await r.text()).trim().replace(/^["'「」]+|["'「」。]+$/g, '');
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
  aiBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) { aiErr.textContent = '先在左侧输入内容，再调用 AI。'; return; }
    if (state.dir === 'fwd' && !/[\u3400-\u9fff]/.test(text)) { aiErr.textContent = '正向模式：输入里没有中文，逐词直译即可，无需 AI。'; return; }
    if (state.dir === 'rev' && !rconv) { aiErr.textContent = '请先输入龙语。'; return; }
    aiBtn.disabled = true; aiBtn.textContent = 'AI 处理中…'; aiErr.textContent = '';
    try {
      if (state.dir === 'fwd') {
        const en = await llm(SYS_FWD, text);
        state.aiEnglish = en; state.aiSource = text;
        renderConvert();
        toast('AI 中→龙完成，中间英文已折叠为辅助行');
      } else {
        const zh = await llm(SYS_REV, rconv.enLine);
        state.aiZh = zh; state.aiZhSource = text;
        renderConvert();
        toast('AI 已润成通顺中文');
      }
    } catch (e) {
      const noNet = /Failed to fetch|NetworkError|Load failed/i.test(e.message || '');
      aiErr.textContent = AI_ENDPOINT
        ? 'AI 调用失败：' + e.message
        : noNet
          ? '当前环境（应用内预览）禁止访问外网，AI 功能不可用：请用 Edge/Chrome 双击打开本文件使用；词典、双向转换、符文等其余功能全部离线可用。'
          : 'AI 调用失败：' + e.message + '。接口需允许浏览器跨域(CORS)。';
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = state.dir === 'fwd' ? 'AI 翻译' : 'AI 润成通顺中文';
    }
  });
  $$('.ex-chip').forEach(b => b.addEventListener('click', () => { input.value = b.getAttribute('data-ex'); renderConvert(); input.focus(); }));
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

  // ---------- 符文面板 ----------
  (function renderAlphabet() {
    $('#alpha-grid').innerHTML = window.DOV_ALPHABET.map(a =>
      '<div class="alpha"><span class="rune alpha-rune" aria-hidden="true">' + a[1] + '</span><b>' + a[0] + '</b>' +
      '<span class="alpha-key dim num">键 ' + (a[1].length === 1 && /[0-9]/.test(a[1]) ? a[1] : a[1]) + '</span><span class="alpha-tip">' + esc(a[2]) + '</span></div>').join('');
    $('#ipa-table').innerHTML = '<table class="ds-table"><thead><tr><th>双元音</th><th>IPA</th><th>示例</th></tr></thead><tbody>' +
      window.DOV_DIGRAPH_IPA.map(r => '<tr><td><b>' + r[0] + '</b></td><td class="num">' + r[1] + '</td><td class="dim">' + esc(r[2]) + '</td></tr>').join('') + '</tbody></table>';
  })();

  const kbdState = { keys: '' };
  function renderKbd() {
    const latin = C.runeKeysToLatin(kbdState.keys);
    $('#kbd-rune').textContent = kbdState.keys || '​';
    $('#kbd-latin').textContent = latin ? latin.toLowerCase() : '—';
  }
  $('#kbd-buttons').innerHTML = window.DOV_ALPHABET.map(a =>
    '<button class="kbd-key" data-k="' + a[1] + '" aria-label="符文 ' + a[0] + '"><span class="rune" aria-hidden="true">' + a[1] + '</span><span class="kbd-sub">' + a[0] + '</span></button>').join('') +
    '<button class="kbd-key kbd-space" data-k=" " aria-label="空格"><span class="kbd-sub">空格</span></button>' +
    '<button class="kbd-key kbd-bk" data-k="bk" aria-label="退格"><span class="kbd-sub">退格</span></button>' +
    '<button class="kbd-key kbd-clr" data-k="clr" aria-label="清空"><span class="kbd-sub">清空</span></button>';
  $('#kbd-buttons').addEventListener('click', e => {
    const b = e.target.closest('.kbd-key');
    if (!b) return;
    const k = b.getAttribute('data-k');
    if (k === 'bk') kbdState.keys = kbdState.keys.slice(0, -1);
    else if (k === 'clr') kbdState.keys = '';
    else kbdState.keys += k;
    renderKbd();
  });
  $('#kbd-copy').addEventListener('click', () => copyText(C.runeKeysToLatin(kbdState.keys).toLowerCase(), '键盘拉丁'));
  renderKbd();

  const ltIn = $('#latin-in');
  function renderLatin() {
    const v = ltIn.value.trim();
    $('#latin-out').textContent = v ? C.toRuneKeys(v) : '—';
    $('#latin-dov').textContent = v ? C.translitForeign(v) : '—';
  }
  ltIn.addEventListener('input', renderLatin);
  renderLatin();

  // ---------- 启动 ----------
  setDir('fwd');
  renderDict();
  hashTab();
  window.addEventListener('hashchange', hashTab);
})();
