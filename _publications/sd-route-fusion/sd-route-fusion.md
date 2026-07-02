---
layout: publication
permalink: /publications/sd-route-fusion/
title: "SD-RouteFusion: Ego-Trajectory Prediction with SD-Map Route Conditioning"
venue: IEEEF26
authors:
  - Voloshyn
  - Martens
  - Liu
  - Vinkas
  - Fu
code: https://github.com/zenseact/SD-RouteFusion
n_equal_contrib: 2
date: 2026-03-01 00:00:00 +0000
topics:
  - Perception & motion forecasting
---

# SD-RouteFusion: Ego-Trajectory Prediction with SD-Map Route Conditioning

Sviatoslav Voloshyn*, Bruno K. W. Martens*, Wangxin Liu, Jakob Vinkas, Junsheng Fu  
Zenseact, Gothenburg, Sweden  

*Denotes equal contribution

Published in: [TBD]

## Links

- Paper: [TBD]
- Code: https://github.com/zenseact/SD-RouteFusion

---

# TLDR

We introduce SD-RouteFusion, an end-to-end ego-trajectory prediction method that combines a front-facing camera, ego-vehicle kinematics, and a navigation route derived from scalable Standard Definition maps. By using SD-map route intent as a long-horizon prior and selecting between route-led and image-led trajectory hypotheses, SD-RouteFusion improves prediction accuracy while remaining robust when route information is noisy or wrong.

---

# Abstract

Ego-trajectory prediction is a core component for autonomous driving systems, helping estimate how the ego vehicle is likely to move in the near future. Many existing methods rely on High Definition maps (HD maps), which provide precise lane-level geometry but are expensive to build, maintain, and scale globally.

In contrast, production vehicles routinely have access to lightweight navigation routes from Standard Definition maps. These routes are globally available and practical for deployment, but they can be noisy due to localization drift, stale map data, roadworks, or map connectivity errors.

We propose SD-RouteFusion, a deployable end-to-end ego-trajectory prediction framework that conditions on a front-facing camera image, ego-vehicle kinematics, and an SD-map-derived navigation route. The model generates two complementary trajectory hypotheses: one led by visual evidence and one led by route intent. A gating classifier then selects the more reliable prediction at inference time.

On a large-scale real-world dataset with 480k driving scenarios collected across 10 European countries and the U.S., SD-map route conditioning substantially improves long-horizon prediction. Adding SD-route information reduces ADE by 10.5% over an image-and-kinematics baseline, while the full SD-RouteFusion architecture achieves a 16.9% ADE reduction over the same baseline for an 8-second prediction horizon.

---

# Method

SD-RouteFusion is designed around a practical deployment setting: a forward-facing camera, ego-vehicle state, and a navigation route. Instead of requiring HD-map lane geometry, we use a route prior generated from SD maps.

The route prior is constructed by projecting the ego vehicle’s start and end positions onto nearby OpenStreetMap road links and searching over topology-consistent candidate routes. The selected route is the one that best matches the ground-truth future displacement, and is then re-centered relative to the ego vehicle. In deployment, the same type of signal can be obtained directly from the vehicle’s onboard navigation system.

The model has three main inputs:

- a front-facing camera image,
- recent ego-vehicle kinematics,
- an SD-map navigation route.

The camera image is encoded using a ResNet-18 backbone and lifted into a bird’s-eye-view representation. The kinematics are encoded using a GRU, while the route is encoded with a lightweight MLP. These embeddings are then fused through mirrored cross-attention blocks.

This produces two trajectory hypotheses:

- an image-led prediction, which relies more strongly on local visual cues and can act as a fallback when the route is unreliable;
- a route-led prediction, which follows long-horizon route intent and is useful when visual information is ambiguous or occluded.

A gating classifier compares the two hypotheses and selects the final trajectory prediction. This hard selection avoids simply blending conflicting signals, which is especially important when the route prior is mislocalized, outdated, or inconsistent with the observed scene.

---

# Results

We evaluate SD-RouteFusion on an internal extension of the Zenseact Open Dataset containing 480k scenarios, with a test set of 130k samples. Each scenario contains at least 1.5 seconds of kinematic history and an 8-second future ego trajectory.

The results show that SD-map routes provide a strong long-horizon semantic prior. Compared to an image-and-kinematics baseline, adding route information through a simple early-fusion model reduces ADE by 10.5% and FDE by 19.2% on the full 8-second test set.

SD-RouteFusion improves further by using cross-attention and late-stage gating. On the full 8-second test set, it reduces ADE from 2.19 m to 1.82 m compared to the image-and-kinematics baseline, corresponding to a 16.9% improvement. On turning cases, where route intent is particularly valuable, the method reduces ADE from 2.47 m to 1.92 m.

Qualitative results show that the gating mechanism helps resolve ambiguity in visually challenging scenes. When the camera view is partially occluded, route information often helps recover the correct future path. When the route is corrupted due to localization errors or map mismatch, the model can instead fall back to the image-led branch.

These results suggest that SD-map route conditioning is a practical and scalable alternative to HD-map-dependent trajectory prediction, especially for real-world deployment where route signals are useful but imperfect.

---

# BibTeX

bibtex @article{voloshyn2025sdroutefusion,   title   = {SD-RouteFusion: Ego-Trajectory Prediction with SD-Map Route Conditioning},   author  = {Voloshyn, Sviatoslav and Martens, Bruno K. W. and Liu, Wangxin and Vinkas, Jakob and Fu, Junsheng},   journal = {arXiv preprint},   year    = {2025} } 
