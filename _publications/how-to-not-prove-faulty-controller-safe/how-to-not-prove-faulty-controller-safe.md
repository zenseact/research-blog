---
layout: publication
permalink: /publications/how-to-not-prove-faulty-controller-safe/
title: On how to not prove faulty controllers safe in differential dynamic logic
venue: ICFEM22
authors:
  - Selvaraj
  - Krook
  - Ahrendt
  - Fabian
doi: 10.1007/978-3-031-17244-1_17
date: 2022-10-10 00:00:00 +0000f
topics:
  - Theory & Foundations
---
Cyber-physical systems are often safety-critical and their correctness is crucial, as in the case of automated driving. Using formal mathematical methods is one way to guarantee correctness. Though these methods have shown their usefulness, care must be taken as modeling errors might result in proving a faulty controller safe, which is potentially catastrophic in practice. This paper deals with two such modeling errors in differential dynamic logic. Differential dynamic logic is a formal specification and verification language for hybrid systems, which are mathematical models of cyber-physical systems. The main contribution is to prove conditions that when fulfilled, these two modeling errors cannot cause a faulty controller to be proven safe. The problems are illustrated with a real world example of a safety controller for automated driving, and it is shown that the formulated conditions have the intended effect both for a faulty and a correct controller. It is also shown how the formulated conditions aid in finding a loop invariant candidate to prove properties of hybrid systems with feedback loops. The results are proven using the interactive theorem prover KeYmaera X.
