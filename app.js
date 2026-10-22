/* The Fifth Kingdom — companion quizzes. Plain JS, no build step, works offline. */
(() => {
  'use strict';

  const STORE = 'fk.progress.v1';
  const app = document.getElementById('app');
  const barTitle = document.getElementById('barTitle');
  const backBtn = document.getElementById('back');
  const LETTERS = 'ABCDEFGH';

  let chapters = [];       // loaded chapter objects
  let seq = [];            // linear unlock order: {ch, s} (s = section index or 'test')
  let state = load();

  function load() {
    try { return Object.assign(blank(), JSON.parse(localStorage.getItem(STORE)) || {}); }
    catch (e) { return blank(); }
  }
  function blank() { return { passed: {}, attempts: {}, results: {}, secMiss: {}, reviewSets: {}, reviewUsed: {} }; }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  const keyOf = (ch, s) => `${ch}:${s}`;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Allow *italics* for genus/species names in question text.
  const fmt = (t) => esc(t).replace(/\*([^*]+)\*/g, '<i>$1</i>');
  const pages = (p) => (p[0] === p[1] ? `p. ${p[0]}` : `pp. ${p[0]}–${p[1]}`);

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- content ---------- */
  async function init() {
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }
    try {
      const idx = await (await fetch('content/index.json')).json();
      chapters = await Promise.all(idx.chapters.map(async (f) => (await fetch('content/' + f)).json()));
      chapters.sort((a, b) => a.n - b.n);
    } catch (e) {
      app.innerHTML = '<p class="loading">Couldn’t load the quizzes. Open the app once with a connection so it can save itself for offline use.</p>';
      return;
    }
    seq = [];
    for (const c of chapters) {
      const parts = testsOf(c);
      c.sections.forEach((_, i) => {
        seq.push({ ch: c.n, s: i });
        const t = parts.find((p) => p.to === i);
        if (t) seq.push({ ch: c.n, s: t.key });
      });
    }
    window.addEventListener('hashchange', route);
    route();
  }

  const chap = (n) => chapters.find((c) => c.n === n);
  // A chapter has one test covering everything, or (with `parts`) several tests, each covering a run of sections.
  // The last test always uses key 'test'; earlier ones are 'test1', 'test2', ...
  function testsOf(c) {
    if (c._tests) return c._tests;
    const last = c.sections.length - 1;
    if (!c.parts || c.parts.length < 2) return (c._tests = [{ key: 'test', from: 0, to: last, title: `Chapter ${c.n} Test` }]);
    let from = 0;
    return (c._tests = c.parts.map((p, i) => {
      const final = i === c.parts.length - 1;
      const t = { key: final ? 'test' : `test${i + 1}`, from, to: final ? last : p.until, title: `Chapter ${c.n} Test, Part ${i + 1}`, partTitle: p.title, part: i + 1 };
      from = t.to + 1;
      return t;
    }));
  }
  const isTestKey = (s) => typeof s === 'string' && /^test\d*$/.test(s);
  function itemOf(ch, s) {
    const c = chap(ch);
    if (!c) return null;
    if (isTestKey(s)) {
      const t = testsOf(c).find((x) => x.key === s);
      if (!t) return null;
      const whole = t.from === 0 && t.to === c.sections.length - 1;
      return { c, t, title: t.title, isTest: true, whole, questions: c.test.filter((q) => q.s >= t.from && q.s <= t.to),
        pages: whole ? c.pages : [c.sections[t.from].pages[0], c.sections[t.to].pages[1]] };
    }
    const sec = c.sections[s];
    return sec && { c, sec, title: sec.title, questions: sec.questions, isTest: false, pages: sec.pages };
  }
  function isUnlocked(ch, s) {
    for (const it of seq) {
      if (it.ch === ch && it.s === s) return true;
      if (!state.passed[keyOf(it.ch, it.s)]) return false;
    }
    return false;
  }
  const isPassed = (ch, s) => !!state.passed[keyOf(ch, s)];
  function current() { return seq.find((it) => !isPassed(it.ch, it.s)); }

  /* ---------- routing ---------- */
  function go(hash) { location.hash = hash; }
  function route() {
    const h = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (h[0] === 'ch' && chap(+h[1])) return viewChapter(+h[1]);
    if (h[0] === 'q' && h.length >= 3) {
      const ch = +h[1], s = isTestKey(h[2]) ? h[2] : +h[2];
      if (itemOf(ch, s) && isUnlocked(ch, s)) {
        if (h[3] === 'go') return viewQuestion(ch, s);
        if (h[3] === 'result') return viewResult(ch, s);
        return viewIntro(ch, s);
      }
    }
    viewHome();
  }
  function setBar(title, backTo) {
    barTitle.textContent = title;
    backBtn.hidden = !backTo;
    backBtn.onclick = backTo ? () => go(backTo) : null;
  }

  /* ---------- views ---------- */
  const chev = '<svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const lockIcon = '<svg class="chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const check = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function viewHome() {
    setBar('The Fifth Kingdom', null);
    const done = seq.filter((it) => isPassed(it.ch, it.s)).length;
    const cur = current();
    let html = `<h1>The Fifth Kingdom</h1>
      <p class="sub">Companion quizzes · Kendrick, 4th edition</p>
      <div class="overall"><div class="meter"><i style="width:${seq.length ? (100 * done / seq.length).toFixed(1) : 0}%"></i></div><span>${done} / ${seq.length} passed</span></div>`;
    if (cur) {
      const it = itemOf(cur.ch, cur.s);
      html += `<button class="btn" id="cont">${state.attempts[keyOf(cur.ch, cur.s)] ? 'Resume' : 'Continue'}: ${it.isTest ? esc(it.title) : `Ch. ${cur.ch} · ${esc(it.title)}`}</button>`;
    }
    html += '<h2>Chapters</h2><ul class="list">';
    for (const c of chapters) {
      const items = seq.filter((it) => it.ch === c.n);
      const n = items.filter((it) => isPassed(it.ch, it.s)).length;
      const unlocked = isUnlocked(c.n, 0);
      const cls = n === items.length ? 'done' : unlocked ? 'current' : 'locked';
      html += `<li><button class="row ${cls}" data-ch="${c.n}" ${unlocked ? '' : 'disabled'}>
        <span class="num">${n === items.length ? check : c.n}</span>
        <span class="body"><span class="t">${esc(c.title)}</span><span class="m">${pages(c.pages)} · ${n}/${items.length} passed</span></span>
        ${unlocked ? chev : lockIcon}</button></li>`;
    }
    html += `</ul><div class="foot">Progress is saved on this device.<br><button id="reset">Reset all progress</button></div>`;
    app.innerHTML = html;
    const cont = document.getElementById('cont');
    if (cont) cont.onclick = () => go(`/q/${cur.ch}/${cur.s}`);
    app.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => go(`/ch/${b.dataset.ch}`)));
    const reset = document.getElementById('reset');
    reset.onclick = () => {
      if (reset.dataset.armed) {
        state = blank(); save(); viewHome();
      } else { reset.dataset.armed = '1'; reset.textContent = 'Tap again to erase everything'; }
    };
  }

  function viewChapter(n) {
    const c = chap(n);
    setBar(`Chapter ${n}`, '/');
    let html = `<h1>${esc(c.title)}</h1><p class="sub">Chapter ${n} · ${pages(c.pages)}</p><ul class="list">`;
    const rows = [];
    c.sections.forEach((s, i) => {
      rows.push({ s: i, title: s.title, meta: `${pages(s.pages)} · ${s.questions.length} questions` });
      const t = testsOf(c).find((x) => x.to === i);
      if (t) {
        const ti = itemOf(n, t.key);
        const cover = ti.whole ? 'Whole chapter' : `${t.partTitle} · sections ${t.from + 1}–${t.to + 1}`;
        rows.push({ s: t.key, title: t.title, meta: `${esc(cover)} · ${totalFor(ti)} questions`, test: true });
      }
    });
    rows.forEach((r) => {
      const passed = isPassed(n, r.s), unlocked = isUnlocked(n, r.s);
      const inProg = !!state.attempts[keyOf(n, r.s)];
      const cls = passed ? 'done' : unlocked ? 'current' : 'locked';
      const tag = r.test ? '<span class="tag test">Test</span>' : '';
      const extra = inProg ? ' · in progress' : passed ? ' · passed' : '';
      html += `<li><button class="row ${cls}" data-s="${r.s}" ${unlocked ? '' : 'disabled'}>
        <span class="num">${passed ? check : r.test ? 'T' : r.s + 1}</span>
        <span class="body"><span class="t">${esc(r.title)}${tag}</span><span class="m">${r.meta}${extra}</span></span>
        ${unlocked ? chev : lockIcon}</button></li>`;
    });
    html += '</ul>';
    app.innerHTML = html;
    app.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => go(`/q/${n}/${b.dataset.s}`)));
  }

  function viewIntro(ch, s) {
    const it = itemOf(ch, s), k = keyOf(ch, s);
    setBar(it.isTest ? it.title : `Chapter ${ch}`, `/ch/${ch}`);
    const att = state.attempts[k], res = state.results[k], passed = isPassed(ch, s);
    const cover = !it.isTest ? `Chapter ${ch}` : it.whole ? `Covers all of Chapter ${ch}` : `Part ${it.t.part}: ${esc(it.t.partTitle)} · sections ${it.t.from + 1}–${it.t.to + 1}`;
    let html = `<div class="kind">${it.isTest ? (it.whole ? 'Chapter test' : `Chapter test · Part ${it.t.part}`) : 'Section quiz'}</div>
      <h1>${esc(it.isTest ? it.c.title : it.title)}</h1>
      <p class="sub">${cover} · ${pages(it.pages)}</p>
      <div class="card"><div class="facts"><div><b>${totalFor(it)}</b>questions</div><div><b>100%</b>to pass</div>${res ? `<div><b>${res.best}/${res.total || totalFor(it)}</b>best score</div>` : ''}</div>
      ${it.isTest && reviewCount(it) ? `<p>Includes <b>${reviewCount(it)} review questions</b> on earlier chapters. You keep the same review questions on retakes until you pass.</p>` : ''}
      <p>Answer every question, then submit. You can move back and forth and change answers before submitting.</p>
      <p>Answers aren’t revealed. If you miss any, you’ll be told which pages to reread, then you retake the whole ${it.isTest ? 'test' : 'quiz'} with the questions and choices shuffled.</p></div>`;
    if (att) {
      const answered = att.answers.filter((a) => a !== null).length;
      html += `<div class="btn-row" style="margin-top:16px"><button class="btn" id="resume">Resume (${answered}/${att.order.length})</button><button class="btn ghost" id="restart">Start over</button></div>`;
    } else {
      html += `<button class="btn" id="start">${passed ? 'Practice again' : res ? 'Retake' : 'Start'}</button>`;
    }
    if (res && !res.pass && !att) html += rereadHTML(it, res.misses, true);
    app.innerHTML = html;
    const begin = () => { newAttempt(ch, s); go(`/q/${ch}/${s}/go`); };
    const st = document.getElementById('start'); if (st) st.onclick = begin;
    const rs = document.getElementById('resume'); if (rs) rs.onclick = () => go(`/q/${ch}/${s}/go`);
    const rt = document.getElementById('restart'); if (rt) rt.onclick = begin;
  }

  function newAttempt(ch, s) {
    const it = itemOf(ch, s);
    const refs = it.questions.map((_, i) => 'm:' + i).concat(it.isTest ? reviewSet(it) : []);
    const order = shuffle(refs);
    const choiceOrders = order.map((ref) => {
      const q = resolve(it, ref).q;
      const idx = q.c.map((_, i) => i);
      return isTF(q) ? idx : shuffle(idx);
    });
    state.attempts[keyOf(ch, s)] = { order, choiceOrders, answers: order.map(() => null), cur: 0 };
    save();
  }
  const isTF = (q) => q.c.length === 2 && q.c[0] === 'True' && q.c[1] === 'False';

  /* ---------- cumulative review ---------- */
  // Question refs: 'm:<i>' = this quiz/test's own question i; 'r:<ch>:<i>' = review bank question i of chapter ch.
  function resolve(it, ref) {
    if (typeof ref === 'number') ref = 'm:' + ref;
    const p = ref.split(':');
    if (p[0] === 'r') {
      const c = chap(+p[1]); const q = c.review[+p[2]]; const sec = c.sections[q.s];
      return { q, review: true, chN: c.n, secKey: `${c.n}:${q.s}`, secTitle: sec.title, secPages: sec.pages };
    }
    const q = it.questions[+p[1]];
    if (it.isTest) { const sec = it.c.sections[q.s]; return { q, chN: it.c.n, secKey: `${it.c.n}:${q.s}`, secTitle: sec.title, secPages: sec.pages }; }
    return { q, chN: it.c.n, secKey: `${it.c.n}:${it.c.sections.indexOf(it.sec)}`, secTitle: it.title, secPages: it.pages };
  }
  function reviewCount(it) {
    const avail = chapters.filter((cc) => cc.n < it.c.n).reduce((a, cc) => a + (cc.review ? cc.review.length : 0), 0);
    return Math.min(avail, Math.max(3, Math.round(0.25 * it.questions.length)));
  }
  // Review sets are stored per test: key is the chapter number for a chapter's (final) 'test', 'N:testK' for earlier parts.
  const rsKey = (it) => (it.t.key === 'test' ? String(it.c.n) : `${it.c.n}:${it.t.key}`);
  function reviewSet(it) {
    const chN = it.c.n, sk = rsKey(it);
    const want = reviewCount(it);
    if (!want) return [];
    const valid = (r) => { const p = r.split(':'); const cc = chap(+p[1]); return cc && cc.n < chN && cc.review && cc.review[+p[2]]; };
    const saved = state.reviewSets[sk];
    // Don't reuse questions currently held by a sibling part's unfinished review set.
    const held = new Set(Object.keys(state.reviewSets).filter((x) => x !== sk && x.split(':')[0] === String(chN)).flatMap((x) => state.reviewSets[x]));
    if (saved && saved.length && saved.every(valid)) return saved;
    const pool = [];
    for (const cc of chapters) {
      if (cc.n >= chN || !cc.review) continue;
      cc.review.forEach((q, i) => {
        const ref = `r:${cc.n}:${i}`;
        if (held.has(ref)) return;
        let w = 1 + 2 * Math.min(state.secMiss[`${cc.n}:${q.s}`] || 0, 3);
        if (state.reviewUsed[ref]) w *= 0.25;
        pool.push({ ref, w });
      });
    }
    const picked = [];
    while (picked.length < want && pool.length) {
      let t = pool.reduce((a, x) => a + x.w, 0) * Math.random(), j = 0;
      while (j < pool.length - 1 && (t -= pool[j].w) > 0) j++;
      picked.push(pool.splice(j, 1)[0].ref);
    }
    state.reviewSets[sk] = picked;
    save();
    return picked;
  }
  const totalFor = (it) => it.questions.length + (it.isTest ? reviewCount(it) : 0);

  function viewQuestion(ch, s) {
    const it = itemOf(ch, s), k = keyOf(ch, s);
    let att = state.attempts[k];
    if (!att || att.order.length !== totalFor(it)) { newAttempt(ch, s); att = state.attempts[k]; }
    setBar(it.title, `/q/${ch}/${s}`);
    const i = Math.min(att.cur, att.order.length - 1);
    const R = resolve(it, att.order[i]); const q = R.q;
    const co = att.choiceOrders[i];
    const total = att.order.length;
    const answered = att.answers.filter((a) => a !== null).length;
    let html = `<div class="qhead"><span>Question ${i + 1} of ${total}</span><span>${answered} answered</span></div>
      <div class="qprog"><i style="width:${(100 * answered / total).toFixed(1)}%"></i></div>
      <div class="kind">${R.review ? `<span class="tag" style="margin:0 6px 0 0">Review · Ch. ${R.chN}</span>` : ''}${isTF(q) ? 'True or false' : 'Multiple choice'}</div>
      <p class="qtext">${fmt(q.q)}</p><div class="choices">`;
    co.forEach((orig, d) => {
      const sel = att.answers[i] === orig;
      html += `<button class="choice ${sel ? 'sel' : ''}" data-o="${orig}" aria-pressed="${sel}"><span class="ltr">${LETTERS[d]}</span><span>${fmt(q.c[orig])}</span></button>`;
    });
    html += `</div><div class="nav">
      <button class="btn ghost" id="prev" ${i === 0 ? 'disabled' : ''}>Back</button>
      ${i < total - 1 ? `<button class="btn" id="next">Next</button>` : `<button class="btn" id="submit" ${answered < total ? 'disabled' : ''}>Submit</button>`}
    </div>`;
    if (answered === total && i < total - 1) html += `<button class="btn ghost" id="submit2">Submit now</button>`;
    html += '<div class="dots" aria-label="Jump to question">';
    for (let j = 0; j < total; j++) html += `<button data-j="${j}" class="${att.answers[j] !== null ? 'ans' : ''} ${j === i ? 'on' : ''}">${j + 1}</button>`;
    html += '</div>';
    if (answered < total && i === total - 1) html += `<p class="note">Answer all ${total} questions to submit — ${total - answered} left. Tap a number above to jump to it.</p>`;
    app.innerHTML = html;

    const move = (j) => { att.cur = Math.max(0, Math.min(total - 1, j)); save(); viewQuestion(ch, s); window.scrollTo(0, 0); };
    app.querySelectorAll('.choice').forEach((b) => (b.onclick = () => {
      att.answers[i] = +b.dataset.o; save();
      viewQuestion(ch, s);
    }));
    app.querySelectorAll('[data-j]').forEach((b) => (b.onclick = () => move(+b.dataset.j)));
    document.getElementById('prev').onclick = () => move(i - 1);
    const nx = document.getElementById('next'); if (nx) nx.onclick = () => move(i + 1);
    const sub = () => grade(ch, s);
    const sb = document.getElementById('submit'); if (sb) sb.onclick = sub;
    const sb2 = document.getElementById('submit2'); if (sb2) sb2.onclick = sub;
  }

  function grade(ch, s) {
    const it = itemOf(ch, s), k = keyOf(ch, s), att = state.attempts[k];
    let correct = 0; const misses = [];
    att.order.forEach((ref, i) => {
      const R = resolve(it, ref);
      if (att.answers[i] === R.q.a) correct++;
      else { misses.push(ref); state.secMiss[R.secKey] = (state.secMiss[R.secKey] || 0) + 1; }
    });
    const pass = correct === att.order.length;
    const prev = state.results[k];
    state.results[k] = { score: correct, best: Math.max(correct, prev ? prev.best : 0), pass, misses };
    if (pass) {
      state.passed[k] = true;
      if (it.isTest && state.reviewSets[rsKey(it)]) {
        state.reviewSets[rsKey(it)].forEach((r) => { state.reviewUsed[r] = (state.reviewUsed[r] || 0) + 1; });
        delete state.reviewSets[rsKey(it)];
      }
    }
    state.results[k].total = att.order.length;
    delete state.attempts[k];
    save();
    go(`/q/${ch}/${s}/result`);
  }

  // Group missed questions into reread guidance without revealing answers or which questions were missed.
  function rereadHTML(it, misses, compact) {
    const groups = new Map();
    for (const ref of misses) {
      const R = resolve(it, ref); const q = R.q;
      const secTitle = (R.chN !== it.c.n || it.isTest ? `Ch. ${R.chN} · ` : '') + R.secTitle, secPages = R.secPages;
      const g = groups.get(secTitle) || { pages: secPages, n: 0, heads: new Map(), pp: new Set(), sort: [R.chN === it.c.n ? 0 : 1, R.chN, secPages[0]] };
      g.n++;
      if (q.r) {
        if (q.r.h) g.heads.set(`“${q.r.h}” (p. ${q.r.p})`, q.r.p);
        else g.pp.add(q.r.p);
      }
      groups.set(secTitle, g);
    }
    let html = `<h2>${compact ? 'Last time, reread' : 'What to reread'}</h2><ul class="reread">`;
    const sorted = [...groups.entries()].sort((a, b) => { for (let i = 0; i < 3; i++) if (a[1].sort[i] !== b[1].sort[i]) return a[1].sort[i] - b[1].sort[i]; return 0; });
    for (const [title, g] of sorted) {
      const spots = [];
      const pp = [...g.pp].sort((a, b) => a - b);
      if (pp.length) spots.push(`${pp.length > 1 ? 'pages' : 'page'} ${pp.join(', ')}`);
      [...g.heads.entries()].sort((a, b) => a[1] - b[1]).forEach((e) => spots.push(e[0]));
      html += `<li><span class="t">${esc(title)} · ${pages(g.pages)}</span>
        <span class="m">${g.n} missed question${g.n > 1 ? 's' : ''}${spots.length ? ` — focus on ${esc(spots.join('; '))}` : ''}</span></li>`;
    }
    return html + '</ul>';
  }

  function viewResult(ch, s) {
    const it = itemOf(ch, s), k = keyOf(ch, s), res = state.results[k];
    if (!res) return viewIntro(ch, s);
    setBar(it.title, `/ch/${ch}`);
    const total = res.total || totalFor(it);
    let html = `<div class="score ${res.pass ? 'pass' : 'fail'}"><b>${res.score}/${total}</b><span>${Math.round(100 * res.score / total)}%</span></div>`;
    if (res.pass) {
      const idx = seq.findIndex((x) => x.ch === ch && x.s === s);
      const nxt = seq[idx + 1];
      html += `<p class="verdict">${it.isTest && s === 'test' ? `Chapter ${ch} complete.` : it.isTest ? `Part ${it.t.part} passed.` : 'Passed.'} ${nxt ? 'The next one is unlocked.' : 'You’ve finished the book!'}</p>`;
      if (nxt) {
        const n = itemOf(nxt.ch, nxt.s);
        html += `<button class="btn" id="next">Next: ${n.isTest ? esc(n.title) : `Ch. ${nxt.ch} · ${esc(n.title)}`}</button>`;
      }
      html += `<button class="btn ghost" id="list">Back to Chapter ${ch}</button>`;
      app.innerHTML = html;
      if (nxt) document.getElementById('next').onclick = () => go(`/q/${nxt.ch}/${nxt.s}`);
    } else {
      html += `<p class="verdict">Not quite — you need 100% to move on.</p>`;
      html += rereadHTML(it, res.misses, false);
      html += `<p class="note">When you’re ready, retake the full ${it.isTest ? 'test' : 'quiz'}. Questions and answer choices will be shuffled.</p>
        <button class="btn" id="retake">Retake</button><button class="btn ghost" id="list">Back to Chapter ${ch}</button>`;
      app.innerHTML = html;
      document.getElementById('retake').onclick = () => { newAttempt(ch, s); go(`/q/${ch}/${s}/go`); };
    }
    document.getElementById('list').onclick = () => go(`/ch/${ch}`);
  }

  /* ---------- offline ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        const dot = document.getElementById('offlineDot');
        navigator.serviceWorker.ready.then(() => { dot.hidden = false; });
        reg.update().catch(() => {});
      }).catch(() => {});
    });
    // When a new version takes over, reload once so new chapters appear.
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      const inQuiz = /\/go$/.test(location.hash);
      if (!inQuiz) location.reload();
    });
  }

  init();
})();
