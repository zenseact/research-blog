---
layout: publication
permalink: /publications/voxel-mae/
title: "Voxel-MAE: Masked Autoencoder for Self-Supervised Pre-Training on Lidar Point Clouds"
venue: WACV23
authors:
  - Hess
  - Jaxing
  - EliasSvensson
  - Hagerman
  - Petersson
  - Svensson
n_equal_contrib: 1
code:
arxiv: https://arxiv.org/abs/2301.08965
usemathjax: true
---

# Abstract
Masked autoencoding has become a successful pretraining paradigm for Transformer models for text, images, and, recently, point clouds. Raw automotive datasets are suitable candidates for self-supervised pre-training as they generally are cheap to collect compared to annotations for tasks like 3D object detection (OD). However, the development of masked autoencoders for point clouds has focused solely on synthetic and indoor data. Consequently, existing methods have tailored their representations and models toward small and dense point clouds with homogeneous point densities. In this work, we study masked autoencoding for point clouds in an automotive setting, which are sparse and for which the point density can vary drastically among objects in the same scene. To this end, we propose Voxel-MAE, a simple masked autoencoding pre-training scheme designed for voxel representations. We pre-train the backbone of a Transformer-based 3D object detector to reconstruct masked voxels and to distinguish between empty and non-empty voxels. Our method improves the 3D OD performance by 1.75 mAP points and 1.05 NDS on the challenging nuScenes dataset. Further, we show that by pre-training with Voxel-MAE, we require only 40 of the annotated data to outperform a randomly initialized equivalent. Code is available [here](https://github.com/georghess/voxel-mae).