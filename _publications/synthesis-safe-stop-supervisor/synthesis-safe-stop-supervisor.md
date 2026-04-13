---
layout: publication
permalink: /publications/synthesis-safe-stop-supervisor/
title: Formal Synthesis of Safe Stop Tactical Planners for an Automated Vehicle
venue: WODES20
authors:
  - Krook
  - Kianfar
  - Fabian
doi: 10.1016/j.ifacol.2021.04.059
date: 2020-11-11 00:00:00 +0000
topics:
  - Planning & decision-making
  - Verification & validation
  - Theory & foundations
---
Automated vehicles need a safe back-up solution in the presence of system degradations since a driver cannot be expected to take control on short notice. In the event of a degradation, the vehicle is required to reach a minimal risk condition via a minimal risk maneuver. The activation of such maneuvers is safety critical, and a correct implementation of the tactical planner that takes the activation decision is paramount. One way to ensure correctness is to employ formal methods since they can provide proofs thereof. Earlier, a tactical planner was formally verified to activate a minimal risk maneuver if and only if a failure occurs. Formal verification has some drawbacks, so this paper investigates the applicability of using the tools Supremica and TuLiP to synthesize correct-by-construction tactical planners. These two tools amend some of the verification’s drawbacks, but also introduce their own.
