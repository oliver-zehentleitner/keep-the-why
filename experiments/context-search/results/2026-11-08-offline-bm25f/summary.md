Tokenizer: tiktoken cl100k_base

Text questions only, the question as the query: recall@1 / @5 / @10, MRR, median tokens (a lower bound: the hit lists read plus `show` of the first expected hit). bm25f is measured on the half of the questions its parameters were not chosen on; bm25f ceiling is the grid's best on all questions, for scale only.

| dataset | bm25 | bm25f | bm25_2step | bm25f_2step | bm25f_ceiling |
|---|---|---|---|---|---|
| x1 | 0.38 / 0.56 / 0.72, 0.47, 1050.0 | 0.41 / 0.59 / 0.72, 0.51, 1047.0 | 0.34 / 0.53 / 0.62, 0.43, 1633.0 | 0.28 / 0.62 / 0.75, 0.45, 1606.5 | 0.50 / 0.59 / 0.69, 0.56, 1047.0 |
| x5 | 0.34 / 0.47 / 0.53, 0.40, 1116.5 | 0.31 / 0.53 / 0.59, 0.40, 1071.5 | 0.28 / 0.44 / 0.50, 0.34, 1699.0 | 0.31 / 0.44 / 0.50, 0.38, 1687.0 | 0.38 / 0.53 / 0.59, 0.44, 1061.5 |
| x10 | 0.34 / 0.41 / 0.47, 0.38, 1127.5 | 0.28 / 0.44 / 0.53, 0.38, 1152.0 | 0.28 / 0.44 / 0.47, 0.34, 1703.5 | 0.31 / 0.44 / 0.53, 0.39, 1726.0 | 0.38 / 0.44 / 0.53, 0.42, 1099.0 |
| x10-identical | 0.38 / 0.38 / 0.38, 0.39, 1089.0 | 0.41 / 0.41 / 0.41, 0.42, 1059.0 | 0.38 / 0.44 / 0.44, 0.40, 1689.0 | 0.38 / 0.47 / 0.47, 0.40, 1692.5 | 0.50 / 0.50 / 0.50, 0.51, 1059.0 |

Parameters chosen per half (tuned on half 1 → used on half 2, and back), and the ceiling's:

- x1: {'k1': 1.2, 'w_title': 5, 'w_topic': 0, 'b_title': 0.75, 'b_prose': 0.9, 'b_topic': 0.3}; {'k1': 2.0, 'w_title': 5, 'w_topic': 0, 'b_title': 0.75, 'b_prose': 0.9, 'b_topic': 0.3}; ceiling {'k1': 1.2, 'w_title': 5, 'w_topic': 0, 'b_title': 0.75, 'b_prose': 0.9, 'b_topic': 0.3}
- x5: {'k1': 1.2, 'w_title': 8, 'w_topic': 0, 'b_title': 0.3, 'b_prose': 0.9, 'b_topic': 0.3}; {'k1': 2.0, 'w_title': 5, 'w_topic': 0, 'b_title': 0.75, 'b_prose': 0.9, 'b_topic': 0.3}; ceiling {'k1': 1.6, 'w_title': 8, 'w_topic': 0, 'b_title': 0.75, 'b_prose': 0.9, 'b_topic': 0.3}
- x10: {'k1': 1.6, 'w_title': 8, 'w_topic': 0, 'b_title': 0.75, 'b_prose': 0.5, 'b_topic': 0.3}; {'k1': 2.0, 'w_title': 8, 'w_topic': 0, 'b_title': 0.3, 'b_prose': 0.9, 'b_topic': 0.3}; ceiling {'k1': 1.6, 'w_title': 5, 'w_topic': 0, 'b_title': 0.3, 'b_prose': 0.9, 'b_topic': 0.3}
- x10-identical: {'k1': 1.2, 'w_title': 5, 'w_topic': 0, 'b_title': 0.75, 'b_prose': 0.9, 'b_topic': 0.3}; {'k1': 2.0, 'w_title': 5, 'w_topic': 0, 'b_title': 0.3, 'b_prose': 0.9, 'b_topic': 0.3}; ceiling {'k1': 1.2, 'w_title': 5, 'w_topic': 0, 'b_title': 0.75, 'b_prose': 0.9, 'b_topic': 0.3}
