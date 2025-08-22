---
title: "Efficient Injury Risk Assessment for Automated Driving Systems Using Subset Simulation"
layout: publication
permalink: /publications/sus-severity/
date: 2025-09-09
venue: SAFECOMP25
authors:
  - Gyllenhammar
  - Asljung
  - Vakilzadeh
  - Campos
thumbnail-img: sus.png
arxiv: https://maggyl.github.io/publications/sus-severity/
---

# Abstract
Assessing safety and reliability of Automated Driving Systems (ADSs) is a crucial activity before deployment on public roads. However, determining the absence of risk is more than estimating the frequency of collisions, it also entails understanding the likelihood of collisions with different injury levels. In this paper we present a new method adapting a well-known approach for estimating probability of rare events; namely, Subset Simulation (SuS). Our adaptation leverages all generated samples and enables simultaneous estimation of the probability of multiple injury levels and not just the collision rate. A new composite metric, incorporating both the brake threat number as well as the collision velocity of an eventual collision, is used to guide SuS toward high injury risk scenarios. The usefulness of the proposed method is demonstrated through simulations on a degraded Automated Driving (AD) functionality – emulated in the form of an Adaptive Cruise Control (ACC) function with emergency braking capabilities and limited sensing horizon -- exposed to cut-in scenarios. For benchmark purposes, we consider a Monte-Carlo reference and the results show that the proposed method finds comparable injury probabilities with respect to the reference, but with more than three orders of magnitude fewer samples, therefore representing a very efficient alternative.  

# BibTeX
```bibtex
@inproceedings{ gyllenhammar2025sus,
  title         = {Efficient Injury Risk Assessment for Automated Driving Systems Using Subset Simulation},
  author        = {Gyllenhammar, Magnus and Åsljung, Daniel and Khorsand Vakilzadeh, Majid and Rodrigues de Campos, Gabriel},
  booktitle     = {Computer Safety, Reliability, and Security},
  year          = {2026},
  publisher     = {Springer Nature Switzerland},
  address       = {Cham},
  pages         = {82--96},
  isbn          = {978-3-032-01241-8},
  doi           = {10.1007/978-3-032-01241-8_6}
}
```
