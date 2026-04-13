---
layout: publication
permalink: /publications/safe-stop-supervisor/
title: Design and Formal Verification of a Safe Stop Supervisor for an Automated Vehicle
venue: ICRA19
authors:
  - Krook
  - LarsSvensson
  - Yuchao
  - LeiFeng
  - Fabian
doi: 10.1109/ICRA.2019.8793636
date: 2019-05-20 00:00:00 +0000
topics:
  - Verification & validation
  - Safety
---
Autonomous vehicles apply pertinent planning and control algorithms under different driving conditions. The mode switch between these algorithms should also be autonomous. On top of the nominal planners, a safe fallback routine is needed to stop the vehicle at a safe position if nominal operational conditions are violated, such as for a system failure. This paper describes the design and formal verification of a supervisor to manage all requirements for mode switching between nominal planners, and additional requirements for switching to a safe stop trajectory planner that acts as the fallback routine. The supervisor is designed via a model-based approach and its abstraction is formally verified by model checking. The supervisor is implemented and integrated with the Research Concept Vehicle, an experimental research and demonstration vehicle developed at the KTH Royal Institute of Technology. Simulations and experiments show that the vehicle is able to autonomously drive in a safe manner between two parking lots and can successfully come to a safe stop upon GPS sensor failure.
