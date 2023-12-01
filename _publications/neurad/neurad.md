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

# Abstract
Neural radiance fields (NeRFs) have gained popularity in the autonomous driving (AD) community. Recent methods show NeRFs' potential for closed-loop simulation, enabling testing of AD systems, and as an advanced training data augmentation technique. However, existing methods often require long training times, dense semantic supervision, or lack generalizability. This, in turn, hinders the application of NeRFs for AD at scale. In this paper, we propose NeuRAD, a robust novel view synthesis method tailored to dynamic AD data. Our method features simple network design, extensive sensor modeling for both camera and lidar --- including rolling shutter, beam divergence and ray dropping --- and is applicable to multiple datasets out of the box. We verify its performance on five popular AD datasets, achieving state-of-the-art performance across the board. To encourage further development, we openly release the NeuRAD source code.


# Video
<div style="display: flex; align-items: center; justify-content: center;">
  <video controls autoplay loop muted playsinline style="width: 600px;">
    <source src="suppvideo.webm" type="video/webm">
  </video>
</div>

# Modeling rolling shutter
<div style="display: flex; justify-content: center;">
{% include two_image_slider.html 
  left_image="norolling_rgb.jpg"
  right_image="withrolling_rgb.jpg"
  width="25"
  height="20"
  id="1"
  caption="Rendering without and with modeling of rolling shutter" 
%}
{% include two_image_slider.html
  left_image="norolling_depth.jpg"
  right_image="withrolling_depth.jpg"
  width="25"
  height="20"
  id="2"
  caption="Depth map without and with modeling of rolling shutter"
%}
</div>

# Using sensor embeddings
<div style="display: flex; justify-content: center;">
{% include two_image_slider.html
  left_image="without_appemb.jpg"
  right_image="with_appemb.jpg"
  width="50"
  height="30"
  id="3"
  caption="Rendering without and with sensor embedding"
%}
</div>