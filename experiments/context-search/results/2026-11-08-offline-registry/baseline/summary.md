Tokenizer: tiktoken cl100k_base

| dataset | entries | topics | KB | index tokens (all members) | baseline median | baseline max |
|---|---|---|---|---|---|---|
| registry | 1740 | 220 | 3697 | 29293 | 34593.0 | 280748 |
| x1 | 1043 | 85 | 2341 | 18008 | 33955 | 269463 |
| x10 | 10430 | 850 | 23436 | 179315 | 195262 | 2706862 |
| x10-identical | 10430 | 850 | 23431 | 177965 | 193912 | 2693481 |
| x5 | 5215 | 425 | 11721 | 89717 | 105664 | 1352609 |

Per member: entries / topics / index tokens

| dataset | . | cli | hub | web |
|---|---|---|---|---|
| registry | 297 / 24 / 4992 | 99 / 6 / 1655 | 423 / 47 / 8309 | 224 / 8 / 3052 |
| x1 | 297 / 24 / 4992 | 99 / 6 / 1655 | 423 / 47 / 8309 | 224 / 8 / 3052 |
| x10 | 2970 / 240 / 49937 | 990 / 60 / 15539 | 4230 / 470 / 84097 | 2240 / 80 / 29742 |
| x10-identical | 2970 / 240 / 49614 | 990 / 60 / 15524 | 4230 / 470 / 83405 | 2240 / 80 / 29422 |
| x5 | 1485 / 120 / 24988 | 495 / 30 / 7816 | 2115 / 235 / 42006 | 1120 / 40 / 14907 |

Registry projects (beside Maity's family in the registry set): entries / topics / index tokens

| project | entries | topics | index tokens |
|---|---|---|---|
| github.com__hasansezertasan__copier-pyproject | 112 | 23 | 1036 |
| github.com__hasansezertasan__copier-rust | 24 | 7 | 376 |
| github.com__oliver-zehentleitner-aigent__ordersync | 4 | 3 | 258 |
| github.com__oliver-zehentleitner__keep-the-why | 163 | 10 | 1092 |
| github.com__oliver-zehentleitner__lasteverLM | 300 | 108 | 5739 |
| github.com__oliver-zehentleitner__repo-native-project-memory | 6 | 1 | 193 |
| github.com__oliver-zehentleitner__ubdcc-dashboard | 3 | 2 | 174 |
| github.com__oliver-zehentleitner__unicorn-binance-depth-cache-cluster | 5 | 3 | 229 |
| github.com__oliver-zehentleitner__unicorn-binance-local-depth-cache | 5 | 2 | 199 |
| github.com__oliver-zehentleitner__unicorn-binance-rest-api | 5 | 3 | 200 |
| github.com__oliver-zehentleitner__unicorn-binance-suite | 10 | 4 | 241 |
| github.com__oliver-zehentleitner__unicorn-binance-trailing-stop-loss | 6 | 4 | 278 |
| github.com__oliver-zehentleitner__unicorn-binance-websocket-api | 21 | 4 | 466 |
| github.com__oliver-zehentleitner__unicorn-fy | 6 | 2 | 203 |
| github.com__rapt0p7__scenegrid-console | 10 | 5 | 186 |
| github.com__zyvop__zyvop-cli | 10 | 3 | 184 |
| gitlab.com__oliver-zehentleitner__keep-the-why-demo | 7 | 3 | 231 |

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
| r01 | constraint | 17% |
| r02 | why-rejected | 0% |
| r03 | decision | 17% |
| r04 | incident | 0% |
| r05 | constraint | 0% |
| r06 | constraint | 0% |
| r07 | why-rejected | 0% |
| r08 | decision | 0% |
| r09 | decision | 11% |
| r10 | decision | 0% |
| r11 | decision | 0% |
| r12 | decision | 9% |
| r13 | why-rejected | 0% |
| r14 | why-rejected | 0% |
| r15 | decision | 25% |
| r16 | decision | 22% |
| r17 | why-rejected | 14% |
| r18 | constraint | 17% |
| r19 | decision | 20% |
| r20 | incident | 12% |
| r21 | incident | 14% |
| r22 | workaround | 0% |
| r23 | decision | 0% |
| r24 | decision | 0% |
| r25 | constraint | 0% |
| r26 | constraint | 10% |
| r27 | incident | 33% |
| r28 | decision | 20% |
| r29 | incident | 29% |
| r30 | decision | 33% |
| r31 | decision | 20% |
| r32 | decision | 0% |
| r33 | why-rejected | 0% |
| r34 | constraint | 25% |
| r35 | constraint | 17% |
| r36 | why-rejected | 0% |
| r37 | decision | 0% |

Problems: 0
