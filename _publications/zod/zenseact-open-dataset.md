---
title: "Zenseact Open Dataset: A large-scale and diverse multimodal dataset for autonomous driving"
permalink: /publications/zod/
date: 2023-05-03 00:00:00 +00:00
venue: ICCV23
layout: publication
authors:
  - Alibeigi
  - Ljungbergh
  - Tonderski
  - Hess
  - Lilja
  - Lindstrom
  - Motorniuk
  - Fu
  - Widahl
  - Petersson
website: https://zod.zenseact.com
code: https://github.com/zenseact/zod
arxiv: https://arxiv.org/abs/2305.02008
n_equal_contrib: 3
thumbnail-img: zod_thumbnail.jpg

---

# Abstract
Existing datasets for autonomous driving (AD) often lack diversity and long-range capabilities, focusing instead on 360° perception and temporal reasoning. To address this gap, we introduce Zenseact Open Dataset (ZOD), a large-scale and diverse multimodal dataset collected over two years in various European countries, covering an area 9× that of existing datasets. ZOD boasts the highest range and resolution sensors among comparable datasets, coupled with detailed keyframe annotations for 2D and 3D objects (up to 245m), road instance/semantic segmentation, traffic sign recognition, and road classification. We believe that this unique combination will facilitate breakthroughs in long-range perception and multi-task learning. The dataset is composed of Frames, Sequences, and Drives, designed to encompass both data diversity and support for spatio-temporal learning, sensor fusion, localization, and mapping. Frames consist of 100k curated camera images with two seconds of other supporting sensor data, while the 1473 Sequences and 29 Drives include the entire sensor suite for 20 seconds and a few minutes, respectively. ZOD is the only AD dataset released under the permissive CC BY-SA 4.0 license, allowing for both research and commercial use. The
dataset is accompanied by an extensive [development kit](https://github.com/zenseact/zod).
Data and more information are available [online](https://zod.zenseact.com/).

# BibTeX
```bibtex
@inproceedings{alibeigi2023zod,
  title     = {Zenseact open dataset: A large-scale and diverse multimodal dataset for autonomous driving},
  author    = {Alibeigi, Mina and Ljungbergh, William and Tonderski, Adam and
               Hess, Georg and Lilja, Adam and Lindström, Carl and Motorniuk, Daria
               and Fu, Junsheng and Widahl, Jenny and Petersson, Christoffer},
  booktitle = {Proceedings of the IEEE/CVF International Conference on Computer Vision},
  pages     = {20178--20188},
  year      = {2023}
}
```