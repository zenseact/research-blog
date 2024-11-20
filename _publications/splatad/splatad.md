---
layout: publication
permalink: /publications/splatad/
title: "SplatAD: Real-Time Lidar and Camera Rendering with 3D Gaussian Splatting for Autonomous Driving"
venue: ARXIV
authors:
  - Hess
  - Lindstrom
  - Fatemi
  - Petersson
  - Svensson
code: https://github.com/carlinds/splatad
date: 2024-11-30 00:00:00 +00:00
arxiv: https://arxiv.org/abs/2311.15260
n_equal_contrib: 2
thumbnail-video: 
---

<figure class="figure__background">
  <img style="width: 100%; margin: 0 auto; mix-blend-mode: multiply;" src="frontfig.png"/>
</figure>

---

# Abstract
Ensuring the safety of autonomous robots, such as self-driving vehicles, requires extensive testing across diverse driving scenarios. Simulation is a key ingredient for conducting such testing in a cost-effective and scalable way. Neural rendering methods have gained popularity, as they can build simulation environments from collected logs in a data-driven manner. However, existing neural radiance field (NeRF) methods for sensor-realistic rendering of camera and lidar data suffer from low rendering speeds, limiting their applicability for large-scale testing. While 3D Gaussian Splatting (3DGS) enables real-time rendering, current methods are limited to camera data and are unable to render lidar data essential for autonomous driving. To address these limitations, we propose SplatAD, the first 3DGS-based method for realistic, real-time rendering of dynamic scenes for both camera and lidar data. SplatAD accurately models key sensor-specific phenomena such as rolling shutter effects, lidar intensity, and lidar ray dropouts, using purpose-built algorithms to optimize rendering efficiency. Evaluation across three autonomous driving datasets demonstrates that SplatAD achieves state-of-the-art rendering quality with up to +2 PSNR for NVS and +3 PSNR for reconstruction while increasing rendering speed over NeRF-based methods by an order of magnitude. Code to be released upon publication.


---

# Method

<figure class="figure__background">
  <img style="width: 100%; margin: 0 auto; mix-blend-mode: multiply;" src="methodoverview.png"/>
</figure>
