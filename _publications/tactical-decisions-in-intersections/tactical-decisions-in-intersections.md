---
layout: publication
permalink: /publications/tactical-decisions-in-intersections/
title: "Reinforcement Learning with Uncertainty Estimation for Tactical Decision-Making in Intersections"
venue: ITSC20
authors:
  - Hoel
  - Tram
  - Sjoberg
date: 2020-09-20 00:00:00 +00:00
arxiv: https://ieeexplore.ieee.org/abstract/document/9294407
n_equal_contrib: 1
---

# Abstract
This paper investigates how a Bayesian reinforcement learning method can be used to create a tactical decision-making agent for autonomous driving in an intersection scenario, where the agent can estimate the confidence of its decisions. An ensemble of neural networks, with additional randomized prior functions (RPF), are trained by using a bootstrapped experience replay memory. The coefficient of variation in the estimated Q-values of the ensemble members is used to approximate the uncertainty, and a criterion that determines if the agent is sufficiently confident to make a particular decision is introduced. The performance of the ensemble RPF method is evaluated in an intersection scenario and compared to a standard Deep Q-Network method, which does not estimate the uncertainty. It is shown that the trained ensemble RPF agent can detect cases with high uncertainty, both in situations that are far from the training distribution, and in situations that seldom occur within the training distribution. This work demonstrates one possible application of such a confidence estimate, by using this information to choose safe actions in unknown situations, which removes all collisions from within the training distribution, and most collisions outside of the distribution.