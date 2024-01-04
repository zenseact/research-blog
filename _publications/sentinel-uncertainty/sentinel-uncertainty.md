---
permalink: /publications/sentinel-uncertainty/
title: SENTINEL Taming Uncertainty with Ensemble based Distributional Reinforcement Learning
venue: UAI22
authors:
  - Eriksson
  - Basu
  - Alibeigi
  - Dimitrakakis
arxiv: https://arxiv.org/abs/2102.11075
n_equal_contrib: 1
date: 2021-02-22 00:00:00 +0000
---

# Abstract
In this paper, we consider risk-sensitive sequential decision-making in Reinforcement Learning (RL). Our contributions are two-fold. First, we introduce a novel and coherent quantification of risk, namely composite risk, which quantifies the joint effect of aleatory and epistemic risk during the learning process. Existing works considered either aleatory or epistemic risk individually, or as an additive combination. We prove that the additive formulation is a particular case of the composite risk when the epistemic risk measure is replaced with expectation. Thus, the composite risk is more sensitive to both aleatory and epistemic uncertainty than the individual and additive formulations. We also propose an algorithm, SENTINEL-K, based on ensemble bootstrapping and distributional RL for representing epistemic and aleatory uncertainty respectively. The ensemble of K learners uses Follow The Regularised Leader (FTRL) to aggregate the return distributions and obtain the composite risk. We experimentally verify that SENTINEL-K estimates the return distribution better, and while used with composite risk estimates, demonstrates higher risk-sensitive performance than state-of-the-art risk-sensitive and distributional RL algorithms.

# BibTeX
```bibtex
@inproceedings{eriksson2022sentinel,
  title={Sentinel: taming uncertainty with ensemble based distributional reinforcement learning},
  author={Eriksson, Hannes and Basu, Debabrota and Alibeigi, Mina and Dimitrakakis, Christos},
  booktitle={Uncertainty in Artificial Intelligence},
  pages={631--640},
  year={2022},
  organization={PMLR}
}
```
