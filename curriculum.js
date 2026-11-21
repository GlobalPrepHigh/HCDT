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
        description: "Put on your Mesopotamian judicial robes—today you are presiding over the Royal Court of Babylon in 1750 BCE!\n\n1. ARTIFACT & VIDEO (15 mins): Inspect the actual 7-foot black stone stele of Hammurabi in the Louvre link above and watch Crash Course World History: Mesopotamia.\n\n2. COURTROOM ROLEPLAY — RULE ON TWO CASES:\n• Law 196: If a man put out the eye of another man (a noble), his eye shall be put out.\n• Law 198: If he put out the eye of a freed commoner, he shall pay one gold mina.\n• Law 229: If a builder build a house improperly and it collapses and kills the owner, that builder shall be put to death.\n• YOUR DOCKET: Case A: A wealthy noble injures the eye of a freed artisan. Case B: A negligent builder's roof collapses and kills a homeowner. Hand down your exact sentences under Hammurabi's Code!\n\n3. HISTORICAL DETECTIVE QUESTIONS (HIPP Analysis):\n• Q1: Compare Laws 196 and 198. What do they prove about equality in ancient Babylon?\n• Q2: Why did Babylon punish negligent builders so harshly in Law 229?\n• Q3: Hammurabi claimed his laws existed 'so that the strong should not harm the weak.' Did his actual laws live up to that slogan?",
    answer_key: "• Courtroom Rulings: Case A (Law 198) = Noble pays 1 gold mina fine (does NOT lose his eye because victim is a commoner); Case B (Law 229) = Builder is put to death.\n• Q1: Justice was strictly class-based ('eye for an eye' applied only between equal nobles).\n• Q2: Without modern building codes, inspections, or insurance, harsh deterrents enforced public safety.\n• Q3: Nuanced—public written laws prevented nobles from harming commoners with zero penalty, yet still protected elites from physical punishment.",
    quiz: [
      { q: "1. What does 'P' for Purpose in HIPP historical analysis ask?", options: ["Why the author created the document and what they wanted it to achieve", "The population of the city", "Which museum owns the artifact"], answer: 0 },
      { q: "2. Under Law 198, what penalty did a noble face for injuring a freed commoner's eye?", options: ["Losing his own eye", "Paying a fine of one gold mina", "Exile from Babylon"], answer: 1 },
      { q: "3. Hammurabi's original 1750 BCE carved stone stele is what type of source?", options: ["Primary Source", "Secondary Source", "Modern textbook"], answer: 0 }
    ]
  },
  {
    id: "lang-mandarin-101",
    subject: "Honors Mandarin Chinese I",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "W1D1: The 4 Tones, Pinyin & Traveler Survival Greetings",
    grading_scale: "100 pts — 30 pts Quick Check, 40 pts Audio/Tone Practice, 30 pts Café Roleplay",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Yoyo+Chinese+4+Tones+Pinyin",
      "https://" + "://pleco.com"
    ].join("\n"),
    description: "Mandarin is spoken by over 1.1 billion people—and here's the fun catch: the syllable 'ma' means 'mom' in a high flat tone, or 'horse' in a dipping tone. Master the 4 tones today so you never accidentally call someone a horse!\n\n1. TONE & PINYIN WORKSHOP (15 mins): Watch Yoyo Chinese's 4 Tones lesson above and practice gliding your voice through Tone 1 (flat ā), Tone 2 (rising á), Tone 3 (dipping ǎ), and Tone 4 (sharp falling à).\n\n2. TRAVELER SURVIVAL PHRASES:\n• Nǐ hǎo (你好) = Hello\n• Xièxie (谢谢) = Thank you\n• Bù kèqi (不客气) = You're welcome\n• Duōshao qián? (多少钱?) = How much does this cost?\n• Wǒ yào zhège (我要这个) = I would like this one\n\n3. MISSION: Record a 20-second voice note (or perform live for your parent) introducing yourself with 'Nǐ hǎo' and bargaining for a street-food snack using 'Duōshao qián?'",
    answer_key: "• Tone Check: Tone 1 = high level (mā = mother); Tone 2 = rising like 'huh?' (má = hemp); Tone 3 = low dip-and-rise (mǎ = horse); Tone 4 = sharp downward command (mà = scold).\n• Oral Rubric: Clear distinction between rising/falling tones on Nǐ hǎo and Xièxie.",
    quiz: [
      { q: "1. Why are tones essential in Mandarin Chinese?", options: ["Changing pitch changes the actual meaning of a word", "Tones are only used in songs", "Tones indicate past vs. future tense"], answer: 0 },
      { q: "2. Which phrase asks 'How much does this cost?' at a market?", options: ["Xièxie", "Duōshao qián?", "Bù kèqi"], answer: 1 },
      { q: "3. What does 'Nǐ hǎo' mean?", options: ["Goodbye", "Hello", "Excuse me"], answer: 1 }
    ]
  },
  {
    id: "lang-hindi-101",
    subject: "Honors Hindi I",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "W1D1: Devanagari Script Basics & Everyday Conversation",
    grading_scale: "100 pts — 30 pts Quick Check, 40 pts Script & Pronunciation, 30 pts Dialogue",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Learn+Hindi+Basics+Greetings+Pronunciation",
      "https://" + "://omniglot.com" + "writing/hindi.htm"
    ].join("\n"),
    description: "Spoken by over 600 million people, Hindi is phonetic—meaning once you learn the Devanagari alphabet (notice that cool horizontal line connecting letters across the top!), every word is pronounced exactly as spelled.\n\n1. SCRIPT & SOUNDS (15 mins): Explore the Omniglot Devanagari guide and Hindi greeting video above.\n\n2. TRAVELER ESSENTIALS:\n• Namaste (नमस्ते) = Hello / Respectful greeting\n• Dhanyavaad (धन्यवाद) / Shukriya = Thank you\n• Aap kaise hain? (आप कैसे हैं?) = How are you?\n• Mera naam ___ hai (मेरा नाम ___ है) = My name is ___\n• Kitne paise? (कितने पैसे?) = How much money?\n\n3. MISSION: Write 'Namaste' in Devanagari script on paper, practice a 4-line introduction with your parent, and submit your written reflection below.",
    answer_key: "• Script Check: Devanagari is written left-to-right with a signature top horizontal bar (shirorekha).\n• Dialogue Check: Student accurately pairs Namaste + Mera naam + Aap kaise hain?",
    quiz: [
      { q: "1. What visual feature connects letters at the top of Hindi Devanagari words?", options: ["A horizontal top line (shirorekha)", "Dots underneath every letter", "Right-to-left cursive loops"], answer: 0 },
      { q: "2. How do you say 'My name is...' in Hindi?", options: ["Dhanyavaad", "Mera naam ___ hai", "Kitne paise"], answer: 1 },
      { q: "3. Which word means 'Thank you' in Hindi?", options: ["Namaste", "Dhanyavaad", "Kaise"], answer: 1 }
    ]
  },
  {
    id: "lang-spanish-101",
    subject: "Honors Spanish I",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "W1D1: Spanish Pronunciation, Ser vs. Estar & Café Ordering",
    grading_scale: "100 pts — 30 pts Quick Check, 40 pts Menu Ordering Challenge, 30 pts Grammar Check",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Butterfly+Spanish+Greetings+Basics",
      "https://" + "://spanishdict.com"
    ].join("\n"),
    description: "With 500+ million native speakers across 20+ countries, Spanish is the ultimate passport booster—and because its 5 vowels (A-E-I-O-U) never change sound, you can already read almost any Spanish menu out loud!\n\n1. VOWELS & GREETINGS (15 mins): Watch Butterfly Spanish's beginner lesson above.\n\n2. TRAVELER TOOLKIT:\n• Hola, buenos días = Hello, good morning\n• Quisiera pedir... = I would like to order...\n• ¿Dónde está la estación? = Where is the station?\n• La cuenta, por favor = The check, please\n• Soy de... (permanent origin) vs. Estoy en... (current travel location!)\n\n3. MISSION: Write a 5-line café order in Spanish including a greeting, two food/drink items, where you are traveling ('Estoy en...'), and asking for the check.",
    answer_key: "• Grammar Key: 'Soy' (from ser) = permanent identity/origin ('Soy de Estados Unidos'); 'Estoy' (from estar) = temporary location/state ('Estoy en Tailandia / México').\n• Café Dialogue: Must include greeting, 'Quisiera...', 'Estoy en...', and 'La cuenta, por favor.'",
    quiz: [
      { q: "1. Which verb do you use to say where you are currently traveling ('I am in Spain')?", options: ["Soy en España", "Estoy en España", "Tengo en España"], answer: 1 },
      { q: "2. How do you politely ask for the bill at a restaurant?", options: ["¿Dónde está el baño?", "La cuenta, por favor", "Mucho gusto"], answer: 1 },
      { q: "3. Why is Spanish spelling so consistent to pronounce?", options: ["Its 5 vowels (A, E, I, O, U) always make the exact same pure sound", "Every word has silent letters", "It uses no accent marks"], answer: 0 }
    ]
  },
  {
    id: "lang-french-101",
    subject: "Honors French I",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "W1D1: French Politeness Rules, Nasal Sounds & Boulangerie Roleplay",
    grading_scale: "100 pts — 30 pts Quick Check, 40 pts Bakery Dialogue, 30 pts Cultural Etiquette",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Learn+French+with+Alexa+Greetings+Basics",
      "https://" + "://wordreference.com" + "fren/"
    ].join("\n"),
    description: "Golden rule of French travel: NEVER ask a question in France without saying 'Bonjour' first—it's the magic key that turns grumpy service into warm hospitality across 5 continents!\n\n1. SOUNDS & ETIQUETTE (15 mins): Watch Learn French with Alexa's greetings video above.\n\n2. BOULANGERIE SURVIVAL KIT:\n• Bonjour, Madame / Monsieur = Hello, Ma'am / Sir\n• Je voudrais un croissant, s'il vous plaît = I would like a croissant, please\n• C'est combien? = How much is it?\n• Merci beaucoup, bonne journée! = Thank you very much, have a nice day!\n\n3. MISSION: Write a polite 5-line bakery conversation starting with 'Bonjour', ordering two items with 'Je voudrais...', asking the price, and saying goodbye.",
    answer_key: "• Cultural Rule: Always open with 'Bonjour' before making any request.\n• Dialogue Rubric: Includes Bonjour, Je voudrais + item + s'il vous plaît, C'est combien, and Merci / Bonne journée.",
    quiz: [      { q: "1. What is the #1 rule of etiquette before asking anyone a question in France?", options: ["Say 'Bonjour' first", "Speak as fast as possible", "Skip greetings to save time"], answer: 0 },
      { q: "2. How do you politely say 'I would like...' in French?", options: ["Où est...", "Je voudrais...", "C'est combien..."], answer: 1 },
      { q: "3. What does 'Bonne journée' mean when leaving a shop?", options: ["How much?", "Have a nice day", "Excuse me"], answer: 1 }
    ]
  }
];


    HONORS_CURRICULUM.push(
  {
    id: "elec-finlit-101",
    subject: "Personal Financial Literacy",
    course_level: "Honors",
    quarter: "Q1",
    credits: 0.5,
    title: "W1D1: Compound Interest Superpower & Traveler Budget Challenge",
    grading_scale: "100 pts — 30 pts Quick Check, 40 pts Compound Growth Calculation, 30 pts 50/30/20 Budget",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Two+Cents+PBS+Compound+Interest",
      "https://" + "www.investor.gov/" + "financial-tools-calculators/calculators/compound-interest-calculator"
    ].join("\n"),
    description: "Albert Einstein supposedly called compound interest the eighth wonder of the world—because starting at age 15 instead of 35 can literally double your wealth with half the money!\n\n1. WATCH & CALCULATE (15 mins): Watch PBS Two Cents on Compound Interest and open the Investor.gov calculator above.\n\n2. THE TEEN INVESTOR EXPERIMENT: Compare Teen A (invests $100/month from age 16 to 26, then stops forever—total $12,000 put in) vs. Adult B (starts at age 26 and invests $100/month for 39 years until age 65—total $46,800 put in) at 8% annual return. Who ends up with more at age 65?\n\n3. MISSION: Design a monthly 50/30/20 budget (50% Needs, 30% Wants, 20% Savings/Investing) for a teen earning $400/month from remote freelance work.",
    answer_key: "• Compound Experiment: Teen A ($12,000 invested over 10 yrs) grows to ~$378,000 by age 65; Adult B ($46,800 invested over 39 yrs) grows to ~$310,000—Teen A wins by ~$68,000 despite investing $34,800 LESS because of 10 extra years of compounding!\n• 50/30/20 Budget on $400: $200 Needs, $120 Wants, $80 Savings/Investments.",
    quiz: [
      { q: "1. What makes compound interest different from simple interest?", options: ["You earn interest on both your original money AND past interest", "The bank charges double fees", "It only works for 1 year"], answer: 0 },
      { q: "2. In the 50/30/20 budgeting rule, what does the 20% go toward?", options: ["Video games and dining out", "Savings and investments", "Monthly rent"], answer: 1 },
      { q: "3. What is the single biggest advantage a 15-year-old investor has over a 35-year-old?", options: ["Higher starting salary", "Time (more decades for compounding to multiply)", "Zero taxes forever"], answer: 1 }
    ]
  },
  {
    id: "elec-econ-101",
    subject: "Honors Economics",
    course_level: "Honors",
    quarter: "Q1",
    credits: 0.5,
    title: "W1D1: Scarcity, Opportunity Cost & Global Currency Exchange",
    grading_scale: "100 pts — 30 pts Quick Check, 40 pts Opportunity Cost Analysis, 30 pts Currency Lab",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Crash+Course+Economics+1+Intro+to+Economics",
      "https://" + "://xe.com" + "currencyconverter/"
    ].join("\n"),
    description: "Every choice has a hidden price tag—even 'free' activities cost the next-best thing you gave up to do them. Economists call that Opportunity Cost!\n\n1. WATCH (12 mins): Watch Crash Course Economics #1 above.\n\n2. WORLDSCHOOLER CURRENCY LAB: Open XE Currency Converter above. Convert $50 USD into Thai Baht (THB), Euros (EUR), and Japanese Yen (JPY). If a street meal costs 120 THB, how many meals does $50 buy?\n\n3. MISSION: Identify a major decision you made this month (time or money) and write out its explicit cost, its Opportunity Cost (next-best alternative forgone), and why your choice was rational.",
    answer_key: "• Currency Lab: ~$50 USD ≈ 1,700–1,800 THB (varies daily); at 120 THB/meal, $50 buys ~14–15 meals.\n• Opportunity Cost Rubric: Must clearly name the NEXT-BEST alternative given up (not just 'everything else').",
    quiz: [
      { q: "1. What is 'Opportunity Cost' in economics?", options: ["The total sticker price in dollars", "The value of the next-best alternative you give up when making a choice", "Sales tax on imported goods"], answer: 1 },
      { q: "2. Why does scarcity exist in every society?", options: ["Human wants are unlimited while resources (time, money, land) are limited", "Stores run out of inventory on weekends", "Governments print too few coins"], answer: 0 },
      { q: "3. If $1 USD equals 35 Thai Baht, how much is a 350 Baht train ticket in USD?", options: ["$3.50", "$10.00", "$35.00"], answer: 1 }
    ]
  },
  {
    id: "elec-coding-101",
    subject: "Computer Science & Web Coding",
    course_level: "Honors",
    quarter: "Q1",
    credits: 1.0,
    title: "W1D1: How the Web Works & Build Your First Live HTML Page",
    grading_scale: "100 pts — 30 pts Quick Check, 70 pts Live HTML Travel Dispatch Page",
    resource_url: [
      "https://" + "://w3schools.com" + "html/tryit.asp?filename=tryhtml_default",
      "https://" + "://youtube.com" + "results?search_query=Code.org+How+the+Internet+Works"
    ].join("\n"),
    description: "Fun fact: You are literally using a custom web app built with HTML, CSS, and JavaScript right now! Today you write your own live webpage right in your browser—no downloads needed.\n\n1. SANDBOX LAB (20 mins): Open the W3Schools TryIt Editor above. Change the <h1> heading and <p> paragraph to introduce your current travel city and tap 'Run' to see your live webpage appear on the right.\n\n2. TAG TOOLKIT:\n• <h1>Big Title</h1> & <h2>Subheading</h2>\n• <p>Paragraph text with <strong>bold</strong> words</p>\n• <ul><li>Bullet item 1</li><li>Bullet item 2</li></ul>\n\n3. MISSION: Build a mini 'Travel Field Dispatch' HTML page with an <h1> title, a short <p> story about something cool you saw recently, and a <ul> list of 3 favorite local foods—then paste your HTML code into the submission box below!",
    answer_key: "• Code Check: Student HTML properly opens and closes <h1>, <p>, and <ul><li>...</li></ul> tags without syntax errors.",
    quiz: [
      { q: "1. What does HTML stand for?", options: ["HyperText Markup Language", "High-Tech Machine Logic", "Home Tool Modeling Link"], answer: 0 },
      { q: "2. Which HTML tag creates the largest main page heading?", options: ["<h6>", "<p>", "<h1>"], answer: 2 },
      { q: "3. Which tag creates a bulleted (unordered) list?", options: ["<ul>", "<ol>", "<br>"], answer: 0 }
    ]
  },
  {
    id: "elec-photo-101",
    subject: "Digital Photography & Visual Storytelling",
    course_level: "Honors",
    quarter: "Q1",
    credits: 0.5,
    title: "W1D1: Rule of Thirds, Leading Lines & Golden Hour Shoot",
    grading_scale: "100 pts — 30 pts Quick Check, 70 pts 3-Photo Portfolio Challenge",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Peter+McKinnon+Rule+of+Thirds+Composition"
    ].join("\n"),
    description: "The best camera is the one in your pocket—turn on the 3x3 Grid in your iPad/phone Camera settings today and instantly level up your travel photos!\n\n1. COMPOSITION SECRET (10 mins): Watch the Rule of Thirds composition video above. Instead of placing your subject dead-center every time, align eyes, horizons, or buildings along the grid intersections.\n\n2. 3-SHOT FIELD MISSION (30 mins): Capture 3 original photos around your neighborhood, beach, market, or cafe:\n• Shot 1 (Rule of Thirds): Subject placed on a left or right grid intersection.\n• Shot 2 (Leading Lines): Use a path, railing, shoreline, or hallway to draw the viewer's eye straight to your subject.\n• Shot 3 (Low-Angle Perspective): Crouch down low and shoot upward to make an ordinary object look epic.\n\n3. TURN IN: Describe your 3 shots (and optionally paste a Google Drive/Photos link) explaining how each composition technique changed the mood.",
    answer_key: "• Portfolio Rubric: Must demonstrate intentional off-center placement (Rule of Thirds), directional lines guiding the eye (Leading Lines), and a dramatic low camera angle.",
    quiz: [
      { q: "1. Where should you place your main subject when using the Rule of Thirds?", options: ["Dead center in every photo", "Along the 3x3 grid lines or their intersections", "Cut off at the very bottom corner"], answer: 1 },
      { q: "2. What are 'Leading Lines' in photography?", options: ["Natural lines like roads, fences, or shorelines that guide the viewer's eye into the photo", "Scratch marks on the lens", "The border around a printed photo"], answer: 0 },
      { q: "3. When is 'Golden Hour' for warm, soft natural lighting?", options: ["High noon at 12:00 PM", "Shortly after sunrise and just before sunset", "Midnight"], answer: 1 }
    ]
  },
  {
    id: "elec-art-101",
    subject: "Studio Art & Design",
    course_level: "Honors",
    quarter: "Q1",
    credits: 0.5,
    title: "W1D1: Value Shading, Contour Drawing & Travel Sketchbook",
    grading_scale: "100 pts — 30 pts Quick Check, 70 pts 5-Value Sphere & Object Sketch",
    resource_url: [
      "https://" + "://youtube.com" + "results?search_query=Proko+How+to+Shade+a+Drawing+Light+and+Shadow"
    ].join("\n"),
    description: "All you need is a single pencil (or pen) and one sheet of paper—today you'll turn a flat circle into a 3D sphere using the 5 zones of light and shadow!\n\n1. WATCH (10 mins): Watch Proko's shading breakdown above to spot Highlight, Midtone, Core Shadow, Reflected Light, and Cast Shadow.\n\n2. SKETCHBOOK LAB (30 mins):\n• Part A: Draw a 5-box Value Scale going smoothly from pure white (#1) to darkest charcoal black (#5).\n• Part B: Sketch one everyday object in front of you (a coffee mug, seashell, fruit, or sneaker) using 3D shading and a cast shadow on the table.\n\n3. TURN IN: Describe how you created contrast between your light source and core shadow (and attach a photo link if desired).",
    answer_key: "• Studio Check: Student correctly identifies light source direction, core shadow on the form, and cast shadow anchored beneath the object.",
    quiz: [
            { q: "1. What makes a drawn circle look like a three-dimensional sphere?", options: ["Tracing the outline thicker", "Gradual value shading from highlight to core shadow plus a cast shadow", "Coloring it one flat solid shade"], answer: 1 },
      { q: "2. Where is the 'Core Shadow' located on a round object?", options: ["Directly facing the lamp", "On the curved edge turning away from the light source", "Floating in the background sky"], answer: 1 },
      { q: "3. What is 'Value' in visual art?", options: ["How expensive the paintbrush is", "The lightness or darkness of a tone or color", "The size of the canvas"], answer: 1 }
    ]
  },
  {
    id: "elec-mech-101",
    subject: "Automotive & Applied Mechanics",
    course_level: "Honors",
    quarter: "Q1",
    credits: 0.5,
    title: "W1D1: Simple Machines, Torque & How a 4-Stroke Engine Works",
    grading_scale: "100 pts — 30 pts Quick Check, 40 pts 4-Stroke Cycle Breakdown, 30 pts Mechanical Scavenger Hunt",
    resource_url: [
      "https://youtube.com"
    ].join("\n"),
    description: "Ever wonder how a tiny spark turns liquid fuel into enough torque to haul a family vehicle up a mountain pass? Every engine on Earth runs on 4 rhythmic beats: Intake, Compression, Power, Exhaust!\n\n1. 3D ENGINE TOUR (15 mins): Watch the Animagraffs 3D Car Engine animation above.\n\n2. THE 4-STROKE CYCLE ('Suck, Squeeze, Bang, Blow'):\n• Stroke 1 (Intake): Piston moves down, pulling air + fuel vapor into the cylinder.\n• Stroke 2 (Compression): Valves close; piston shoots up, squeezing the mixture tightly.\n• Stroke 3 (Power): Spark plug fires! Mini-explosion blasts the piston down, turning the crankshaft.\n• Stroke 4 (Exhaust): Exhaust valve opens; piston pushes burned gases out the tailpipe.\n\n3. MISSION: Explain why longer wrenches give you more Torque (Torque = Force × Lever Arm Length) when loosening a stubborn lug nut, and spot 3 simple machines (lever, pulley, gear, inclined plane, wheel/axle) around you today!",
    answer_key: "• 4-Stroke Order: 1. Intake → 2. Compression → 3. Power → 4. Exhaust.\n• Torque Principle: Torque = Force × Distance; a longer wrench increases lever-arm distance, multiplying rotational force without extra muscle.",
    quiz: [
      { q: "1. What is the correct order of a 4-stroke internal combustion engine?", options: ["Power, Intake, Exhaust, Compression", "Intake, Compression, Power, Exhaust", "Compression, Exhaust, Intake, Power"], answer: 1 },
      { q: "2. Why does a longer wrench make loosening a tight bolt much easier?", options: ["It increases Torque by multiplying your force across a longer lever arm", "It reduces the weight of the bolt", "It heats up the metal"], answer: 0 },
      { q: "3. Which component ignites the compressed air-fuel mixture in a gasoline engine?", options: ["The radiator", "The spark plug", "The alternator"], answer: 1 }
    ]
  }
);


