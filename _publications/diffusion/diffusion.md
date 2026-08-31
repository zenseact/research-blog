---
layout: publication
permalink: /publications/diffusion/
title: One Diffusion Model, Two Roles: Guided Trajectory Planning and Safety-Critical Scenario Generation in Closed-Loop Simulation
venue: ECCV26ARA
authors:
  - Pal
  - Kumar
  - Eriksson
  - Lacombe
  - Laveno
  - Gupta
  - Wozniak
arxiv: https://arxiv.org/abs/2609.04921
n_equal_contrib: 2 
date: 2026-07-20 00:00:00 +0000
thumbnail-video: videos/thumbnail.mp4
topics:
  - Planning & Decision-Making
  - Verification & Validation
---

# Abstract
Diffusion probabilistic models can capture the multi-modal, interaction-rich distribution of joint future trajectories in driving scenes. We show that a *single* pretrained diffusion traffic model can serve two complementary roles in the autonomous driving development loop: as an ego motion planner and as a controllable generator of safety-critical scenarios for stress-testing planners. On the planning side, we introduce a Single-Stream Dual-Stream (SSDS) diffusion-transformer decoder that fuses scene context via joint attention rather than late cross-attention, improving closed-loop performance on nuPlan. We further propose Decoupled Annealing Posterior Sampling with Energy (DAPSE), a training-free guidance scheme that injects arbitrary energy functions (e.g., target speed, collision avoidance) at the clean-sample level, avoiding the first-order approximation errors of diffusion posterior sampling while requiring no auxiliary networks. Beyond planning, we leverage the same diffusion model as a controllable scenario generator to create realistic long-tail driving interactions for closed-loop evaluation. Through inference-time guidance, selected agents are steered toward safety-critical behaviors, including aggressive cut-ins, lead-vehicle braking, and combined longitudinal-lateral interactions, while preserving realistic traffic behaviors. Evaluated in closed-loop nuPlan simulations with independent black-box planners, the generated scenarios expose failure modes that remain hidden under standard benchmarks. In particular, evaluated planners frequently rely on reactive braking responses rather than proactive evasive maneuvers when facing complex multi-agent interactions, revealing a limitation of current learned planners. Although SSDS-based planner achieves stronger nominal performance, it experiences larger degradation under these challenging scenarios, demonstrating that benchmark superiority does not necessarily translate to robustness. These results demonstrate that a single learned traffic prior can simultaneously improve motion planning and provide a realistic framework for systematic planner robustness evaluation.

# TL;DR
We propose robust diffusion planner and adversarial scenario generation to verify how planners behave in OOD dangerous situations.
