---
layout: publication
permalink: /publications/closing-real2sim-gap/
title: "Are NeRFs ready for autonomous driving? Towards closing the real-to-simulation gap"
venue: ARXIV
authors:
  - Lindstrom
  - Hess
  - Lilja
  - Fatemi
  - Hammarstrand
  - Petersson
  - Svensson
date: 2024-03-26 00:00:00 +00:00
#arxiv: https://arxiv.org/abs/2311.15260
n_equal_contrib: 2
#thumbnail-video: laneshift_compressed.mp4
---


# Abstract
Neural Radiance Fields (NeRFs) have emerged as promising tools for advancing autonomous driving (AD) research, offering scalable closed-loop simulation and data augmentation capabilities. However, to trust the results achieved in simulation, one needs to ensure that AD systems perceive real and rendered data in the same way. Although the performance of rendering methods is increasing, many scenarios will remain inherently challenging to reconstruct faithfully. To this end, we propose a novel perspective for addressing the real-to-simulated data gap. Rather than solely focusing on improving rendering fidelity, we explore simple yet effective methods to enhance perception model robustness to NeRF artifacts without compromising performance on real data. Moreover, we conduct the first large-scale investigation into the real-to-simulated data gap in an AD setting using a state-of-the-art neural rendering technique. Specifically, we evaluate object detectors and an online mapping model on real and simulated data, and study the effects of different pre-training strategies. Our results show notable improvements in model robustness to simulated data, even improving real-world performance in some cases. Last, we delve into the correlation between the real-to-simulated gap and image reconstruction metrics, identifying FID and LPIPS as strong indicators.


---
<!-- 
# BibTeX
```bibtex
@article{lindstrom2024real2sim,
  title     = {Are NeRFs ready for autonomous driving? Towards closing the real-to-simulation gap},
  author    = {Carl Lindstr{\"o}m, Georg Hess, Adam Lilja, Maryam Fatemi, Lars Hammarstrand, Christoffer Petersson, Lennart Svensson},
  journal   = {arXiv preprint arXiv:2311.15260},
  year      = {2024}
}
``` -->

