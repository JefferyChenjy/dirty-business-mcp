# EDA Report

## Data Quality (before vs after)

- Missing % before: {"name":0,"email":25,"website":20,"phone":32}
- Missing % after: {"name":0,"email":25,"website":20,"phone":45}
- Unique company names before: 147
- Unique company names after: 103
- Duplicate rate before: 26.5%
- Duplicate rate after: 48.5%

### Email Domain Distribution (Before)
| key | count |
| --- | --- |
| missing | 50 |
| hotmail.com | 12 |
| gmail.com | 9 |
| outlook.com | 9 |
| yahoo.com | 5 |
| quantumfleet.com | 4 |
| redwood.sg | 4 |
| cobalt.sg | 4 |
| novafreight.com | 4 |
| yorkstone.com | 4 |

### Email Domain Distribution (After)
| key | count |
| --- | --- |
| missing | 50 |
| hotmail.com | 12 |
| gmail.com | 9 |
| outlook.com | 9 |
| yahoo.com | 5 |
| quantumfleet.com | 4 |
| redwood.sg | 4 |
| cobalt.sg | 4 |
| novafreight.com | 4 |
| yorkstone.com | 4 |

## Distribution Analysis

- Name length before (p50/p90): 19 / 29
- Name length after (p50/p90): 16 / 29
- Similarity score distribution (p50/p90): 0.85 / 1
- Cluster size distribution (p50/p90/max): 1 / 4 / 4

## Error Analysis

### Top False Positives
_No data_

### Top False Negatives
| left_record_id | left_name | right_record_id | right_name | name_similarity |
| --- | --- | --- | --- | --- |
| 1 | Alpha Trading Corp | 3 | Alpha Trading Corp | 1 |
| 2 | Alpha  Trading | 3 | Alpha Trading Corp | 1 |
| 3 | Alpha Trading Corp | 4 | Alpha Trading Corp | 1 |
| 9 | CrestviewEngineering | 10 | CRESTVIEW ENGINEERING CORPORATION | 0.95 |
| 9 | CrestviewEngineering | 11 | crestview engineering corporation | 0.95 |
| 9 | CrestviewEngineering | 12 | Crestview Engineering Corporation | 0.95 |
| 13 | Delta. Supplies. Private Limited | 14 | Delta  Supplies | 0.4667 |
| 13 | Delta. Supplies. Private Limited | 15 | Delta Supplies | 0.4667 |
| 17 | Everbright Tech L.L.C. | 19 | Everbright  Tech | 0.7895 |
| 17 | Everbright Tech L.L.C. | 20 | Everbright Tech L.L.C. | 1 |
| 18 | everbright tech l.l.c. | 19 | Everbright  Tech | 0.7895 |
| 18 | everbright tech l.l.c. | 20 | Everbright Tech L.L.C. | 1 |
| 19 | Everbright  Tech | 20 | Everbright Tech L.L.C. | 1 |
| 21 | FALCON MARINE LTD | 22 | FalconMarine | 0.7059 |
| 21 | FALCON MARINE LTD | 23 | FalconMarine | 0.7059 |

### Biggest Clusters
| cluster_id | size | confidence | truth_entity_count |
| --- | --- | --- | --- |
| cluster_3 | 4 | 0.8667 | 1 |
| cluster_6 | 4 | 0.85 | 1 |
| cluster_10 | 4 | 0.9 | 1 |
| cluster_11 | 4 | 0.8875 | 1 |
| cluster_15 | 4 | 0.95 | 1 |
| cluster_16 | 4 | 0.9917 | 1 |
| cluster_27 | 4 | 0.9625 | 1 |
| cluster_36 | 4 | 0.94 | 1 |
| cluster_50 | 4 | 0.925 | 1 |
| cluster_55 | 4 | 0.93 | 1 |

### Suspicious Merges
_No data_

## Snapshot Metrics

- Dedupe precision/recall/F1: 100% / 47.33% / 64.25%
- Clustering F1: 79.34%
- Normalization exact match: 61.5%
