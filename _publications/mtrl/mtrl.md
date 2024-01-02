---
layout: publication
permalink: /publications/mtrl/
title: "Reinforcement Learning in the Wild with Maximum Likelihood-based Model Transfer"
venue: AAMAS2024
authors:
  - Eriksson
  - Basu
  - Tram
  - Alibeigi
  - Dimitrakakis
date: 2023-02-18 00:00:00 +00:00
arxiv: https://arxiv.org/abs/2302.09273
n_equal_contrib: 1
---

# Abstract
In this paper, we study the problem of transferring the available Markov Decision Process (MDP) models to learn and plan efficiently in an unknown but similar MDP. We refer to it as \textit{Model Transfer Reinforcement Learning (MTRL)} problem. First, we formulate MTRL for discrete MDPs and Linear Quadratic Regulators (LQRs) with continuous state actions. Then, we propose a generic two-stage algorithm, MLEMTRL, to address the MTRL problem in discrete and continuous settings. In the first stage, MLEMTRL uses a \textit{constrained Maximum Likelihood Estimation (MLE)}-based approach to estimate the target MDP model using a set of known MDP models. In the second stage, using the estimated target MDP model, MLEMTRL deploys a model-based planning algorithm appropriate for the MDP class. Theoretically, we prove worst-case regret bounds for MLEMTRL both in realisable and non-realisable settings. We empirically demonstrate that MLEMTRL allows faster learning in new MDPs than learning from scratch and achieves near-optimal performance depending on the similarity of the available MDPs and the target MDP.
