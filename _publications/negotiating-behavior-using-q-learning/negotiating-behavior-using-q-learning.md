---
layout: publication
permalink: /publications/negotiating-behavior-using-q-learning/
title: "Learning Negotiating Behavior Between Cars in Intersections using Deep Q-Learning"
venue: ITSC18
authors:
  - Tram
  - Jansson
  - Gronberg
  - Ali
  - Sjoberg
date: 2018-11-04 00:00:00 +00:00
arxiv: https://ieeexplore.ieee.org/abstract/document/8569316
n_equal_contrib: 1
---

# Abstract
This paper concerns automated vehicles negotiating with other vehicles, typically human driven, in crossings with the goal to find a decision algorithm by learning typical behaviors of other vehicles. The vehicle observes distance and speed of vehicles on the intersecting road and use a policy that adapts its speed along its pre-defined trajectory to pass the crossing efficiently. Deep Q-learning is used on simulated traffic with different predefined driver behaviors and intentions. The results show a policy that is able to cross the intersection avoiding collision with other vehicles 98% of the time, while at the same time not being too passive. Moreover, inferring information over time is important to distinguish between different intentions and is shown by comparing the collision rate between a Deep Recurrent Q-Network at 0.85% and a Deep Q-learning at 1.75%.