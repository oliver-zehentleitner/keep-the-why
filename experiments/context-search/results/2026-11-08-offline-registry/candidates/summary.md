Tokenizer: tiktoken cl100k_base

Ranked search on the text questions (graph and filter questions are measured under their commands below), with the question as the query: recall@1 / @5 / @10, MRR, median tokens read (find -n 10 plus show of the first expected hit, or of the first hit on a miss) over all text questions / over hits only. The tokens are an oracle lower bound: the harness knows which hit is right and reads only that one; an agent's real reading sequence is measured in the agent runs

| dataset | bm25 | embed | hybrid |
|---|---|---|---|
| registry | 0.43 / 0.61 / 0.75, 0.54, 1038 / 1012.0 | 0.28 / 0.52 / 0.67, 0.40, 1011 / 961.5 | 0.42 / 0.75 / 0.84, 0.56, 1021 / 992.5 |
| registry, Maity's questions | 0.38 / 0.50 / 0.69, 0.46, 1069.5 / 1052.5 | 0.25 / 0.47 / 0.66, 0.37, 1034.5 / 1026 | 0.31 / 0.72 / 0.78, 0.48, 1088.5 / 1039 |
| registry, its own questions | 0.49 / 0.70 / 0.81, 0.60, 1002 / 957.5 | 0.30 / 0.57 / 0.68, 0.43, 993 / 945 | 0.51 / 0.78 / 0.89, 0.64, 959 / 959 |
| registry, its own, commit-derived | 0.27 / 0.55 / 0.73, 0.44, 1251 / 1302.0 | 0.18 / 0.46 / 0.46, 0.33, 1154 / 1350 | 0.27 / 0.64 / 0.73, 0.45, 1183 / 1224.5 |
| registry, its own, entry-derived | 0.58 / 0.77 / 0.85, 0.67, 909.5 / 909.5 | 0.35 / 0.61 / 0.77, 0.47, 946.5 / 890.5 | 0.61 / 0.85 / 0.96, 0.72, 889.0 / 894 |
| x1 | 0.38 / 0.56 / 0.72, 0.47, 1057.5 / 1033 | 0.25 / 0.50 / 0.66, 0.38, 1039.5 / 1002 | 0.38 / 0.75 / 0.78, 0.52, 1047.5 / 1018 |
| x10 | 0.34 / 0.41 / 0.47, 0.38, 1133.0 / 1094 | 0.19 / 0.25 / 0.34, 0.24, 1030.5 / 1051 | 0.22 / 0.50 / 0.59, 0.37, 1062.5 / 1041 |
| x10-identical | 0.38 / 0.38 / 0.38, 0.39, 1094.0 / 1077.0 | 0.28 / 0.28 / 0.31, 0.30, 1061.0 / 1046.5 | 0.41 / 0.47 / 0.50, 0.45, 1086.0 / 1009.0 |
| x5 | 0.34 / 0.47 / 0.53, 0.40, 1125.5 / 1061 | 0.19 / 0.31 / 0.47, 0.26, 1032.5 / 996 | 0.19 / 0.53 / 0.59, 0.36, 1074.0 / 1049 |

Graph and filter questions under their commands (graph ID --depth 3, find --type/--status): the share of the answer the output holds, median tokens. q28's answer is a chain of three entries, so a ranked search's recall@1 there is at most 1/3; it is counted here, not above.

| dataset | recall | median tokens |
|---|---|---|
| registry | 1.0 | 2442 |
| x1 | 1.0 | 1926 |
| x10 | 1.0 | 2474 |
| x10-identical | 1.0 | 2474 |
| x5 | 1.0 | 2474 |

| dataset | entries | cache build s | cache MB | embed s | vectors MB | entry index tokens | exact commands: recall, median tokens |
|---|---|---|---|---|---|---|---|
| registry | 1740 | 0.46 | 16.5 | 0.58 | 1.8 | 101669 | 1.0, 2442 |
| x1 | 1043 | 0.31 | 10.2 | 0.34 | 1.1 | 55551 | 1.0, 1926 |
| x10 | 10430 | 3.23 | 101.2 | 2.85 | 10.7 | 574351 | 1.0, 2474 |
| x10-identical | 10430 | 3.11 | 101.1 | 2.34 | 10.7 | 571741 | 1.0, 2474 |
| x5 | 5215 | 1.55 | 50.6 | 3.56 | 5.3 | 286076 | 1.0, 2474 |
