---
layout: publication
permalink: /publications/future-od/
title: Future Object Detection with Spatiotemporal Transformers
venue: ARXIV
authors:
  - Tonderski
  - Johnander
  - Petersson
  - Astrom
code:
arxiv: https://arxiv.org/abs/2301.08965
usemathjax: true
n_equal_contrib: 1
---

# Abstract
We propose the task Future Object Detection, in which the goal is to predict the bounding boxes for all visible objects in a future video frame. While this task involves recognizing temporal and kinematic patterns, in addition to the semantic and geometric ones, it only requires annotations in the standard form for individual, single (future) frames, in contrast to expensive full sequence annotations. We propose to tackle this task with an end-to-end method, in which a detection transformer is trained to directly output the future objects. In order to make accurate predictions about the future, it is necessary to capture the dynamics in the scene, both object motion and the movement of the ego-camera. To this end, we extend existing detection transformers in two ways. First, we experiment with three different mechanisms that enable the network to spatiotemporally process multiple frames. Second, we provide ego-motion information to the model in a learnable manner. We show that both of these extensions improve the future object detection performance substantially. Our final approach learns to capture the dynamics and makes predictions on par with an oracle for prediction horizons up to 100 ms, and outperforms all baselines for longer prediction horizons. By visualizing the attention maps, we observe that a form of tracking emerges within the network. Code is available at github.com/atonderski/future-object-detection.