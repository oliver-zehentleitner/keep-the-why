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

**The numbers** (`results/2026-11-06-offline-candidates/`):

Recall@1 / @5 / @10:

| set | BM25 | embed | hybrid |
|---|---|---|---|
| ×1 | .36 / .64 / .74 | .23 / .51 / .64 | .39 / .72 / .83 |
| ×5 | .36 / .59 / .74 | .23 / .49 / .61 | .39 / .69 / .80 |
| ×10 | .39 / .54 / .69 | .23 / .46 / .59 | .39 / .69 / .77 |
| ×10 identical | .36 / .36 / .36 | .26 / .26 / .28 | .41 / .44 / .54 |

- **Reading cost:** about 900–1000 tokens per question, against the baseline's 34k–226k.
- **Graph and filter questions:** answered fully by their commands, a median of about 2.5k tokens.
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

**Open questions.**
- How much of the ranking gap is the query? An agent writes its own query, not the question as asked.
- Does an agent recognise graph and filter questions, and use the exact commands for them?
- How much context does an agent's session hold at the answer, against the per-turn sums?
