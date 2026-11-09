Tokenizer: tiktoken cl100k_base

Ranked search on the text questions (graph and filter questions are measured under their commands below), with the question as the query: recall@1 / @5 / @10, MRR, median tokens read (find -n 10 plus show of the first expected hit, or of the first hit on a miss) over all text questions / over hits only. The tokens are an oracle lower bound: the harness knows which hit is right and reads only that one; an agent's real reading sequence is measured in the agent runs

| dataset | bm25 | embed | hybrid |
|---|---|---|---|
| x1 | 0.38 / 0.56 / 0.72, 0.47, 1050.0 / 1026 | 0.25 / 0.50 / 0.66, 0.38, 1034.0 / 995 | 0.38 / 0.75 / 0.78, 0.52, 1038.0 / 1011 |
| x10 | 0.34 / 0.44 / 0.47, 0.38, 1110.5 / 1078 | 0.16 / 0.25 / 0.41, 0.22, 1013.5 / 988 | 0.22 / 0.53 / 0.59, 0.37, 1049.5 / 1023 |
| x10-identical | 0.38 / 0.38 / 0.38, 0.39, 1080.5 / 1063.0 | 0.31 / 0.31 / 0.31, 0.33, 1031.0 / 1032.0 | 0.44 / 0.50 / 0.53, 0.47, 1064.5 / 1001 |
| x5 | 0.34 / 0.47 / 0.53, 0.40, 1102.5 / 1048 | 0.19 / 0.31 / 0.47, 0.27, 1006.5 / 977 | 0.19 / 0.53 / 0.59, 0.36, 1059.5 / 1028 |

Graph and filter questions under their commands (graph ID --depth 3, find --type/--status): the share of the answer the output holds, median tokens. q28's answer is a chain of three entries, so a ranked search's recall@1 there is at most 1/3; it is counted here, not above.

| dataset | recall | median tokens |
|---|---|---|
| x1 | 1.0 | 1894 |
| x10 | 1.0 | 2468 |
| x10-identical | 1.0 | 2468 |
| x5 | 1.0 | 2468 |

| dataset | entries | cache build s | cache MB | embed s | vectors MB | entry index tokens | exact commands: recall, median tokens |
|---|---|---|---|---|---|---|---|
| x1 | 1043 | 0.32 | 10.1 | 0.43 | 1.1 | 54666 | 1.0, 1894 |
| x10 | 10430 | 3.21 | 100.8 | 2.42 | 10.7 | 550155 | 1.0, 2468 |
| x10-identical | 10430 | 3.2 | 100.7 | 2.36 | 10.7 | 548684 | 1.0, 2468 |
| x5 | 5215 | 1.69 | 50.4 | 3.64 | 5.3 | 273591 | 1.0, 2468 |
