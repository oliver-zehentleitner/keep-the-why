# Context search: research journal

A running log of the context search experiment: what each step set out to learn, how it was set up, what it
measured, what surprised us, and what was decided and why. Plain facts; articles are written from it later.
Raw results live under `results/<date>-<step>/`; datasets and transcripts are rebuilt or kept locally, not here.

## 2026-11-06 — Step 0: the question

**The question.** A large `context/` is slow and expensive for an agent to search: today the agent reads
`context/index.md`, one line per topic, and then whole topic files. The index finds the file, not the entry. The
goal is a tool, installed once, that makes a large `context/` fast and token-efficient to search, chosen by
measurement.

**Setup.** Phase 1 builds data and a question set with known answers and measures today's way as the baseline.
Phase 2 measures candidates offline. Phase 3 runs agents. Phase 4 ships the winner in `ktw`, the one command an
agent uses for `context/` (search, and the linter as a library).

## 2026-11-06 — Step 1: the data (PR #769)

**The question.** What does a realistic large `context/` look like, and how do we make it larger without making the
questions ambiguous?

**Setup.**
- Source: Maity's repository at commit `0720d70`, read-only.
- Generator: `make_dataset.py`.
- Sets: ×1, ×5 and ×10, plus a text-identical ×10 as a control.

**The numbers.** The family at ×1:

| member | topics | entries | index tokens (cl100k) |
|---|---|---|---|
| root | 24 | 297 | 5.0k |
| hub | 47 | 423 | 8.3k |
| web | 8 | 224 | 3.1k |
| cli | 6 | 99 | 1.7k |
| family | 85 | 1043 | 18.0k |

×5 is 5215 entries and 11.5 MB; ×10 is 10430 entries and 22.9 MB.

**What surprised us.**
- **The first count was wrong.** The first build took Maity's root `context/` only, 297 entries, and reported
  that the card's "1000+ entries" did not hold. Maity is a family of four members, and an agent in a family
  searches across all of them. With every member the count is 1043, so the card was right.
