---
layout: publication
permalink: /publications/modelling-and-synthesis-of-lane-change-function/
title: Modeling and Synthesis of the Lane Change Function of an Autonomous Vehicle
venue: WODES18
authors:
  - Krook
  - Zita
  - Kianfar
  - Mohajerani
  - Fabian
doi: 10.1016/j.ifacol.2018.06.291
date: 2018-05-30 00:00:00 +0000
topics:
  - Planning & decision-making
  - Verification & validation
  - Theory & foundations
---
Unexpected incorrect behavior of autonomous vehicles can have catastrophic outcomes. But, as with any large-scale software development, correctness of the system is not easily guaranteed. As the system is made up of multiple sub-modules that interact with each other, unexpected behavior can arise from incorrect interactions between the modules. In a previous paper, formal verification was applied to the lane change module of the decision and control software (under development) for an autonomous vehicle. This revealed incorrectness in the model, which could also be shown to exist in the actual software. Manual changes to the model did not result in absence of the incorrectness, and so in this paper we aim to patch the error by applying synthesis. The synthesized result is correct by construction, but it is not obvious what part of the functionality is disabled by the synthesis. Though different synthesis techniques were able to generate supervisors for the model, only when the supervisor was expressed as guard conditions on the events was it possible to interpret the effect of the synthesis. However, the supervisors put constraints on how the input data to the lane change module might change, so in the end the supervisors put behavioral requirements on the modules that generate the input to the lane change module.
