---
layout: publication
permalink: /publications/proving-unsafe-controller-not-proven-safe/
title: On proving that an unsafe controller is not proven safe
venue: JLAMP
authors:
  - Selvaraj
  - Krook
  - Ahrendt
  - Fabian
doi: 10.1016/j.jlamp.2023.100939
date: 2024-01-09 00:00:00 +0000f
topics:
  - Theory & Foundations
---
Cyber-physical systems are often safety-critical and their correctness is crucial, such as in the case of automated driving. Using formal mathematical methods is one way to guarantee correctness and improve safety. Although these methods have shown their usefulness, care must be taken because modelling errors might result in proving a faulty controller safe, which is potentially catastrophic in practice. This paper deals with two such modelling errors in _differential dynamic logic_, a formal specification and verification language for _hybrid systems_, which are mathematical models of cyber-physical systems. The main contributions are to provide conditions under which these two modelling errors cannot cause a faulty controller to be proven safe, and to show how these conditions can be proven with help of the interactive theorem prover KeYmaera X. The problems are illustrated with a real world example of a safety controller for automated driving, and it is shown that the formulated conditions have the intended effect both for a faulty and a correct controller. It is also shown how the formulated conditions aid in finding a _loop invariant_ candidate to prove properties of hybrid systems with feedback loops. Furthermore, the relation between such a loop invariant and the characterisation of the _maximal control invariant set_ is discussed.
