Tokenizer: tiktoken cl100k_base

| dataset | entries | topics | KB | index tokens (all members) | baseline median | baseline max |
|---|---|---|---|---|---|---|
| x1 | 1043 | 85 | 2341 | 18008 | 33955 | 269463 |
| x10 | 10430 | 850 | 23430 | 176669 | 192616 | 2701842 |
| x10-identical | 10430 | 850 | 23424 | 175487 | 191434 | 2688726 |
| x5 | 5215 | 425 | 11714 | 88278 | 104225 | 1349969 |

Per member: entries / topics / index tokens

| dataset | . | cli | hub | web |
|---|---|---|---|---|
| x1 | 297 / 24 / 4992 | 99 / 6 / 1655 | 423 / 47 / 8309 | 224 / 8 / 3052 |
| x10 | 2970 / 240 / 49202 | 990 / 60 / 15323 | 4230 / 470 / 82700 | 2240 / 80 / 29444 |
| x10-identical | 2970 / 240 / 48953 | 990 / 60 / 15314 | 4230 / 470 / 82096 | 2240 / 80 / 29124 |
| x5 | 1485 / 120 / 24558 | 495 / 30 / 7720 | 2115 / 235 / 41225 | 1120 / 40 / 14775 |

Answer leak: the share of the expected title's content words the question repeats (limit 40%; graph and filter questions not held)

| question | kind | leak |
|---|---|---|
| q01 | why-rejected | 33% |
| q02 | why-rejected | 0% |
| q03 | constraint | 20% |
| q04 | incident | 14% |
| q05 | incident | 12% |
| q06 | constraint | 10% |
| q07 | why-rejected | 10% |
| q08 | why-rejected | 0% |
| q09 | why-rejected | 27% |
| q10 | why-rejected | 29% |
| q11 | why-rejected | 17% |
| q12 | fact | 33% |
| q13 | why-rejected | 29% |
| q14 | constraint | 22% |
| q15 | why-rejected | 20% |
| q16 | why-rejected | 30% |
| q17 | incident | 25% |
| q18 | why-rejected | 25% |
| q19 | why-rejected | 22% |
| q20 | why-rejected | 10% |
| q21 | why-rejected | 31% |
| q22 | why-rejected | 33% |
| q23 | supersedes | — |
| q24 | supersedes | — |
| q25 | supersedes | — |
| q26 | supersedes | — |
| q27 | supersedes | — |
| q28 | thought-chain | — |
| q29 | see | — |
| q30 | filter | — |
| q31 | filter | — |
| q32 | why-rejected | 30% |
| q33 | why-rejected | 22% |
| q34 | why-rejected | 25% |
| q35 | why-rejected | 0% |
| q36 | why-rejected | 17% |
| q37 | why-rejected | 0% |
| q38 | why-rejected | 20% |
| q39 | why-rejected | 25% |
| q40 | constraint | 0% |
| q41 | why-rejected | 20% |

Problems: 0
