---
layout: publication
permalink: /publications/towards-accurate-ego-lane/
title: "Towards Accurate Ego-lane Identification with Early Time Series Classification"
venue: ARXIV
authors:
  - Yuchuan
  - Theodor
  - David
  - Axel
  - Yuxuan
  - Fu
arxiv: https://arxiv.org/abs/2405.17270
date: 2024-05-27 00:00:00 +0000
---

# Abstract
Accurate and timely determination of a vehicle's current lane within a map is a critical task in autonomous driving systems. This paper utilizes an Early Time Series Classification (ETSC) method to achieve precise and rapid ego-lane identification in real-world driving data. The method begins by assessing the similarities between map and lane markings perceived by the vehicle's camera using measurement model quality metrics. These metrics are then fed into a selected ETSC method, comprising a probabilistic classifier and a tailored trigger function, optimized via multi-objective optimization to strike a balance between early prediction and accuracy. Our solution has been evaluated on a comprehensive dataset consisting of 114 hours of real-world traffic data, collected across 5 different countries by our test vehicles. Results show that by leveraging road lane-marking geometry and lane-marking type derived solely from a camera, our solution achieves an impressive accuracy of 99.6%, with an average prediction time of only 0.84 seconds.

# BibTeX
```bibtex
@misc{jin2024accurate,
      title={Towards Accurate Ego-lane Identification with Early Time Series Classification}, 
      author={Yuchuan Jin and Theodor Stenhammar and David Bejmer and Axel Beauvisage and Yuxuan Xia and Junsheng Fu},
      year={2024},
      eprint={2405.17270},
      archivePrefix={arXiv},
      primaryClass={eess.SP}
}
```