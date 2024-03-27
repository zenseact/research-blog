---
layout: publication
permalink: /publications/heal-swin/
title: "HEAL-SWIN: A Vision Transformer On The Sphere"
venue: CVPR24
authors:
  - Carlsson
  - Gerken
  - Linander
  - Spiess
  - Ohlsson
  - Petersson
  - Persson

date: 2023-06-14 00:00:00 +00:00
code: https://github.com/JanEGerken/HEAL-SWIN
arxiv: https://arxiv.org/abs/2307.07313
n_equal_contrib: 2
thumbnail-img: heal-swin.png
---

# Abstract
High-resolution wide-angle fisheye images are becoming more and more important for robotics applications such as autonomous driving. However, using ordinary convolutional neural networks or vision transformers on this data is problematic due to projection and distortion losses introduced when projecting to a rectangular grid on the plane. We introduce the HEAL-SWIN transformer, which combines the highly uniform Hierarchical Equal Area iso-Latitude Pixelation (HEALPix) grid used in astrophysics and cosmology with the Hierarchical Shifted-Window (SWIN) transformer to yield an efficient and flexible model capable of training on high-resolution, distortion-free spherical data. In HEAL-SWIN, the nested structure of the HEALPix grid is used to perform the patching and windowing operations of the SWIN transformer, resulting in a one-dimensional representation of the spherical data with minimal computational overhead. We demonstrate the superior performance of our model for semantic segmentation and depth regression tasks on both synthetic and real automotive datasets. Our code is available at [https://github.com/JanEGerken/HEAL-SWIN](https://github.com/JanEGerken/HEAL-SWIN).