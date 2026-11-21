const HONORS_CURRICULUM = [
  {
    id: "eng-hon-w1d1",
    subject: "Honors English Literature",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "W1D1: Dystopian Themes & Screen-Time Reality Check (Fahrenheit 451)",
    grading_scale: "100 pts (A: 90–100, B: 80–89, C: 70–79) — 30 pts Quick Check, 35 pts Screen-Time Audit, 35 pts Reflection",
    resource_url: [
      "yt:7aKItfLeso4",
      "yt:YMZcp0EQO2s",
      "pdf:https://" + "dn790000.ca.archive.org/" + "0/items/fahrenheit451_202004/" + "Fahrenheit%20451.pdf"
    ].join("\n"),
    description: "Spoiler alert: Ray Bradbury predicted giant wall-sized TVs, wireless earbuds ('Seashells'), and 10-second attention spans back in 1953—when most families barely owned a black-and-white TV.\n\n1. WATCH BOTH VIDEOS ABOVE (10 mins): Hear straight from Ray Bradbury and TED-Ed on why Fahrenheit 451 is less about firemen and more about people willingly trading books for nonstop screen noise.\n\n2. READ PART 1 — 'THE HEARTH AND THE SALAMANDER' (20 mins): Tap the Fahrenheit 451 PDF button above and read pages 1–15 (PDF pages 5–19). Notice how Guy Montag thinks he's happy until 17-year-old neighbor Clarisse asks one simple question.\n\n3. YOUR IPAD SCREEN-TIME AUDIT (15 mins): Open Settings > Screen Time for the past 7 days. Compare hours spent passively scrolling vs. creating or reading—and compare your earbuds/feeds to Bradbury's 'parlor walls'.\n\n4. LUNCH TABLE DEBATE: Ask your parent: (1) What does Clarisse notice that Montag stopped noticing? (2) Did Bradbury's 1953 prediction come true?\n\n5. FINAL MISSION (10 mins): Write a punchy 5–7 sentence reflection below connecting Bradbury's love of public libraries to what your Screen Time stats revealed.",
    answer_key: "• Video 1 (Ray Bradbury): Educated himself at the public library 3 nights/week; inspired at age 26 by Nazi book burnings & destruction of Library of Alexandria.\n• Video 2 (TED-Ed): Written in 1953; warns that public apathy, short attention spans, and addiction to mindless screen entertainment ('parlor walls' / Seashell radios) cause society to abandon independent thought.\n• Reading (pp. 1–15 / PDF pp. 5–19): Montag initially loves burning ('It was a pleasure to burn'). Clarisse notices dew, grass, the moon, and real conversation. Montag realizes his happiness is a mask.\n• Reflection Rubric: Must connect libraries/books to independent thought AND cite real numbers/insights from their Screen Time audit.",
    quiz: [
      { q: "1. Where did Ray Bradbury educate himself since he couldn't afford college?", options: ["At a boarding school in Europe", "At the public library 3 nights a week", "Through an online university"], answer: 1 },
      { q: "2. According to TED-Ed, what causes citizens in Fahrenheit 451 to lose independent thought?", options: ["Apathy and addiction to mindless screen entertainment", "A ban on all electricity", "Mandatory space travel"], answer: 0 },
      { q: "3. What does 17-year-old Clarisse McClellan notice that Guy Montag stopped noticing?", options: ["The cost of fire trucks", "Everyday nature (dew, grass, the moon) and real conversation", "How to repair a parlor wall"], answer: 1 }
    ]
  },
  {
    id: "alg1-hon-u1d1",
    subject: "Honors Algebra I",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "U1D1: Slope, Line Equations & Desmos Target Practice",
    grading_scale: "100 pts — 25 pts Quick Check, 50 pts 5 Mastery Challenges, 25 pts Slider Reflection",
    resource_url: [
      "https://" + "www.khanacademy.org/" + "math/algebra/x2f8bb11595b61c86:linear-equations-graphs/x2f8bb11595b61c86:slope/v/introduction-to-slope",
      "https://" + "://mathsisfun.com" + "equation_of_line.html",
      "https://" + "://desmos.com" + "calculator"
    ].join("\n"),
    description: "No heavy graphing calculator in your backpack? No problem—tap '📐 Backpack Math Tools' at the top of your dashboard or open Desmos above!\n\n1. WATCH & PLAY (15 mins): Watch Khan Academy's Introduction to Slope and drag the interactive slope slider inside Math is Fun (y = mx + b).\n\n2. LIVE LINE LAB (15 mins): Open Backpack Math Tools (or Desmos) and test positive slopes, negative slopes, and changing y-intercepts (b).\n\n3. MASTERY CHALLENGES 1–5 (Verify every answer on your live graph!):\n• Challenge 1 (Hiking Trail): A trail climbs from elevation (0, 400) ft to (6, 1900) ft over 6 miles. Find the slope (m) and explain what it means in plain English.\n• Challenge 2 (Build the Line): A line passes through (0, −3) and rises 4 units for every 1 unit right. Write its y = mx + b equation.\n• Challenge 3 (Watch the Negative!): Find the slope (m) between (2, 5) and (6, −3).\n• Challenge 4 (Custom Merch Math): A T-shirt printer charges a $25 setup fee plus $8 per shirt. Write the total cost equation (y) for x shirts, then find the cost for 15 shirts.\n• Challenge 5 (Target Practice): Plot (1, 2) and (4, 8) and write the y = mx + b equation that hits both dots.\n\n4. TURN IN: Submit Challenges 1–5 plus a 2-sentence explanation of how m and b move a line.",
    answer_key: "• Formulas: m = (y2 − y1) / (x2 − x1) | y = mx + b.\n• Challenge 1: m = (1900 − 400)/(6 − 0) = 250 (climbs 250 ft per mile).\n• Challenge 2: y = 4x − 3.\n• Challenge 3: m = (−3 − 5)/(6 − 2) = −8/4 = −2.\n• Challenge 4: y = 8x + 25; 15 shirts = 8(15) + 25 = $145.\n• Challenge 5: m = (8 − 2)/(4 − 1) = 2, b = 0 → y = 2x.\n• Reflection: Positive m goes uphill left-to-right, negative m goes downhill; changing b shifts the entire line straight up or down.",
    quiz: [
      { q: "1. In y = mx + b, what does 'b' control on the graph?", options: ["The steepness of the line", "Where the line crosses the vertical y-axis (x = 0)", "The horizontal x-axis"], answer: 1 },
      { q: "2. When the slope (m) is negative, which way does the line slant?", options: ["Downhill from left to right", "Uphill from left to right", "Completely flat"], answer: 0 },
      { q: "3. A shop charges a $25 setup fee plus $8 per shirt. Which equation gives total cost (y)?", options: ["y = 25x + 8", "y = 8x + 25", "y = 33x"], answer: 1 }
    ]
  },
  {
    id: "bio-hon-u1l1",
    subject: "Honors Biology",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "U1L1: Nature of Science & Kitchen Yeast Metabolism Lab",
    grading_scale: "100 pts — 25 pts Quick Check, 35 pts Review Questions, 40 pts Kitchen Yeast Lab & CER",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Amoeba+Sisters+Nature+of+Science",
      "https://" + "phet.colorado.edu/"
    ].join("\n"),
    description: "In 1928, Alexander Fleming forgot to clean a moldy petri dish before vacation—and accidentally discovered penicillin. Today you're turning your kitchen counter into a biology lab!\n\n1. WATCH & REVIEW (15 mins): Watch Amoeba Sisters 'Nature of Science' above. Review Qualitative (words) vs. Quantitative (numbers) data, Independent Variable (IV = what you change), Dependent Variable (DV = what you measure), Control Group, and Constants.\n\n2. QUICK CONCEPT CHECK:\n• Q1: Label as Qualitative (QL) or Quantitative (QN): (a) 'The colony grew to 14.5 mm in 24 hours.' (b) 'The broth turned cloudy and smelled sour.'\n• Q2 (Spot the Flaw): Plant A sits in a sunny window with Mozart playing; Plant B sits in a dark closet with no music. Name TWO experimental flaws and how to fix them.\n• Q3: Write an 'If... then... because...' hypothesis on how water temperature affects a goldfish's heart rate.\n\n3. KITCHEN LAB — WAKING UP DORMANT YEAST (30 mins):\n• Grab: 3 clear cups, 1 packet dry baker's yeast, white sugar, bathwater-warm tap water (~105°F — NOT boiling!), ruler.\n• Setup: Pour ½ cup (120 mL) warm water into each cup. Add 0 tsp sugar to Cup 1 (Control), ½ tsp sugar to Cup 2, and 2 tsp sugar to Cup 3. Stir, add ¾ tsp dry yeast to each, stir 10 seconds, and watch!\n• Measure: Record CO2 foam height (mm) at 0, 10, and 20 minutes.\n• Post-Lab: Identify IV, DV, 3 Constants, why Cup 1 was required, and write a 3-sentence CER (Claim, Evidence, Reasoning) conclusion.",
    answer_key: "• Q1: (a) Quantitative (14.5 mm, 24 hrs); (b) Qualitative (cloudy, sour smell).\n• Q2 Flaws: (1) Two variables changed at once (sunlight + music); (2) Sample size of 1 plant per group. Fix: Identical grow lights + 10–20 plants per group.\n• Q3: 'If water temp increases from 15°C to 25°C, then goldfish heart rate will increase because cold-blooded ectotherms rely on external heat to speed cellular metabolism.'\n• Lab Results: Cup 1 = 0–3 mm; Cup 2 = 10–25 mm; Cup 3 = 25–45+ mm. IV = sugar amount; DV = foam height (mm); Constants = water temp, water volume, yeast amount, cup size. Sugar fuels cellular respiration & CO2 release.",
    quiz: [
      { q: "1. Which observation is QUANTITATIVE?", options: ["The yeast smelled like fresh bread", "The CO2 foam reached 34 mm after 20 minutes", "The water looked cloudy"], answer: 1 },
      { q: "2. In the Yeast Lab, what is the Independent Variable (IV)?", options: ["Amount of sugar added to each cup", "Height of the foam in millimeters", "Warm water temperature (105°F)"], answer: 0 },
      { q: "3. Why do we include Cup 1 (0 tsp sugar)?", options: ["It acts as the Control Group proving sugar—not warm water alone—creates CO2 foam", "It sterilizes the cup", "It speeds up fermentation"], answer: 0 }
    ]
  },
  {
    id: "whist-hon-c1l1",
    subject: "Honors World History",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "C1.1: Royal Judge Roleplay & Hammurabi's Code (1750 BCE)",
    grading_scale: "100 pts — 25 pts Quick Check, 25 pts Courtroom Ruling, 50 pts Document Analysis",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Crash+Course+World+History+Mesopotamia",
      "https://" + "collections.louvre.fr/" + "en/ark:/53355/cl010174436"
    ].join("\n"),
