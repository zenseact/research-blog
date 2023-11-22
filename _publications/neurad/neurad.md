---
layout: publication
permalink: /publications/neuRAD/
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
arxiv: null
n_equal_contrib: 3
---

# Abstract
Neural radiance fields (NeRFs) have gained popularity in the autonomous driving (AD) community. Recent methods show NeRFs' potential for closed-loop simulation, enabling testing of AD systems, and as an advanced training data augmentation technique. However, existing methods often require long training times, dense semantic supervision, or lack generalizability. This, in turn, hinders the application of NeRFs for AD at scale. In this paper, we propose NeuRAD, a robust novel view synthesis method tailored to dynamic AD data. Our method features simple network design, extensive sensor modeling for both camera and lidar --- including rolling shutter, beam divergence and ray dropping --- and is applicable to multiple datasets out of the box. We verify its performance on five popular AD datasets, achieving state-of-the-art performance across the board. To encourage further development, we openly release the NeuRAD source code.