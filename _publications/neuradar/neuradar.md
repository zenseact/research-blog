---
layout: publication
permalink: /publications/neuradar/ # This is the permalink to the blog post. It should be the same as the name of the folder.
title: "NeuRadar: Neural Radiance Fields for Automotive Radar Point Clouds" # This is the title of the paper
venue: CVPRW25 # This is the venue of the paper. It must have a corresponding entry in `_data/venues.yml`.
authors:
  - Rafidashti
  - JiLan
  - Fatemi
  - Fu
  - Hammarstrand
  - Svensson
code: https://github.com/mrafidashti/neuradar
doi:  # This is the DOI, without protocol and domain, e.g., 10.1016/j.automatica.2023.111394
arxiv: https://arxiv.org/abs/2504.00859 # This is the arXiv link to the paper.
n_equal_contrib: 2 # This can be used if you have several authors that contributed equally to the paper. In this case, the first n authors listed in the `authors` field will be marked as equal contributors.
date: 2025-04-03 11:00:00 +0000 # This is the date of the paper submission
thumbnail-img: assets/imgs/neuradar_thumbnail.png # This is the thumbnail image that will be shown on the blog post. Next to the title.
---

# Abstract
Radar is an important sensor for autonomous driving (AD) systems due to its robustness to adverse weather and different lighting conditions. Novel view synthesis using neural radiance fields (NeRFs) has recently received considerable attention in AD due to its potential to enable efficient testing and validation but remains unexplored for radar point clouds. In this paper, we present NeuRadar, a NeRF-based model that jointly generates radar point clouds, camera images, and lidar point clouds. We explore set-based object detection methods such as DETR, and propose an encoder-based solution grounded in the NeRF geometry for improved generalizability. We propose both a deterministic and a probabilistic point cloud representation to accurately model the radar behavior, with the latter being able to capture radar's stochastic behavior. We achieve realistic reconstruction results for two automotive datasets, establishing a baseline for NeRF-based radar point cloud simulation models. In addition, we release radar data for ZOD's Sequences and Drives to enable further research in this field.

---

# BibTeX
```bibtex
@article{rafidashti2025neuradar,
  title        = {NeuRadar: Neural Radiance Fields for Automotive Radar Point Clouds},
  author       = {Rafidashti, Mahan and Lan, Ji and Fatemi, Maryam and Fu, Junsheng and Hammarstrand, Lars and Svensson, Lennart},
  journal      = {arXiv preprint arXiv:2504.00859},
  year         = {2025}
}
```