- **A copy can lint and still be broken.** In the first vocab build, the canonical URLs of cross-member
  references were renamed too ("maity" is a frequent title word, so `…/maity` became `…/bale`), while the
  members' `.keep-the-why` kept `maity`.
  - The linter still passed, because it takes an unknown `https` URL for a reference to another repository and
    does not resolve it.
  - A reviewer found it (#769, #s8qb).
- **A member's `parent: ..` needs a git repository** to be checked against the toplevel; the dataset is one now.

**Decisions and why.**
- **Copies keep the text, but rename the vocabulary.** A text-identical copy gives N equally good answers to
  every question. In vocab mode each copy renames the 150 most frequent title words of the family to made-up
  words, so it reads like the original but does not answer a question about it; the one right answer stays the
  original. The identical copies are kept as an offline control only.
- **One Id map per copy for the whole family**, so a reference from one member into another stays inside the
  copy. The generator fails unless every reference by canonical to a family entry names a member's canonical
  (670 checked at ×10).
- **URLs are names**, held out of the vocabulary map.
- **The words the format uses stay.** They are taken from the linter's field names and values and from the
  dashboard parser's body labels, not from a hand-written list. The hand list missed `answer` and `considered`
  (review finding).

## 2026-11-06 — Step 2: the questions and the baseline (PR #769)

**The question.** Which questions does an agent really ask of a `context/`, and what does today's way cost to
answer them?

**Setup.**
- **41 questions in `questions.json`.**
  - 32 come from commit subjects that added exactly one entry, rephrased as the question someone would ask,
    covering the root, hub, web and cli. Of those commits there are 205, 230, 185 and 67 per member.
  - 9 come from the graph or a filter: what supersedes X, a supersede chain, a See link, every incident, every
    needs-review entry.
  - 7 start in another member than the answer's.
- **Baseline:** the start member's index, the other members' indexes (the skill's family rule), then the topic
  files holding the answer. It is a lower bound: the right topics first time.

**The numbers** (`results/2026-11-06-offline-baseline/`, tokens with tiktoken cl100k as a proxy):

| set | indexes, all members | baseline median | max |
|---|---|---|---|
| ×1 | 18.0k | 34.0k | 269k |
| ×5 | 103k | 119k | 1.48M |
| ×10 | 210k | 225k | 2.99M |

The max is the needs-review question. On a copied set, the answer is every needs-review entry of every copy.

**What surprised us.**
- At ×10 the family's indexes alone are about 210k tokens, more than a context window, before a single topic is
  read.
- The filter question needs 33 needs-review entries at ×1, not the one the root alone has.

**Decisions and why.**
- **Questions are phrased from the commit, not from the entry**, so the wording does not lead to the answer.
  Reviewers found five that still did (q05, q11, q17, q19, q38) and four more near the limit (q02, q18, q35,
  q40).
  - A mechanical leak check now fails any question that repeats more than 40 % of its expected title's content
    words; the highest is 33 %.
  - The limit started at 50 % and was tightened: half a title is still a strong hint.
- **A filter question's answer on a copied set is every matching entry there.** Nothing in a copy says it is one,
  so a filter cannot and should not tell copies apart (review finding). Every rule is rechecked on every set.

## 2026-11-06 — Step 3: the candidates, offline (PR 2)

**The question.** Which way of searching finds the right entry, and at what cost, without a model in the loop?

**Setup.**
- **`ktw_proto.py`**, a prototype over one cache of the family's entries built with the linter's parser:
  - an entry-level index;
  - filters (`--type`, `--status`, `--member`);
  - graph queries over See and Superseded by in both directions;
  - BM25 (title counted twice, k1 1.2, b 0.75);
  - static embeddings (model2vec `potion-base-8M`) as an extra.
- **`harness_candidates.py`** measures, with the question as the query:
  - recall@1/@5/@10 and MRR of BM25, embeddings, and both fused by reciprocal rank (RRF, k 60);
  - the tokens an agent would read (`find -n 10` and `show` of the first hit);
  - the exact commands for graph and filter questions.

**The numbers, first run: overstated at ×5 and ×10, see step 3b.** Recall@1 / @5 / @10:

| set | BM25 | embed | hybrid |
|---|---|---|---|
| ×1 | .36 / .64 / .74 | .23 / .51 / .64 | .39 / .72 / .83 |
| ×5 | .36 / .59 / .74 | .23 / .49 / .61 | .39 / .69 / .80 |
| ×10 | .39 / .54 / .69 | .23 / .46 / .59 | .39 / .69 / .77 |
| ×10 identical | .36 / .36 / .36 | .26 / .26 / .28 | .41 / .44 / .54 |

- **Reading cost:** about 900–1000 tokens per question, against the baseline's 34k–226k.
- **Graph and filter questions:** answered fully by their commands, a median of 1.9k tokens at ×1 and 2.5k at ×5
  and ×10.
- **The entry-level index as one file:** 55k tokens at ×1, 606k at ×10.
- **Cache:**
  - build: 0.4 s at ×1, 4 s at ×10;
  - size: 10 MB at ×1, 99 MB at ×10 (JSON with full text and postings).
- **Embeddings:**
  - build: 0.5 s at ×1, 3.3 s at ×10;
  - vectors: 1 MB at ×1, 10.7 MB at ×10.

**What surprised us.**
- **Embeddings alone are worse than BM25** at every size. They help only fused with it, by about .09 recall@10.
- **The cost of embeddings is mostly installation.**
  - Packages: about 65 MB (numpy 43, tokenizers 12, huggingface_hub 7).
  - Model: 30 MB.
  - The first model download from Hugging Face took 18 minutes without a token. Afterwards a query took 0.5 s.
- **The entry-level index is not a fix.** One line per entry is still 606k tokens at ×10, three times the
  topic indexes.
- **Duplicates clutter the top ten.** In the identical control BM25 stays at .36 for recall@1, @5 and @10. When
  the first hit is wrong, its ten identical copies take every place in the top ten.
- **A metric bug.** The first identical-control numbers counted every copy as a separate expected entry, which
  caps recall@1 at .1. Recall is now counted per answer group, at its best-ranked copy.

**Decisions and why** (from the project lead, 83356):
- Before the agent runs, try field-weighted BM25 (BM25F: title, the Type/Status line, Reason/Rejected
  alternatives, body) with weights tuned honestly, on held-out questions. If it closes part of the gap to hybrid,
  the embeddings question gets cheaper.
- The agent runs take hybrid along at ×10 regardless. The goal is the best tool, so what embeddings buy in an
  agent's hands is measured; their install weight is reported as a cost, not used to decide alone.
- Noted for shipping, not now:
  - a compact cache (SQLite FTS5 via `sqlite3` if every target Python has it, otherwise a compact binary
    format);
  - grouping of near-identical hits.

## 2026-11-06 — Step 3b: an artefact found in review, the data and the numbers corrected

**The question.** Why did recall@1 rise from ×1 to ×10, when more similar entries should make the right one harder
to find?

**What was wrong.** A reviewer (#770, #s8qb) traced it to the generator. Each copy renamed the 150 domain words
to made-up words unique to that copy, so at ×10 exactly the words a question uses had a document frequency of one
copy, while every other word had ten. BM25's IDF gave the query words about ln 10 more weight, and the larger
sets overstated how well a search tells entries apart. The hypothesis behind the made-up words, that a copy only
has to stop answering the question, was right; that it could do so without changing the statistics was wrong.

**The fix** (#769):
- **Copies now shuffle the domain words among themselves:** a reproducible derangement per copy, within bands of
  five neighbours in frequency. A copy reads like a plausible project of the same kind and still does not answer
  a question about the original, but every domain word occurs in every copy.
- **What IDF sees now:** a word's set-wide document frequency against (copies + 1) times its original's is 1.06
  at the median (0.36 to 3.75), against 0.1 for the query words before. The generator fails if a word is missing
  from a copy.
- **A second bug the new names exposed:** two file stems could now meet in one copy. A collision silently
  dropped a file, and lint caught the dangling See it left; names are kept unique.

**The measurement fixes** (#770, same review):
- A miss used to cost no `show`, so a worse ranking looked cheaper. A miss now reads its first hit.
- The token median is reported over all text questions and over hits.
- Graph and filter questions are taken out of the ranked table and reported under their commands. q28's answer is
  a chain of three, which caps a ranked recall@1 at 1/3.
- BM25 indexed the title three times (twice explicitly and once in the heading line) and the metadata lines
  (Id, Type, Status, Source, See) as text. It now indexes the title twice and the prose once, with the body
  labels (Reason, Rejected alternative, …) counted as prose.
- Earlier, a filter that dropped every `**…**` line had thrown away exactly those labels.

**The numbers, corrected** (`results/2026-11-06-offline-candidates/`, 32 text questions). Recall@1 / @5 / @10,
then the median tokens read over all text questions and over hits:

| set | BM25 | embed | hybrid |
|---|---|---|---|
| ×1 | .38 / .56 / .72, 1050 / 1026 | .25 / .50 / .66, 1033 / 995 | .38 / .75 / .78, 1038 / 1011 |
| ×5 | .34 / .47 / .53, 1117 / 1051 | .19 / .31 / .47, 1024 / 988 | .19 / .53 / .59, 1067 / 1042 |
| ×10 | .34 / .41 / .47, 1126 / 1084 | .19 / .25 / .34, 1023 / 1043 | .22 / .50 / .59, 1053 / 1033 |
| ×10 identical | .38 / .38 / .38, 1089 / 1072 | .28 / .28 / .31, 1053 / 1037 | .41 / .47 / .50, 1078 / 999 |

- Graph and filter questions under their commands: recall 1.0; median 1.9k tokens at ×1, 2.5k at ×5 and ×10.
- Entry-level index: 55k / 281k / 565k tokens.
- Cache: 10 / 50 / 101 MB.

**What the larger sets are.** ×5 and ×10 are an adversarial stress test, not a forecast for a large real
`context/`. Ten deranged near-copies of one family are harder to tell apart than ten different projects' worth of
entries would be. Read the falling recall as the hard case: many similar entries, one of them right.

**What changed in the picture.**
- **Recall now falls with size** in that hard case, as it should. At ×10, BM25 finds the right entry in the top ten for under half
  the text questions, and hybrid for 59 %. The first run's .69 / .77 were the artefact.
- **At ×10, BM25 beats hybrid at rank 1** (.34 against .22); hybrid wins at @5 and @10. Fusing ranks spreads
  the first place.
- **Telling similar entries apart is the hard part at scale,** not reading cost. Every variant still reads about
  1k tokens per question, against the baseline's 34k–195k.

**Next, for the hard case** (head, #770):
- BM25F, with field weights tuned on held-out questions.
- Cheap signals to tell similar hits apart: the member and topic title in each hit line, `--member` / `--topic`
  scoping, and a search within the hits.
- Whether a two-step search (broad, then within the topic of the best hits) recovers recall at ×10.

## 2026-11-06 — Step 3c: three more findings from review, the oracle and the cache corrected

**What was wrong** (#769 and #770, #ydrr):
- **Only the first Type line counted.** An entry may carry Type more than once (since context-schema 0.9.0). The
  oracle and the prototype both read the first line only.
  - In the pinned family, 23 entries are incidents; 6 of them carry incident after another Type. q30 ("every
    incident") expected 17.
  - The exact-command recall of 1.0 was self-confirming: the prototype's `find --type` had the same blind spot as
    the answer key it was checked against. Against the full answer, it would have found 17 of 23 on q30.
  - The hypothesis that a check of rule against expected list catches a wrong answer key was wrong when both come
    from the same reading of the data.
- **The cache missed a second change to an already modified file.** Its key was the committed tree plus
  `git status --porcelain`, and a file's status line stays the same however often it changes again. The prototype
  then served the old text and postings.
- **The token figure is an oracle lower bound.** The harness knows which hit is right and reads only that one. An
  agent reads what it judges likely, and the agent runs (PR 3) measure that.

**The fixes.**
- **Repeatable fields match by membership:** Type and See, the fields the linter lets repeat. Id, Status, Evidence
  and Superseded by are single (E112).
  - This holds in the filter rules, the See-rule derivation, and the prototype's cache and filter. A hit line shows
    every Type, `decision+incident/active`.
  - q30 expects all 23.
- **A second count, outside the parser.** A filter's answer is also counted as its `**Field:** value` lines in the
  raw topic text, and the harness fails when the two differ. With the old reading, it reports 17 against 23.
- **The cache key is content:** the committed tree, plus the bytes of every modified or untracked file under the
  members' `context/`.
  - `test_ktw_proto.py` has the review's reproduction (mark, build, mark again, load: a miss, the new marker), an
    untracked file, an unchanged hit, and a second Type line.
  - On the old prototype the dirty-file test and the Type test fail.
  - For the real `ktw` this is a hard requirement, not a detail: a search that answers from stale text is worse
    than none.
- **The results and the harness state the lower bound** next to the token figures.

**Install weight, once more.** The first rerun hung for 25 minutes before it measured anything: with the model
already cached, model2vec still went to the Hugging Face Hub when it loaded the model, unauthenticated. With
`HF_HUB_OFFLINE=1` the same run finished in under ten minutes. For `ktw[embed]` that is part of the cost: a network call
on every load unless the tool sets the offline flag itself, and an 18-minute first download without a token.

**CI.** `test_ktw_proto.py` runs on every pull request (`lint-package.yml`, job `context-search`).

**The numbers** (`results/2026-11-06-offline-candidates/`, `results/2026-11-06-offline-baseline/`):
- **Phase 1:** unchanged. q30's baseline reads the same index and topic files.
- **Ranked text questions:** unchanged, since q30 is a filter question and not in that table; a few medians move
  by a token or two, as hit lines now carry every Type.
- **Graph and filter questions under their commands:** recall 1.0, now against the full answer and the raw count;
  median 1.9k tokens at ×1, 2.5k at ×5 and ×10.

## 2026-11-08 — Step 4: BM25F and a two-step search, offline

**The questions.**
- Does weighting an entry's fields separately (BM25F) tell similar entries apart better than one bag of words?
- Does searching again within the topics of the first hits recover the recall the larger sets lose?

**The setup** (`harness_bm25f.py`).
- **Fields:**
  - the title;
  - the prose (as BM25 indexes it);
  - a topic field: the member, the topic file's heading and its line in the member's index.
- **Tuning:** a grid of 1,200 settings (k1; the title's and the topic's weight against prose; b per field), chosen
  by MRR on one half of the 32 text questions and measured on the other half, then the halves swap. The grid's
  best on all questions is reported as a ceiling, never as a result. A half is 16 questions, so one question moves
  recall by .06.
- **Two steps:** a ranked search; then the same query again, ranked only among the entries of the topics of the
  first three hits, with the IDF counted inside that scope. The tokens are both hit lists plus `show`, a lower bound.

**The numbers** (`results/2026-11-08-offline-bm25f/`), recall@1 / @5 / @10, MRR:

| set | BM25 | BM25F, held out | BM25, 2 steps | BM25F, 2 steps | BM25F ceiling |
|---|---|---|---|---|---|
| ×1 | .38 / .56 / .72, .47 | .41 / .59 / .72, .51 | .34 / .53 / .62, .43 | .28 / .62 / .75, .45 | .50 / .59 / .69, .56 |
| ×5 | .34 / .47 / .53, .40 | .31 / .53 / .59, .40 | .28 / .44 / .50, .34 | .31 / .44 / .50, .38 | .38 / .53 / .59, .44 |
| ×10 | .34 / .41 / .47, .38 | .28 / .44 / .53, .38 | .28 / .44 / .47, .34 | .31 / .44 / .53, .39 | .38 / .44 / .53, .42 |
| ×10 identical | .38 / .38 / .38, .39 | .41 / .41 / .41, .42 | .38 / .44 / .44, .40 | .38 / .47 / .47, .40 | .50 / .50 / .50, .51 |

- **Tokens:** one search reads about 1.05k–1.15k tokens; two steps read 1.6k–1.7k.
- **Chosen settings:** the title weighted 5 to 8 against prose 1 in every half and every set; the topic field
  weighted 0 in every one.

**What it shows.**
- **BM25F hardly helps.** Held out, it gains .06 at recall@10 on ×5 and ×10, and loses .06 at rank 1 on ×10,
  one question either way. MRR moves by at most .04. Even the ceiling, tuned on the questions it is measured on,
  stays below hybrid's .59 at ×10.
- **The one stable signal is the title.** Every tuning run weights it 5 to 8 times the prose, against 2 now.
- **The topic field is a failed hypothesis.** The index's topic lines are long and full of the domain's words, so
  they match many questions about the same area equally, and do not tell one entry from another. Every tuning run
  switched them off.
- **Two steps do not recover recall.** Recall@10 at ×10 stays at .47 for BM25 and .53 for BM25F, at
  600 tokens more. A scope made from the first three hits' topics cannot hold an entry whose topic none of them is
  in, and reranking inside it costs rank-1 hits at ×1 (.38 to .34 for BM25, .41 to .28 for BM25F). An agent's
  second step will be a different query, not the same one in a smaller scope; that is the agent runs' question.

**Decisions.**
- No tuned BM25F for `ktw`. Raise the title weight in the one-bag BM25 instead; that is the setting that
  carried over.
- The topic field and the second step leave the offline candidates.
- Hybrid stays the best offline candidate at @5 and @10, BM25 at rank 1. The agent runs (PR 3) decide between
  them, with hybrid's install weight as a cost.

## 2026-11-08 — Step 5: the registry, a large set of different real projects

**The question.** ×5 and ×10 are a stress test of near-copies (step 3b). How do the candidates do on many
*different* real projects, and does step 4's title weight hold on questions it was not chosen on?

**The setup** (`make_registry.py`, `registry-pins.json`, `questions-registry.json`, idea Oliver's via the head).
- **The data.** Every project the Keep the Why registry lists (`registry/projects.txt` at keep-the-why
  `28bfdc9`), each at a pinned commit. A project brings its family members inside its own repository: its root and
  the local children of its children blocks. Maity is left out of the list, since its family is the set's root,
  at the commit questions.json pins. Every entry keeps its Id; the build fails on an Id that occurs twice.
- **17 projects:** 697 entries, from 3 (ubdcc-dashboard) to 300 (lasteverLM, 7 members). With Maity's 1043, the
  set holds 1740 entries.
  - All 17 are public.
  - 15 declare MIT on the forge; zyvop-cli declares MIT in its `package.json`; keep-the-why-demo declares no
    license.
  - Only the generator, the pins and the questions are committed, never a project's content.
- **The questions.** 37, at least 2 per project, with the same leak check (at most 33 % of the title's words; the
  limit is 40 %).
  - 11 come from commits that added exactly one entry, the commit's subject checked against the title by hand.
  - Many projects wrote their entries several at a time, the small ones all in one first commit. The other 26
    questions are written from the entry itself, which is a weaker derivation and is marked so in each question.
  - Maity's 41 questions apply to the registry set too.
- **Commands.** Phase 1 and phase 2 as before; the registry set is reported on all questions, Maity's alone and
  its own alone.
- **Step 4's title weight.** Chosen by MRR on Maity's text questions in ×1, measured on the registry's own
  questions.

**The numbers** (`results/2026-11-08-offline-registry/`). Recall@1 / @5 / @10, MRR, median tokens:

| set, questions | BM25 | embed | hybrid |
|---|---|---|---|
| ×1, Maity's | .38 / .56 / .72, .47, 1050 | .25 / .50 / .66, .38, 1034 | .38 / .75 / .78, .52, 1038 |
| registry, Maity's | .38 / .50 / .69, .46, 1061 | .25 / .47 / .66, .37, 1030 | .31 / .72 / .78, .48, 1079 |
| registry, its own | .49 / .70 / .81, .60, 993 | .30 / .57 / .68, .43, 984 | .51 / .78 / .89, .64, 950 |
| ×10, Maity's | .34 / .41 / .47, .38, 1128 | .19 / .25 / .34, .24, 1024 | .22 / .50 / .59, .37, 1053 |

- **The baseline** (every member's index plus the answer's topic files): a median of 34.6k tokens on the registry
  set. Reading every index alone is 29.3k tokens.
- **Graph and filter commands:** recall 1.0, median 2.4k tokens.
- **Cache:** 16 MB; it builds in 0.5 s.
- **The title weight**, Maity on ×1 and the registry's own questions, MRR:

  | weight | 1 | 2 (now) | 3 | 4 | 5 (chosen) | 6 | 8 | 10 |
  |---|---|---|---|---|---|---|---|---|
  | Maity, ×1 | .47 | .47 | .47 | .49 | .51 | .49 | .47 | .47 |
  | registry, own | .61 | .60 | .60 | .60 | .60 | .60 | .59 | .59 |

**What it shows.**
- **Different projects barely disturb a search.** Maity's questions lose little going from ×1 to the registry set:
  .72 to .69 at BM25's recall@10, .78 to .78 for hybrid. On ×10 they drop to .47 and .59. Near-copies are the hard
  case; a larger set of other projects is not, because their words differ.
- **The registry's own questions are easier than Maity's.** Hybrid finds the answer in the top ten for 89 % of
  them, BM25 for 81 %. Small projects have few entries that compete.
- **Hybrid is the best at @5 and @10 on every realistic set.** At rank 1, BM25 and hybrid are even on the
  registry's questions (.49 and .51), and BM25 is ahead on Maity's (.38 and .31).
- **Step 4's title weight does not hold.** On the registry's questions every weight gives an MRR of .59 to .61, and
  on Maity's ×1 the chosen 5 adds two questions at rank 1 over 2. The hypothesis that the weight carried over was
  wrong; it was fitted to Maity's titles.

**Decisions.**
- Keep the title weight at 2. Step 4's proposal of 5 is withdrawn.
- The registry set is the realistic large set for the agent runs, beside ×10 as the stress test.
- Hybrid against BM25 is decided there, as before; offline, hybrid's lead is at @5 and @10, not at rank 1.

**Open questions.**
- In a family of several repositories, `git -C root` does not descend into a member with its own `.git`. The cache
  key of `ktw` has to be computed per member, or hash each member's files by content (#s8qb, 90379).
- How much of the ranking gap is the query? An agent writes its own query, not the question as asked.
- Does an agent recognise graph and filter questions, and use the exact commands for them?
- How much context does an agent's session hold at the answer, against the per-turn sums?
