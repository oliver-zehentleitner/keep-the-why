# Context search: measuring how an agent best searches a large `context/`

Phase 1 of the context search card. It builds datasets from a real project's `context/` at three sizes, sets a
question set with known answers, and measures, offline first, what each way of searching costs and finds. The
winner ships in `ktw`, the one command an agent uses for `context/` (search and lint).

## The source

Maity's family, read-only, at a pinned commit (the one `questions.json` names): the root and its three members,
`hub/`, `web/` and `cli/`, each with its own `.keep-the-why` and `context/`. An agent in a family searches across
members, so the datasets keep all four.

```sh
export TMPDIR=/var/tmp
git clone --filter=blob:none https://github.com/oliver-zehentleitner/maity.git /var/tmp/maity
git -C /var/tmp/maity checkout 0720d70115a5dea52249c1c6de4553d488bf8ed0
```

At that commit: 85 topic files and 1043 entries, about 2.3 MB: the root 24 / 297, `hub` 47 / 423, `web` 8 / 224,
`cli` 6 / 99.

## The datasets

```sh
D=/var/tmp/context-search-data
python make_dataset.py /var/tmp/maity $D/x1  --copies 0
python make_dataset.py /var/tmp/maity $D/x5  --copies 4
python make_dataset.py /var/tmp/maity $D/x10 --copies 9
python make_dataset.py /var/tmp/maity $D/x10-identical --copies 9 --mode identical
for m in . hub web cli; do ktw-lint --strict $D/x10/$m; done   # every member of every set passes
```

- **vocab** (the primary sets): every member keeps its `.keep-the-why` and family links and gets its copies beside
  its own topics. Each copy has new Ids (`uuid5`, reproducible), new topic names and anchors, its references
  rewritten into the copy — one Id map for the whole family, so a reference from one member into another stays in
  the copy — and the 150 most frequent title words of the family shuffled among themselves (a reproducible
  derangement per copy, within bands of five neighbours in frequency), so a copy reads like a plausible project
  of the same kind but does not answer a question about the original. Every domain word occurs in every copy, so
  its document frequency grows with the set like any other word's (the generator fails otherwise, and reports
  the spread); made-up words unique to a copy, the first build's choice, gave the query words a tenfold IDF at
  ×10 (review finding). The one right answer stays the original entry. URLs (a canonical, an
  external reference) are names and never renamed, and the words the entry format itself uses stay: the
  linter's field names and fixed values and the body labels the dashboard's state parser reads, taken from
  there. The generator fails unless every reference by canonical to a family entry names a member's canonical.
- **identical** (offline control only): copies keep the text, so size is measured without the cost of telling
  entries apart.

The datasets are built, not committed.

## The questions

`questions.json`, 41 questions. Each names its source, how its expected Ids were found, the member the agent
starts in (default: the root) and the members the answer lives in:

- 32 come from Maity's history, a commit subject that added exactly one entry (in the root, `hub`, `web` or
  `cli`), rephrased as the question someone would ask; the expected Id is the entry that commit added. 7 start in
  another member than the answer's.
- 9 come from the graph or a filter (what supersedes X, a supersede chain, a See link, every incident and every
  needs-review entry of the family); the harness recomputes their Ids from every dataset and fails when they
  differ. A filter question's answer in a copied set is every entry the filter matches there, the copies'
  included: nothing in a copy says it is one.
- A rule on a field an entry may carry more than once, Type or See, matches any of its lines: an entry with
  `**Type:** decision` and `**Type:** incident` is an incident (17 of the original's 23 incidents carry it first, 6
  after another Type). A filter's answer is also counted a second way, as its field lines in the raw text, and the
  harness fails when the two differ (review finding: reading the first Type only had dropped those 6, and the
  check against the same reading could not see it).

The harness also checks that no question gives its answer away: the share of the expected entry's title words
(stop words out, a plural folded) that the question repeats must stay at or below 40 %, reported per question.
Graph and filter questions name their starting point or filter on purpose and are not held to it.

## The measurements

- `harness_offline.py DATA_DIR [--out results/DATE]`: no model, every dataset. Today it measures the baseline,
  today's way in a family: the start member's `index.md`, the other members' indexes (the skill's family rule),
  then the topic that holds the answer, as a lower bound (the right topic first time). Index tokens per member
  and summed.
- Next: the candidates (an entry-level index, a query CLI with filters and graph queries, BM25, local embeddings),
  each with recall@k, MRR, the tokens it prints, and its cache's build time and size; then agent runs (Claude
  Code first, then Codex CLI or opencode) for the baseline and the offline winners, with exact answers, the
  session's total context at the answer, tool calls and wall time.

- `ktw_proto.py PROJECT index|find|show|graph|cache`: a prototype of the search commands over one cache of the
  family's entries (the linter's parser): an entry-level index, filters (`--type`, `--status`, `--member`),
  graph queries over See and Superseded by in both directions, ranked full text (BM25), and static embeddings
  (`--rank embed`, model2vec `potion-base-8M`, an extra). One line per entry, `id · type/status · title ·
  member/file:L1-L2`. The cache is keyed on the tree of the family and the dirty state of its context.
- `harness_candidates.py DATA_DIR [--out results/DATE] [--no-embed]`: the candidates on every dataset, no model
  in the loop: recall@1/@5/@10 and MRR of BM25, embeddings and both fused by reciprocal rank (the question as the
  query), the tokens an agent would read (`find -n 10` and `show` of the first hit), the entry-level index's
  tokens, the exact commands for graph and filter questions, and the cache's build time and size. In the
  identical control an expected entry counts as found at its best-ranked copy.

`results/` keeps each run's `summary.md`. Transcripts stay on the machine that ran them.
