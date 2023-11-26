---
layout: publication
permalink: /publications/temporal-ensambles/
title: "You can have your ensemble and run it too &#8212; Deep Ensembles Spread Over Time"
venue: ICCV23
date: 2023-09-20 00:00:00 +00:00
authors:
  - Meding
  - Bodin
  - Tonderski
  - Petersson
  - Svensson
arxiv: https://arxiv.org/abs/2309.11333
n_equal_contrib: 2
usemathjax: true
---

# Abstract
Ensembles of independently trained deep neural networks yield uncertainty estimates that rival Bayesian networks in performance. They also offer sizable improvements in terms of predictive performance over single models. However, deep ensembles are not commonly used in environments with limited computational budget-such as autonomous driving-since the complexity grows linearly with the number of ensemble members. An important observation that can be made for robotics applications, such as autonomous driving, is that data is typically sequential. For instance, when an object is to be recognized, an autonomous vehicle typically observes a sequence of images, rather than a single image. This raises the question, could the deep ensemble be spread over time? In this work, we propose and analyze Deep Ensembles Spread Over Time (DESOT). The idea is to apply only a single ensemble member to each data point in the sequence, and fuse the predictions over a sequence of data points. We implement and experiment with DESOT for traffic sign classification, where sequences of tracked image patches are to be classified. We find that DESOT obtains the benefits of deep ensembles, in terms of predictive and uncertainty estimation performance, while avoiding the added computational cost. Moreover, DESOT is simple to implement and does not require sequences during training. Finally, we find that DESOT, like deep ensembles, outperform single models for out-of-distribution detection.

# BibTeX
```bibtex
@inproceedings{meding2023you,
  title     = {You can have your ensemble and run it too-Deep Ensembles Spread Over Time},
  author    = {Meding, Isak and Bodin, Alexander and Tonderski, Adam and Johnander, Joakim and Petersson, Christoffer and Svensson, Lennart},
  booktitle = {Proceedings of the IEEE/CVF International Conference on Computer Vision},
  pages     = {4020--4029},
  year      = {2023}
}
```