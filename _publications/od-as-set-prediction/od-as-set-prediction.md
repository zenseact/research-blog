---
layout: publication
permalink: /publications/od-as-set-prediction/
title: Object Detection as Probabilistic Set Prediction
venue: ECCV22
authors:
  - Hess
  - Petersson
  - Svensson
code: https://github.com/georghess/pmb-nll
arxiv: http://arxiv.org/abs/2203.07980
date: 2022-03-15 00:00:00 +00:00
n_equal_contrib: 1
---

# Abstract
Accurate uncertainty estimates are essential for deploying deep object detectors in safety-critical systems. The development and evaluation of probabilistic object detectors have been hindered by shortcomings in existing performance measures, which tend to involve arbitrary thresholds or limit the detector's choice of distributions. In this work, we propose to view object detection as a set prediction task where detectors predict the distribution over the set of objects. Using the negative log-likelihood for random finite sets, we present a proper scoring rule for evaluating and training probabilistic object detectors. The proposed method can be applied to existing probabilistic detectors, is free from thresholds, and enables fair comparison between architectures. Three different types of detectors are evaluated on the COCO dataset. Our results indicate that the training of existing detectors is optimized toward non-probabilistic metrics. We hope to encourage the development of new object detectors that can accurately estimate their own uncertainty. Code available [here](https://github.com/georghess/pmb-nll).