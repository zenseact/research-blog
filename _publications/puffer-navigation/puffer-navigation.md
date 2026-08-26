---
layout: publication
permalink: /publications/puffer-navigation/ # This is the permalink to the blog post. It should be the same as the name of the folder.
title: A Rich Navigation-Interface for Hardware Accelerated Driving Simulators # This is the title of the paper
venue: ECCVARA # This is the venue of the paper. It must have a corresponding entry in `_data/venues.yml`.
authors:
  - Laveno
  - Brannlund
  - Batkovic
  - Mardh
n_equal_contrib: 1 # This can be used if you have several authors that contributed equally to the paper. In this case, the first n authors listed in the `authors` field will be marked as equal contributors.
date: 2026-07-20 00:00:00 +0000 # This is the date of the paper submission
thumbnail-img: goals.png  # This is the thumbnail image that will be shown on the blog post. Next to the title.
topics: # At least one research topic from `_data/research_topics.yml`. A paper can have multiple topics.
  - Planning & decision-making
---

# Abstract
Hardware-accelerated driving simulators typically formulate
agent goals as sparse Cartesian target positions. Although this formula-
tion is easy to extract from logged trajectories, it provides little guidance
on how a policy should reach its goal or how such goals should be sam-
pled at deployment time. Although this approach has recently gained
traction, we argue that it remains under-specified relative to how nav-
igation is utilized in real-world systems. To address this, we propose
a richer navigation interface for the open-source simulator PufferDrive.
Our method precomputes a dense navigation graph consisting of way-
points and legal map-node transitions for every goal. Since this compu-
tation is performed entirely offline, the results can be cached and queried
at runtime with negligible overhead; new routes can be queried efficiently
when the agent deviates from the original path. In addition, we compute
a lane traversal feasibility measure that indicates how long an agent can
remain in its current or adjacent lane while still reaching its goal. We use
this feasibility measure to define a failure criterion for adherence to nav-
igation. Training PPO policies using PufferDrive, we show performance
comparable to sparse goals without extra reward shaping or tuning.
