Tokenizer: tiktoken cl100k_base

Ranked search with the question as the query (filter questions left out): recall@1 / @5 / @10, MRR, median tokens read (find -n 10 + show of the first hit)

| dataset | bm25 | embed | hybrid |
|---|---|---|---|
| x1 | 0.36 / 0.64 / 0.74, 0.49, 1000 | 0.23 / 0.51 / 0.64, 0.36, 896 | 0.39 / 0.72 / 0.83, 0.53, 1025 |
| x10 | 0.39 / 0.54 / 0.69, 0.47, 932 | 0.23 / 0.46 / 0.59, 0.35, 892 | 0.39 / 0.69 / 0.77, 0.52, 990 |
| x10-identical | 0.36 / 0.36 / 0.36, 0.38, 636 | 0.26 / 0.26 / 0.28, 0.28, 595 | 0.41 / 0.44 / 0.54, 0.45, 880 |
| x5 | 0.36 / 0.59 / 0.74, 0.47, 962 | 0.23 / 0.49 / 0.61, 0.35, 896 | 0.39 / 0.69 / 0.80, 0.51, 1005 |

| dataset | entries | cache build s | cache MB | embed s | vectors MB | entry index tokens | exact commands: recall, median tokens |
|---|---|---|---|---|---|---|---|
| x1 | 1043 | 0.42 | 10.0 | 0.54 | 1.1 | 54624 | 1.0, 1892 |
| x10 | 10430 | 4.02 | 98.9 | 3.27 | 10.7 | 605842 | 1.0, 2460 |
| x10-identical | 10430 | 4.03 | 99.3 | 3.27 | 10.7 | 562471 | 1.0, 2460 |
| x5 | 5215 | 2.09 | 49.5 | 4.45 | 5.3 | 299562 | 1.0, 2460 |
