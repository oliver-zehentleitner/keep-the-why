Tokenizer: tiktoken cl100k_base

The one-bag BM25's title weight, chosen by MRR on Maity's text questions in x1 (5) and measured on the registry's own questions in the registry set: recall@1 / @5 / @10, MRR. Weight 2 is ktw_proto.py's (reproduced: True).

| title weight | Maity, x1 | registry, own questions |
|---|---|---|
| 1 | 0.38 / 0.56 / 0.72, 0.47 | 0.49 / 0.70 / 0.84, 0.61 |
| 2 | 0.38 / 0.56 / 0.72, 0.47 | 0.49 / 0.70 / 0.81, 0.60 |
| 3 | 0.38 / 0.56 / 0.69, 0.47 | 0.49 / 0.70 / 0.81, 0.60 |
| 4 | 0.41 / 0.56 / 0.69, 0.49 | 0.49 / 0.70 / 0.81, 0.60 |
| 5 (chosen) | 0.44 / 0.56 / 0.69, 0.51 | 0.49 / 0.70 / 0.81, 0.60 |
| 6 | 0.41 / 0.56 / 0.72, 0.49 | 0.49 / 0.68 / 0.81, 0.60 |
| 8 | 0.38 / 0.56 / 0.72, 0.47 | 0.49 / 0.68 / 0.81, 0.59 |
| 10 | 0.38 / 0.56 / 0.72, 0.47 | 0.49 / 0.68 / 0.81, 0.59 |
