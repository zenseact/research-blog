---
layout: publication
permalink: /publications/robust-stuttering/
title: Robust stutter bisimulation for abstraction and controller synthesis with disturbance
venue: Automatica
authors:
  - Krook
  - Malik
  - Mohajerani
  - Fabian
doi: 10.1016/j.automatica.2023.111394
date: 2023-11-22 00:00:00 +0000
thumbnail-img: robust-stuttering-thumbnail.svg
---
This paper proposes a method to synthesise controllers for cyber-physical systems subjected to disturbances, such that the controlled system satisfies specifications given as linear temporal logic formulas. To solve this problem, a finite-state abstraction of the original system is first constructed, and then a controller is synthesised for the abstraction. Due to the disturbances and uncertainty in the environment, future states cannot be predicted exactly, and the abstraction must take this into account. For this purpose, the _robust stutter bisimulation_ relation is introduced, which preserves the existence of controllers for any given linear temporal logic formula that excludes the _next_ operator. States are related by the robust stutter bisimulation relation if the same target sets can be guaranteed to be reached or avoided under control of some controller, thus ensuring that disturbances have similar effect on paths that start in related states. It is shown that there exists a controller enforcing a linear temporal logic formula for the original system if and only if a controller exists for the abstracted system. The approach is illustrated by a robot navigation example.