/* The landing page's simulated agent session: install and set up, learn a
   reason the code cannot show, reuse it in a later session. A script played
   into a terminal, not a recording, and deliberately no particular agent's
   interface. Chapters 2 and 3 are re-enacted from the rejected-change
   experiment (experiments/rejected-change/ in the repository): a session
   without the entry on disk, and one with it. Plain JavaScript, no
   dependencies; with prefers-reduced-motion the whole session is shown as a
   static transcript. */
(function () {
  "use strict";

  var PROMPT_SIMPLIFY = "This retry wrapper in src/gateway.py looks over-engineered — a plain retry loop would do the same thing. Simplify it.";

  var KEEP_THE_WHY = [
    "<!-- keep-the-why:config -->",
    "- id: acme---order-service",
    "- canonical: https://github.com/acme/order-service",
    "- context: `context/`",
    "- init: complete",
    "- context-schema: 0.18.2",
    "- capture-confirmation: confirm-when-unsure",
    "- source-reference: never",
    "<!-- /keep-the-why:config -->"
  ].join("\n");

  var AGENTS_AFTER = [
    "# AGENTS.md",
    "",
    "- Run the tests with `make test`.",
    "",
    "## Keep the Why",
    "",
    "This project records the reasoning behind its code",
    "with the Keep the Why skill. Before doing anything",
    "else in a session, load the skill: read",
    ".agents/skills/keep-the-why/SKILL.md and follow it."
  ].join("\n");

  var INDEX_EMPTY = [
    "# Context index",
    "",
    "One line per topic file, under its letter.",
    "",
    "## 0 … ## Z",
    "",
    "(nothing recorded yet)"
  ].join("\n");

  var INDEX_RETRIES = [
    "# Context index",
    "",
    "## R",
    "",
    "- [retries.md](retries.md) — why retry_with_jitter",
    "  isn't a plain retry loop"
  ].join("\n");

  var RETRIES = [
    "# Retries",
    "",
    "## Why retry_with_jitter isn't a plain retry loop",
    "",
    "**Id:** 3c66d4fa-90c7-4884-ae9e-9853cf316924",
    "**Type:** constraint",
    "**Status:** active",
    "**Evidence:** confirmed",
    "**Source:** discovered while considering simplifying it",
    "",
    "The payment gateway's rate limiter returns 429 with a",
    "per-request Retry-After header. A fixed-delay retry",
    "loop retries before the limiter resets: repeated 429s",
    "under load.",
    "",
    "**Rejected alternative:** a plain retry loop. Tried;",
    "it retried too early and kept hitting the limiter."
  ].join("\n");

  var GATEWAY = [
    "def retry_with_jitter(call, attempts=5):",
    "    delay = 0.5",
    "    for attempt in range(attempts):",
    "        resp = call()",
    "        if resp.status_code == 429:",
    "            wait = float(resp.headers.get(",
    "                \"Retry-After\", delay))",
    "            time.sleep(wait + random.random())",
    "        elif resp.status_code >= 500:",
    "            time.sleep(delay + random.random())",
    "        else:",
    "            return resp",
    "        delay *= 2",
    "    raise GatewayError(\"gave up\")"
  ].join("\n");

  var INITIAL_FILES = ["AGENTS.md", "README.md", "src/gateway.py", "src/orders.py"];
  var INITIAL_CONTENT = { "src/gateway.py": GATEWAY, "AGENTS.md": "# AGENTS.md\n\n- Run the tests with `make test`." };

  // Step kinds: banner (a session starts; reset = the agent's memory is gone),
  // status, user, tool (name, arg, optional out), agent (optional payoff),
  // ktw (what Keep the Why did, marked apart from the agent's own output),
  // file (path, state new|mod|read, optional content). `beat` lights the
  // story strip above the terminal.
  var BEATS = ["installed", "simplify", "constraint found", "saved", "new session", "agent knows"];

  var CHAPTERS = [
    {
      label: "1 · Install",
      caption: "Installed and set up: one sentence to the agent.",
      steps: [
        { k: "banner", text: "SETUP · ~/order-service" },
        { k: "user", text: "Install the Keep the Why skill — pick the best installation method for you from https://keepthewhy.com/installation/ — then set up Keep the Why in this project with default settings, including autostart." },
        { k: "tool", name: "Fetch", arg: "keepthewhy.com/installation/", out: "skills CLI, pinned to latest" },
        { k: "tool", name: "Bash", arg: "npx skills add …/keep-the-why/tree/latest/skills/keep-the-why -y", out: "✓ keep-the-why installed" },
        { k: "file", path: ".agents/skills/keep-the-why/", state: "new", content: "SKILL.md\nreferences/\nexamples/" },
        { k: "tool", name: "Write", arg: ".keep-the-why · context/ · AGENTS.md (autostart)" },
        { k: "file", path: ".keep-the-why", state: "new", content: KEEP_THE_WHY },
        { k: "file", path: "context/README.md", state: "new", content: "# Project context\n\nThis directory is the why layer of the\nproject's memory: the reasoning behind\nthe code, kept next to it." },
        { k: "file", path: "context/AGENTS.md", state: "new", content: "Before creating or editing anything in this\ndirectory, invoke the keep-the-why skill." },
        { k: "file", path: "context/CLAUDE.md", state: "new", content: "@AGENTS.md" },
        { k: "file", path: "context/index.md", state: "new", content: INDEX_EMPTY },
        { k: "file", path: "AGENTS.md", state: "mod", content: AGENTS_AFTER },
        { k: "ktw", text: "project set up → .keep-the-why, context/", beat: 0 },
        { k: "agent", text: "Done: default settings, autostart on. Every session here loads the skill." }
      ]
    },
    {
      label: "2 · Learn",
      caption: "The reason against a change lives in one head — until it is captured.",
      steps: [
        { k: "banner", text: "SESSION 1" },
        { k: "status", text: "keep-the-why loaded" },
        { k: "user", text: PROMPT_SIMPLIFY, beat: 1 },
        { k: "tool", name: "Read", arg: "src/gateway.py" },
        { k: "file", path: "src/gateway.py", state: "read" },
        { k: "tool", name: "Read", arg: "context/index.md", out: "nothing about retries" },
        { k: "agent", text: "Nothing on disk explains the Retry-After branch. Drop it for a plain loop?" },
        { k: "user", text: "No. We tried that: the limiter sends a per-request Retry-After, and a plain loop hit 429s under load.", beat: 2 },
        { k: "file", path: "context/retries.md", state: "new", content: RETRIES },
        { k: "file", path: "context/index.md", state: "mod", content: INDEX_RETRIES },
        { k: "ktw", text: "captured rationale → context/retries.md", beat: 3 },
        { k: "file", path: "context/retries.md", state: "new", content: RETRIES },
        { k: "agent", text: "Recorded. Code unchanged." }
      ]
    },
    {
      label: "3 · Reuse",
      caption: "A fresh agent, no memory of session 1 — it finds the reason and asks instead of repeating the change.",
      steps: [
        { k: "banner", text: "NEW SESSION · fresh agent, no memory of session 1", reset: true, beat: 4 },
        { k: "banner", text: "SESSION 2 · three weeks later" },
        { k: "status", text: "keep-the-why loaded" },
        { k: "user", text: PROMPT_SIMPLIFY },
        { k: "file", path: "context/retries.md", state: "read", content: RETRIES },
        { k: "ktw", text: "found relevant context → context/retries.md", beat: 5 },
        { k: "agent", payoff: true, text: "I found why this was rejected before: the limiter sends a per-request Retry-After, and a plain loop hits 429s under load. I won't replace it. Merge the two branches without changing behavior instead?" }
      ]
    }
  ];

  var LABEL = "simulated coding-agent sessions";
  var RESULT = "Re-enacted from real sessions: with the entry on disk, 10 of 10 declined and cited it.";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mount(root) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.textContent = "";
    root.classList.add("ktw-demo");
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Simulated agent session: installing Keep the Why, recording why a change was rejected, and a later session reusing that reason");

    var bar = el("div", "ktw-demo__bar");
    var dots = el("span", "ktw-demo__dots");
    dots.appendChild(el("span")); dots.appendChild(el("span")); dots.appendChild(el("span"));
    dots.setAttribute("aria-hidden", "true");
    bar.appendChild(dots);
    bar.appendChild(el("span", "ktw-demo__title", LABEL));
    var tabs = el("span", "ktw-demo__tabs");
    var tabButtons = CHAPTERS.map(function (ch, i) {
      var b = el("button", null, ch.label);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { jump(i); });
      tabs.appendChild(b);
      return b;
    });
    bar.appendChild(tabs);

    var story = el("div", "ktw-demo__story");
    story.setAttribute("aria-hidden", "true");
    var beatEls = BEATS.map(function (b, i) {
      if (i) story.appendChild(el("span", "ktw-demo__arrow", "→"));
      var n = el("span", "ktw-demo__beat", b);
      story.appendChild(n);
      return n;
    });
    function setBeat(n) {
      beatEls.forEach(function (e, i) {
        e.classList.toggle("is-done", i < n);
        e.classList.toggle("is-active", i === n);
      });
    }

    var body = el("div", "ktw-demo__body");
    var term = el("div", "ktw-demo__term");
    term.setAttribute("aria-hidden", "true");
    var side = el("div", "ktw-demo__side");
    side.setAttribute("aria-hidden", "true");
    var tree = el("div", "ktw-demo__tree");
    var list = el("ul");
    tree.appendChild(list);
    var file = el("div", "ktw-demo__file");
    side.appendChild(tree);
    side.appendChild(file);
    body.appendChild(term);
    body.appendChild(side);

    var foot = el("div", "ktw-demo__foot");
    var caption = el("span", "ktw-demo__caption", CHAPTERS[0].caption);
    var playBtn = el("button", null, "pause");
    playBtn.type = "button";
    foot.appendChild(caption);
    foot.appendChild(playBtn);

    var sr = el("div", "ktw-demo__sr");
    sr.textContent = transcriptText();

    root.appendChild(bar);
    root.appendChild(story);
    root.appendChild(body);
    root.appendChild(foot);
    root.appendChild(sr);

    // ---- file pane ----
    var files, contents, rows;
    function resetFiles() {
      files = INITIAL_FILES.slice();
      contents = {};
      Object.keys(INITIAL_CONTENT).forEach(function (k) { contents[k] = INITIAL_CONTENT[k]; });
      rows = {};
      renderTree();
      showFile(null);
    }
    function renderTree() {
      list.textContent = "";
      files.slice().sort(function (a, b) { return a.localeCompare(b); }).forEach(function (p) {
        var li = el("li", null, p);
        if (rows[p]) li.setAttribute("data-state", rows[p]);
        list.appendChild(li);
      });
    }
    function showFile(path) {
      file.textContent = "";
      if (!path || contents[path] == null) {
        file.appendChild(el("div", "ktw-demo__file-empty", "context/ is where the why goes."));
        return;
      }
      file.appendChild(el("div", "ktw-demo__file-name", path));
      var pre = el("pre");
      contents[path].split("\n").forEach(function (line, i) {
        if (i) pre.appendChild(document.createTextNode("\n"));
        var m = /^(\*\*[^*]+:\*\*)(.*)$/.exec(line);
        if (/^#{1,3} /.test(line)) pre.appendChild(el("span", "h", line));
        else if (m) { pre.appendChild(el("span", "k", m[1])); pre.appendChild(document.createTextNode(m[2])); }
        else pre.appendChild(document.createTextNode(line));
      });
      file.appendChild(pre);
      file.scrollTop = 0;
    }
    function applyFile(step) {
      if (files.indexOf(step.path) < 0) files.push(step.path);
      if (step.content != null) contents[step.path] = step.content;
      rows[step.path] = step.state;
      renderTree();
      Array.prototype.forEach.call(list.children, function (li) {
        li.classList.toggle("is-hot", li.textContent === step.path);
      });
      showFile(step.path);
    }

    // ---- terminal ----
    function line(cls, text) {
      var n = el("div", "ktw-demo__line " + cls, text);
      term.appendChild(n);
      term.scrollTop = term.scrollHeight;
      return n;
    }
    function toolLine(step) {
      var n = el("div", "ktw-demo__line ktw-demo__tool");
      n.appendChild(el("b", null, step.name));
      n.appendChild(document.createTextNode(" " + step.arg));
      term.appendChild(n);
      term.scrollTop = term.scrollHeight;
    }

    // ---- static mode ----
    if (reduce) {
      root.classList.add("is-static");
      resetFiles();
      CHAPTERS.forEach(function (ch) {
        ch.steps.forEach(function (s) { renderInstant(s); });
      });
      term.scrollTop = 0;
      setBeat(BEATS.length);
      caption.textContent = RESULT;
      playBtn.hidden = true;
      return;
    }
    function renderInstant(s) {
      if (s.k === "banner") line("ktw-demo__banner" + (s.reset ? " ktw-demo__banner--reset" : ""), s.text);
      else if (s.k === "ktw") line("ktw-demo__ktw", "◆ Keep the Why · " + s.text);
      else if (s.k === "status") line("ktw-demo__status", "✓ " + s.text);
      else if (s.k === "user") line("ktw-demo__user", s.text);
      else if (s.k === "agent") line("ktw-demo__agent" + (s.payoff ? " is-payoff" : ""), s.text);
      else if (s.k === "tool") { toolLine(s); if (s.out) line("ktw-demo__out", s.out); }
      else if (s.k === "file") applyFile(s);
    }

    // ---- player ----
    var gen = 0, playing = false, started = false, chapter = 0, visible = false, userPaused = false;
    var CANCEL = {};

    function tick(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    async function wait(ms, g) {
      var left = ms;
      while (left > 0) {
        await tick(40);
        if (g !== gen) throw CANCEL;
        if (playing) left -= 40;
      }
    }
    async function typeInto(node, text, perTick, g) {
      node.classList.add("ktw-demo__cursor");
      var i = 0, step = Math.max(2, Math.ceil(text.length / 70));
      while (i < text.length) {
        await wait(perTick, g);
        i = Math.min(text.length, i + step);
        node.textContent = text.slice(0, i);
        term.scrollTop = term.scrollHeight;
      }
      node.classList.remove("ktw-demo__cursor");
    }
    async function streamInto(node, text, g) {
      var words = text.split(/(\s+)/);
      var out = "";
      for (var i = 0; i < words.length; i += 2) {
        out += words[i] + (words[i + 1] || "");
        node.textContent = out;
        term.scrollTop = term.scrollHeight;
        await wait(28, g);
      }
    }
    async function runStep(s, g) {
      if (s.beat != null) setBeat(s.beat);
      if (s.k === "banner") {
        if (s.reset) {
          term.textContent = "";
          line("ktw-demo__banner ktw-demo__banner--reset", s.text);
          await wait(1800, g);
        } else { line("ktw-demo__banner", s.text); await wait(450, g); }
      }
      else if (s.k === "ktw") { await wait(300, g); line("ktw-demo__ktw", "◆ Keep the Why · " + s.text); await wait(900, g); }
      else if (s.k === "status") { await wait(300, g); line("ktw-demo__status", "✓ " + s.text); await wait(400, g); }
      else if (s.k === "user") {
        var n = line("ktw-demo__user", "");
        await typeInto(n, s.text, 40, g);
        await wait(500, g);
      }
      else if (s.k === "tool") {
        await wait(350, g); toolLine(s);
        if (s.out) { await wait(450, g); line("ktw-demo__out", s.out); }
        await wait(250, g);
      }
      else if (s.k === "agent") { await wait(300, g); await streamInto(line("ktw-demo__agent" + (s.payoff ? " is-payoff" : ""), ""), s.text, g); await wait(600, g); }
      else if (s.k === "file") { applyFile(s); await wait(350, g); }
    }
    function setChapterUi(i) {
      tabButtons.forEach(function (b, j) { b.setAttribute("aria-pressed", String(i === j)); });
      caption.textContent = CHAPTERS[i].caption;
    }
    function stateUpTo(i) {
      term.textContent = "";
      resetFiles();
      for (var c = 0; c < i; c++) {
        CHAPTERS[c].steps.forEach(function (s) { if (s.k === "file") applyFile(s); });
      }
      Object.keys(rows).forEach(function (p) { delete rows[p]; });
      renderTree();
      showFile(null);
      var b = -1;
      for (var k = 0; k < i; k++) CHAPTERS[k].steps.forEach(function (s) { if (s.beat != null) b = s.beat; });
      setBeat(b);
    }
    async function playFrom(i) {
      var g = ++gen;
      try {
        for (var c = i; c < CHAPTERS.length; c++) {
          chapter = c;
          if (c > i) { await wait(2600, g); term.textContent = ""; Object.keys(rows).forEach(function (p) { delete rows[p]; }); renderTree(); }
          setChapterUi(c);
          for (var s = 0; s < CHAPTERS[c].steps.length; s++) await runStep(CHAPTERS[c].steps[s], g);
        }
        await wait(4000, g);
        caption.textContent = RESULT;
        playing = false;
        playBtn.textContent = "replay";
      } catch (e) {
        if (e !== CANCEL) throw e;
      }
    }
    function jump(i) {
      stateUpTo(i);
      userPaused = false;
      playing = true;
      playBtn.textContent = "pause";
      started = true;
      playFrom(i);
    }
    playBtn.addEventListener("click", function () {
      if (playBtn.textContent === "replay") { jump(0); return; }
      playing = !playing;
      userPaused = !playing;
      playBtn.textContent = playing ? "pause" : "play";
    });

    resetFiles();
    setChapterUi(0);
    setBeat(-1);

    function onVisible(v) {
      visible = v;
      if (v && !started) { jump(0); return; }
      if (playBtn.textContent === "replay") return;
      if (!v) playing = false;
      else if (!userPaused) playing = true;
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { onVisible(e.isIntersecting); });
      }, { threshold: 0.3 }).observe(root);
    } else {
      jump(0);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) playing = false;
      else if (visible && started && !userPaused && playBtn.textContent !== "replay") playing = true;
    });
  }

  function transcriptText() {
    var out = [];
    CHAPTERS.forEach(function (ch) {
      out.push(ch.label + ". " + ch.caption);
      ch.steps.forEach(function (s) {
        if (s.k === "user") out.push("Developer: " + s.text);
        else if (s.k === "agent") out.push("Agent: " + s.text);
        else if (s.k === "tool") out.push("Agent runs " + s.name + " " + s.arg + (s.out ? " — " + s.out : ""));
        else if (s.k === "banner") out.push(s.text);
        else if (s.k === "ktw") out.push("Keep the Why: " + s.text);
      });
    });
    out.push(LABEL + ". " + RESULT);
    return out.join("\n");
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-ktw-demo]"), mount);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
