---
layout: publication
permalink: /publications/neurad/
title: "NeuRAD: Neural Rendering for Autonomous Driving"
venue: ARXIV
authors:
  - Tonderski
  - Lindstrom
  - Hess
  - Ljungbergh
  - Petersson
  - Svensson
code: https://github.com/georghess/neurad
date: 2023-09-23 00:00:00 +00:00
arxiv: https://arxiv.org/abs/2311.15260
n_equal_contrib: 3
thumbnail-video: laneshift_compressed.mp4
---

<div style="display: flex; align-items: center; justify-content: center;">
  <video controls autoplay loop muted playsinline style="width: 600px;">
    <source src="suppvideo.webm" type="video/webm">
  </video>
</div>

---

# Abstract
Neural radiance fields (NeRFs) have gained popularity in the autonomous driving (AD) community. Recent methods show NeRFs' potential for closed-loop simulation, enabling testing of AD systems, and as an advanced training data augmentation technique. However, existing methods often require long training times, dense semantic supervision, or lack generalizability. This, in turn, hinders the application of NeRFs for AD at scale. In this paper, we propose NeuRAD, a robust novel view synthesis method tailored to dynamic AD data. Our method features simple network design, extensive sensor modeling for both camera and lidar --- including rolling shutter, beam divergence and ray dropping --- and is applicable to multiple datasets out of the box. We verify its performance on five popular AD datasets, achieving state-of-the-art performance across the board. To encourage further development, we openly release the NeuRAD source code.

---

# Overview

<figure>
  <img style="width: 100%; margin: 0 auto;" src="MethodOverview.png"/>
  <figcaption>
  Fig 1. Overview of our method.
  </figcaption>
</figure>

---

# Rolling Shutter

Rolling shutter is caused by the fact that both cameras and lidars typically do not capture the entire scene at the same time. Instead, they capture the scene sequentially, one row at a time for images, and in a rotating manner around the height axis for a 360-spinning lidar. This means that each pixel and lidar point has an individual timestamp, and it is especially problematic for dynamic scenes, as the scene can change significantly between the first and last measurement.

To compensate for this effect we explicitly assign individual timestamps to each pixel and lidar point, and adjust the ray origin and direction accordingly by linearly interpolating the sensor pose. We additionally interpolate the poses for all dynamic actors in the scene as well. The impact of this detailed modelling is shown below:

<div style="display: flex; justify-content: space-around;">
{% include two_image_slider.html
  left_image="norolling_rgb.jpg"
  right_image="withrolling_rgb.jpg"
  height="25"
  id="1"
  caption="Effect of rolling shutter on RGB"
%}
{% include two_image_slider.html
  left_image="norolling_depth.jpg"
  right_image="withrolling_depth.jpg"
  height="25"
  id="2"
  caption="Effect of rolling shutter on depth"
%}
</div>

---

# Ray divergence

Recent work has shown that NeRFs suffer from aliasing artifacts when objects in the scene are viewed at different distances. This is especially common in automotive scenes, where the sensors (ego vehicle) moves through the scene, and the distance to the objects in the scene changes. Inspired by recent work (ZipNeRF), we model the beam divergence of the lidar sensor, and the size of individual pixels, by reweighting the iNGP hashgrid features. Specifically, for a given ray sample, we compare the volume of the frustum it represents, with the volume of a voxel at each resolution of the hashgrid. We then downweight features for scales that are much smaller than the considered frustum. This is illustrated below:

Note that this formulation is different from prior work, where the downweighting is based on gaussians, and the hashgrid is sampled multiple time, incurring a significant computational overhead. In contrast, our formulation is simpler and faster, but expressive. Still, we find that it significantly improves the rendering quality, and especially the depth estimation, as shown below:

---

# Using sensor embeddings

<div style="display: flex; justify-content: space-around;">
{% include two_image_slider.html
  left_image="without_appemb.jpg"
  right_image="with_appemb.jpg"
  height="30"
  id="3"
  caption="Rendering without and with sensor embedding"
%}
</div>