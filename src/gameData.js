export const MAX_STRENGTH = 35;
export const MAX_POCKETS = 4;
export const HOUSEKEEPING_RESET_INTERVAL = 8;

export const evidenceSources = [
  'http://web.archive.org/web/20020813224124id_/http://wap.useeverything.com/if.wml',
  'http://web.archive.org/web/20030812102021id_/http://useeverything.com:80/servlets/Intro1',
  'http://web.archive.org/web/20041109051542id_/http://useeverything.com:80/servlets/mfr',
  'http://web.archive.org/web/20030623201949id_/http://useeverything.com:80/iforest/index.htm',
  'https://web.archive.org/web/20020213120859id_/http://littlescreen.co.uk:80/tech2.htm',
  'https://web.archive.org/web/20020826043411id_/http://useeverything.com:80/tech2.htm',
  'https://web.archive.org/cdx/?url=http://wap.useeverything.com/*&output=json'
];

export const recoveredSystems = [
  'Java servlet move loop',
  'XML-backed mutable location documents',
  'location reset and fairy housekeeping',
  'sleeping-player visibility window',
  'bots with dull names that do not attack',
  'live text cameras and 24-hour game markers',
  'Palm PQA character-status form using fun=aboutchar',
  'character face selection (~20 per gender) shown by examine player',
  'PvP combat using best held weapon and best held defence, with one carried item dropped per hit',
  'hospital + lost-property recovery loop when strength reaches zero',
  'reception lobby and lift entry preceding Forestown square',
  'crowded-location overflow text ("lots of players are here") for postage-stamp screens',
  'description-view followed by an OK-link action-view, both auto-refreshing every ~20 seconds',
  'S% strength indicator showing a fraction of a fitness-grown cap; the 35-point starting cap rises as the player progresses'
];

export const FACES = {
  male: [
    'bearded ranger', 'clean-shaven scholar', 'grizzled sailor', 'pale poet',
    'tanned hiker', 'silver-haired elder', 'freckled apprentice', 'stern guard',
    'cheerful baker', 'tired clerk', 'sun-burnt farmer', 'sharp-eyed scout',
    'shaven monk', 'wild-haired wizard', 'soot-streaked smith', 'masked traveller',
    'curly-haired bard', 'one-eyed pirate', 'gentle healer', 'frowning miner'
  ],
  female: [
    'red-haired ranger', 'silver-braided scholar', 'sun-browned sailor', 'pale poet',
    'short-haired hiker', 'silver-haired elder', 'freckled apprentice', 'stern guard',
    'cheerful baker', 'tired clerk', 'wind-burnt farmer', 'sharp-eyed scout',
    'shaven priestess', 'wild-haired witch', 'soot-streaked smith', 'masked traveller',
    'curly-haired bard', 'one-eyed pirate', 'gentle healer', 'frowning miner'
  ]
};

export const rooms = {
  'forestown-reception': {
    id: 'forestown-reception',
    title: 'Forestown Reception',
    description:
      "You stand in a reception lobby. The receptionist peers at you from behind a big desk, obviously not impressed. The walls are covered with framed images of past adventurers, all proud, fit, and annoyingly confident. By contrast, you have come straight from the real world without the right adventuring clothes, tools, or even a compass. A clipboard of forms waits beside a small lift.",
    exits: {},
    commands: ['sign', 'examine', 'inventory', 'wait'],
    nouns: ['receptionist', 'forms', 'lift', 'frames'],
    evidence: [
      {
        file: 'evidence/wayback/raw/wap/20030815012928_wap.useeverything.com_other_intro.wml.wml',
        note: 'Recovered intro WAP page: sceptical receptionist, framed adventurers, no compass or kit.'
      },
      {
        file: 'evidence/wayback/raw/wap/20040710193404_wap.useeverything.com_other_intro2.wml.wml',
        note: 'Sign on the dotted line, hurry into the lift, receptionist calls "Don\'t get lost!".'
      }
    ]
  },
  'forestown-square': {
    id: 'forestown-square',
    title: 'Forestown Main Square',
    description:
      'You are in Forestown, a once-peaceful settlement behind protective walls. Rumours of dragons, fairies and magical sandwiches have drawn adventurers from around the world, and now the place is crowded with tourists who fight and steal from each other, and annoy the wolves in the forest. The main street leads north and south, public buildings stand to either side, and the eastern edge of town opens toward the woods. A pile of sleeping players has gathered near the start.',
    exits: {
      north: 'northern-path',
      south: 'customer-services',
      east: 'forest-edge',
      west: 'lost-property'
    },
    blockedExits: {
      north: {
        unlessFlag: 'wolfHelped',
        message:
          'A fairy blocks the northern path into the hills. You still need to show that you have mastered the basics.'
      }
    },
    nouns: ['sandwich', 'map', 'sleeping players'],
    image:
      'evidence/wayback/raw/littlescreen/20020317045912_http___littlescreen.co.uk_80_iforest_images_townpic.gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020719162915_useeverything.com_iforest_townhelp.htm.html',
        note: 'Town start, main street, mall, and lost property loop.'
      },
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: 'Mentions sleeping players near the start and the first-game objective.'
      },
      {
        file: 'evidence/wayback/raw/html/20030623201949_useeverything.com_iforest_index.htm.html',
        note: 'Forestown story and wap.useeverything.com entry point.'
      }
    ]
  },
  'customer-services': {
    id: 'customer-services',
    title: 'Customer Services',
    description:
      "Forestown's virtual customer-services system is reachable from the tourist information clearing. It is not much help, but a lost visitor and a claimable marker are somewhere inside.",
    exits: {
      north: 'forestown-square',
      east: 'customer-services-reception',
      west: 'forestown-mall'
    },
    blockedExits: {
      west: {
        unlessFlag: 'handStamped',
        message:
          'The mall security guard will not let you in unless you have had your hand stamped.'
      }
    },
    nouns: ['marker', 'lost tourist'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020605185512_useeverything.com_iforest_news.htm.html',
        note: 'News item about Customer Services, someone lost, and a marker.'
      }
    ]
  },
  'forestown-mall': {
    id: 'forestown-mall',
    title: 'Forestown Mall',
    description:
      'The mall sells refreshments and articles of clothing to tourists who have had their hands stamped.',
    exits: {
      east: 'customer-services'
    },
    nouns: ['sandwich', 'coat', 'refreshments', 'clothing'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020719162915_useeverything.com_iforest_townhelp.htm.html',
        note: 'Town help says the mall sells refreshments and clothing.'
      },
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: 'Mall access requires a hand stamp from the tourist information booth.'
      }
    ]
  },
  'customer-services-reception': {
    id: 'customer-services-reception',
    title: 'Reception',
    description:
      "You are at reception. There's not a lot here, except for a big desk in the centre of the room. The room continues to the east, and there's a door to the west. The exit to the street is to the south. You can go: north, south, east.",
    exits: {
      north: 'service-lift',
      south: 'customer-services',
      east: 'service-corridor'
    },
    commands: ['north', 'south', 'east', 'take', 'use', 'attack', 'examine', 'inventory', 'swap'],
    nouns: ['door', 'receptionist'],
    evidence: [
      {
        file: 'evidence/wayback/raw/servlet/20040723095203_useeverything.com_servlets_Driver_c_s_amp.wml',
        note: 'Recovered servlet state with reception, locked door, receptionist, and command list.'
      }
    ]
  },
  'service-corridor': {
    id: 'service-corridor',
    title: 'Service Corridor',
    description:
      'The corridor bends through unhelpful signs, hold music, and locked office doors. Somewhere among the partitions, a woman is wandering, unable to find her way back out.',
    exits: {
      west: 'customer-services-reception'
    },
    nouns: ['woman'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20100127030221_useeverything.com_iforest_news.htm.html',
        note: '2010 news log: a lost woman is somewhere inside Customer Services; finding her reveals a marker to claim.'
      }
    ]
  },
  'service-lift': {
    id: 'service-lift',
    title: 'Lift',
    description:
      'A lift waits with two choices: use lift or exit lift. A small panel asks for a level code before it will descend.',
    exits: {
      south: 'customer-services-reception'
    },
    commands: ['use', 'examine', 'inventory', 'swap', 'south'],
    nouns: ['lift', 'level code'],
    evidence: [
      {
        file: 'evidence/wayback/raw/servlet/20040722203211_useeverything.com_servlets_Driver_c1_c1_amp.wml',
        note: 'Recovered lift state with level-code prompt.'
      }
    ]
  },
  'giant-kitchen-cage': {
    id: 'giant-kitchen-cage',
    title: 'Cage in Giant Kitchen',
    description:
      "You are in a cage. It's just big enough to move around, but not much bigger. Outside the cage is an enormous kitchen, and you can see what looks to be a giant fussing around with knives and other utensils. You can go: nowhere.",
    exits: {},
    commands: ['use', 'attack', 'examine', 'inventory', 'swap', 'wait'],
    nouns: ['giant', 'cage'],
    evidence: [
      {
        file: 'evidence/wayback/raw/servlet/20040624153435_useeverything.com_servlets_Driver_code_beanstalk_amp.wml',
        note: 'Recovered servlet state; placement in the larger iForest graph is unknown.'
      }
    ]
  },
  'lost-property': {
    id: 'lost-property',
    title: 'Lost Property Loop',
    description:
      'Racks, bins, and tagged bundles fill the town lost property rooms. Possessions from hospitalised travellers are moved here.',
    exits: {
      east: 'forestown-square'
    },
    nouns: ['coat'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020719162915_useeverything.com_iforest_townhelp.htm.html',
        note: 'Lost property receives objects from hurt or hospitalised players.'
      },
      {
        file: 'evidence/wayback/raw/wap/20041208154105_wap.useeverything.com_ifinfo3.wml.wml',
        note: 'Low strength sends players to hospital and moves carried items to lost property.'
      }
    ]
  },
  hospital: {
    id: 'hospital',
    title: 'Forestown Hospital',
    description:
      "You wake in Forestown's hospital after the fairies carry you back from danger. Anything you were carrying has been moved to lost property.",
    exits: {
      north: 'forestown-square',
      west: 'lost-property'
    },
    nouns: ['fairy'],
    image:
      'evidence/wayback/raw/littlescreen/20010804060317_http___littlescreen.co.uk_80_iforest_images_fairysmall.gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/wap/20041121155041_wap.useeverything.com_ifinfo4.wml.wml',
        note: 'Fairies carry unconscious players to hospital.'
      }
    ]
  },
  'forest-edge': {
    id: 'forest-edge',
    title: 'Forest Edge',
    description:
      'Tall trees crowd the path east of town. A leaving-Forestown sign stands behind you, a tourist is camping near a stream, and one angry wolf limps between the trunks.',
    exits: {
      west: 'forestown-square',
      north: 'tall-tree',
      south: 'forest-pool',
      east: 'derelict-church'
    },
    nouns: ['wolf', 'stick', 'tourist', 'stream'],
    image:
      'evidence/wayback/raw/html/20060106093348_useeverything.com_iforest_images_wolfcrop.jpg.jpg',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020829185908_useeverything.com_iforest_foresthelp.htm.html',
        note: 'Forest, wolves, thorn puzzle, fairies, church, pool, waterfall, and tourist information.'
      },
      {
        file: 'evidence/wayback/raw/html/20080516203125_useeverything.com_iforest_foresthelp.htm.html',
        note: '2008 forest help: church entry is discouraged by Forestown management; fairies unlock the northern path after the thorn.'
      },
      {
        file: 'evidence/wayback/raw/wap/20041119080710_wap.useeverything.com_ifinfo2.wml.wml',
        note: 'Fighting, sleeping, and wolf guidance.'
      },
      {
        file: 'evidence/wayback/raw/html/20081023144508_useeverything.com_iforest_whattodo.htm.html',
        note: 'Wolf is at the north of the clearing, near a stream, with a camping tourist.'
      }
    ]
  },
  'forest-pool': {
    id: 'forest-pool',
    title: 'Waterfall Pool',
    description:
      'A cold pool sits below a waterfall in the south-west of the forest. The water is clear and deep; reaching the useful route here requires swimming.',
    exits: {
      north: 'forest-edge',
      south: 'tourist-info-clearing',
      east: 'waterfall-top'
    },
    blockedExits: {
      east: {
        unlessFlag: 'waterfallRouteFound',
        message: 'You need to dive and find the route before you can climb up beyond the waterfall.'
      }
    },
    commands: ['north', 'south', 'east', 'look', 'inventory', 'take', 'drop', 'use', 'examine', 'dive', 'sleep', 'wait'],
    nouns: ['swim stone', 'water', 'marker'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020829185908_useeverything.com_iforest_foresthelp.htm.html',
        note: 'Pool and waterfall in the south-west forest.'
      },
      {
        file: 'evidence/wayback/raw/wap/20041208154105_wap.useeverything.com_ifinfo3.wml.wml',
        note: 'Skill stones, swimming, food, water, and strength.'
      },
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: 'Top of the waterfall is part of the big-house puzzle chain.'
      }
    ]
  },
  'tourist-info-clearing': {
    id: 'tourist-info-clearing',
    title: 'Tourist Information Clearing',
    description:
      'A clearing on the southern side of the forest points visitors toward a tourist information booth. This is where the mall hand-stamp route begins.',
    exits: {
      north: 'forest-pool',
      east: 'tourist-info-booth'
    },
    nouns: ['tourist', 'fairy'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020829185908_useeverything.com_iforest_foresthelp.htm.html',
        note: 'Forest help places a tourist information centre on the southern side of the forest.'
      },
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: 'Mall directions: east from Forestown, south as far as possible, then east.'
      }
    ]
  },
  'tourist-info-booth': {
    id: 'tourist-info-booth',
    title: 'Tourist Information Booth',
    description:
      'A booth dispenses practical advice and hand stamps for visitors who want to enter the Forestown Mall.',
    exits: {
      west: 'tourist-info-clearing'
    },
    commands: ['west', 'look', 'inventory', 'examine', 'stamp', 'sleep', 'wait'],
    nouns: ['hand stamp'],
    image:
      'evidence/wayback/raw/littlescreen/20010804060317_http___littlescreen.co.uk_80_iforest_images_fairysmall.gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020605184517_useeverything.com_iforest_touristinfo.htm.html',
        note: 'Tourist information site section.'
      },
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: 'The booth gives the hand stamp needed for mall entry.'
      }
    ]
  },
  'waterfall-top': {
    id: 'waterfall-top',
    title: 'Top of the Waterfall',
    description:
      "Mist rises above the forest canopy. The recovered help says the big-house puzzle depends partly on the top of the waterfall, so this room preserves that clue without inventing the missing full puzzle.",
    exits: {
      west: 'forest-pool',
      north: 'beside-gate'
    },
    nouns: ['baron trace', 'valley key'],
    image:
      'evidence/wayback/raw/html-expanded/20040516073534_http_useeverything_com_80_iforest_images_valleypic_small_gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: 'The key to the big house lies in the old church and at the top of the waterfall.'
      }
    ]
  },
  'derelict-church': {
    id: 'derelict-church',
    title: 'Derelict Church',
    description:
      'An old church leans between the trees. Forestown management would prefer visitors to ignore it, which makes it worth a closer look.',
    exits: {
      west: 'forest-edge'
    },
    nouns: ['seal', 'spellbook'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020829185908_useeverything.com_iforest_foresthelp.htm.html',
        note: 'Hidden derelict church in the forest.'
      },
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: 'Old church is part of the big-house puzzle chain.'
      },
      {
        file: 'evidence/wayback/raw/html/20020605185512_useeverything.com_iforest_news.htm.html',
        note: 'Spellbooks teach permanent spells that can be cast on awake players.'
      }
    ]
  },
  'tall-tree': {
    id: 'tall-tree',
    title: 'Tall Tree',
    description:
      'A tall tree rises above the forest. The handholds are too high for an ordinary tourist, but a climbing skill stone should be enough.',
    exits: {
      south: 'forest-edge'
    },
    commands: ['south', 'look', 'inventory', 'take', 'drop', 'use', 'examine', 'climb', 'sleep', 'wait'],
    nouns: ['tall tree'],
    image:
      'evidence/wayback/raw/html-expanded/20030305044700_http_useeverything_com_80_iforest_images_ForestPic_small_gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: 'Tall-tree access needs the right skill stone.'
      }
    ]
  },
  'tree-top': {
    id: 'tree-top',
    title: 'Tree Top',
    description:
      "Branches sway over the woods. There is useful stuff up here, including the forest's game marker.",
    exits: {
      south: 'tall-tree'
    },
    commands: ['south', 'look', 'inventory', 'take', 'drop', 'use', 'examine', 'claim', 'sleep', 'wait'],
    nouns: ['marker key', 'marker'],
    image:
      'evidence/wayback/raw/html-expanded/20020918022251_http_useeverything_com_80_iforest_images_marker_gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20030104000220_useeverything.com_iforest_whattodo.htm.html',
        note: "Useful stuff up the tall tree includes the forest's game marker."
      },
      {
        file: 'evidence/wayback/raw/littlescreen/20010918180932_http___littlescreen.co.uk_80_iforest_ins45.htm.htm',
        note: 'Marker keys claim physical game markers.'
      }
    ]
  },
  'northern-path': {
    id: 'northern-path',
    title: 'Northern Path',
    description:
      'The fairies let you pass beyond the north end of Forestown. A high wall and a huge wooden gate rise ahead.',
    exits: {
      south: 'forestown-square',
      north: 'beside-gate'
    },
    nouns: ['bot'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020829185908_useeverything.com_iforest_foresthelp.htm.html',
        note: 'Fairies allow the northern exit after the wolf puzzle.'
      },
      {
        file: 'evidence/wayback/raw/contact/20020213120859_http_littlescreen_co_uk_80_tech2_htm.html',
        note: 'Bots provide movement when no one else is playing.'
      }
    ]
  },
  'beside-gate': {
    id: 'beside-gate',
    title: 'Beside Gate',
    description:
      "You are standing in front of a huge wooden gate. A high wall runs east-west as far as you can see, and there doesn't seem to be any way to get over it. There is a path leading east from here. The gate is closed. You can go: east.",
    exits: {
      south: 'northern-path',
      east: 'mansion-grounds'
    },
    nouns: ['gate'],
    blockedExits: {
      east: {
        unlessFlag: 'gateOpened',
        message:
          "The gate is closed. The recovered help says you need the old church, the top of the waterfall, and the Baron's seal."
      }
    },
    commands: ['south', 'east', 'look', 'take', 'use', 'attack', 'examine', 'inventory', 'swap', 'sleep', 'wait'],
    evidence: [
      {
        file: 'evidence/wayback/raw/servlet/20070604111151_useeverything.com_servlets_Driver_state_z2C2x.RcBMXpmnPyvuL4PULw7llWiHNhMYW_c_COM_n1_NOUN_n2_N2_c1_C_c2_C.wml',
        note: 'Recovered WML gate state.'
      },
      {
        file: 'evidence/wayback/raw/html/20020718091746_useeverything.com_iforest_mansionhelp.htm.html',
        note: "Baron's mansion, guards, wall, and seal requirement."
      }
    ]
  },
  'mansion-grounds': {
    id: 'mansion-grounds',
    title: 'Mansion Grounds',
    description:
      "The Baron's mansion dominates the north end of town. Guards watch the high wall while the house waits beyond a clipped lawn.",
    exits: {
      west: 'beside-gate',
      north: 'mansion-reception',
      east: 'mountain-pass'
    },
    nouns: ['guard'],
    image:
      'evidence/wayback/raw/littlescreen/20020313232535_http___littlescreen.co.uk_80_iforest_images_MansionPic.gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020718091746_useeverything.com_iforest_mansionhelp.htm.html',
        note: "Mansion is guarded and surrounded by a high wall."
      }
    ]
  },
  'mansion-reception': {
    id: 'mansion-reception',
    title: 'Mansion Reception',
    description:
      'The mansion is quiet enough to feel abandoned. A locked door blocks one side of the reception room, while passages run toward the kitchen and the rooms above.',
    exits: {
      south: 'mansion-grounds',
      east: 'wine-cellars',
      north: 'wooden-house'
    },
    nouns: ['door', 'receptionist'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020718091746_useeverything.com_iforest_mansionhelp.htm.html',
        note: 'Inside the mansion, the important task is to explore all rooms and the wine cellars.'
      },
      {
        file: 'evidence/wayback/raw/servlet/20040730171002_useeverything.com_servlets_Driver_state_Ai-Sqhr1zfp4BdbIX_amp.wml',
        note: 'Recovered reception state with locked door and receptionist; exact placement is inferred.'
      }
    ]
  },
  'wine-cellars': {
    id: 'wine-cellars',
    title: 'Wine Cellars',
    description:
      'Cellar arches stretch underneath the kitchen. The tourist notes say these passages may be extensive and lead for several miles.',
    exits: {
      west: 'mansion-reception'
    },
    nouns: ['locked door'],
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020718091746_useeverything.com_iforest_mansionhelp.htm.html',
        note: 'Wine cellars under the kitchen are rumoured to be extensive.'
      }
    ]
  },
  'wooden-house': {
    id: 'wooden-house',
    title: 'Inside House',
    description:
      "You are inside a small wooden house. There's only one room, and hardly any furniture. There is a rocking chair next to one of the windows, with an old woman rocking slowly in it. I think she's asleep. You can go: south.",
    exits: {
      south: 'mansion-reception'
    },
    commands: ['south', 'take', 'use', 'attack', 'examine', 'inventory', 'swap', 'sleep', 'wait'],
    nouns: ['woman'],
    safeSleep: true,
    evidence: [
      {
        file: 'evidence/wayback/raw/servlet/20021008010511_useeverything.com_servlets_DriverHTML.wml',
        note: 'Recovered web demonstration form with exact room text, command select, and woman noun.'
      },
      {
        file: 'evidence/wayback/raw/servlet/20030816043841_useeverything.com_servlets_Driver_code_beanstalk_c_swap.wml',
        note: 'Recovered WML house state after swap.'
      }
    ]
  },
  'mountain-pass': {
    id: 'mountain-pass',
    title: 'Mountain Pass',
    description:
      'The path climbs into colder air. Tunnels cut into the mountain, the snow deepens, and signs point toward a ski-run, game marker, and text camera near the summit. Beyond, the still uncharted regions promise more than most visitors ever stray to find.',
    exits: {
      west: 'mansion-grounds',
      north: 'cave-tunnels',
      south: 'ski-run-summit',
      east: 'valley-house'
    },
    nouns: ['camera', 'marker'],
    image:
      'evidence/wayback/raw/html-expanded/20030305045115_http_useeverything_com_80_iforest_images_MountainPic_small_gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020829190859_useeverything.com_iforest_mountainhelp.htm.html',
        note: 'Mountain area, tunnels, ski-run, marker, and text camera.'
      }
    ]
  },
  'cave-tunnels': {
    id: 'cave-tunnels',
    title: 'Cave Tunnels',
    description:
      'Narrow tunnels run under the mountains. The residents are mostly non-human; the deeper tunnels are nastier and the weapons they guard are more interesting.',
    exits: {
      south: 'mountain-pass'
    },
    nouns: ['goblin', 'troll', 'dragon', 'sword'],
    image:
      'evidence/wayback/raw/littlescreen/20010831001024_http___littlescreen.co.uk_80_iforest_images_goblincrop.jpg.jpg',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020829190859_useeverything.com_iforest_mountainhelp.htm.html',
        note: 'Mountain residents live underground and guard weapons.'
      },
      {
        file: 'evidence/wayback/raw/littlescreen/20010808083033_http___littlescreen.co.uk_80_iforest_images_swordcrop.jpg.jpg',
        note: 'Recovered early weapon artwork.'
      }
    ]
  },
  'ski-run-summit': {
    id: 'ski-run-summit',
    title: 'Ski-Run Summit',
    description:
      'At the top of one mountain is the start of a ski-run, a game marker, and a live text camera so everyone can see who made it here.',
    exits: {
      north: 'mountain-pass'
    },
    commands: ['north', 'look', 'inventory', 'take', 'drop', 'use', 'examine', 'claim', 'sleep', 'wait'],
    nouns: ['camera', 'marker'],
    image:
      'evidence/wayback/raw/html-expanded/20020918022251_http_useeverything_com_80_iforest_images_marker_gif.gif',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020829190859_useeverything.com_iforest_mountainhelp.htm.html',
        note: 'Ski-run, marker, and text camera at the top of a mountain.'
      },
      {
        file: 'evidence/wayback/raw/html/20020605185037_useeverything.com_iforest_live.htm.html',
        note: 'Live page had five text cameras and marker status.'
      }
    ]
  },
  'valley-house': {
    id: 'valley-house',
    title: 'Valley House',
    description:
      "East of the mountains is a sparse valley with a pleasant climate. A neat abandoned house contains useful objects, an underground passage, and one of the safer places to sleep if you have the key.",
    exits: {
      west: 'mountain-pass',
      north: 'wooden-house'
    },
    nouns: ['climb stone', 'sandwich', 'valley key'],
    image:
      'evidence/wayback/raw/html-expanded/20040516073534_http_useeverything_com_80_iforest_images_valleypic_small_gif.gif',
    safeSleep: true,
    lockableWith: 'valley key',
    evidence: [
      {
        file: 'evidence/wayback/raw/html/20020720023846_useeverything.com_iforest_valleyhelp.htm.html',
        note: 'Valley, abandoned house, useful objects, and underground passage.'
      },
      {
        file: 'evidence/wayback/raw/html/20081023144508_useeverything.com_iforest_whattodo.htm.html',
        note: '2008 Q7: sleeping behind a locked door with the key is even safer, until fairies eventually respawn a duplicate key.'
      }
    ]
  }
};

export const items = {
  sandwich: {
    id: 'sandwich',
    name: 'teleportation sandwich',
    description:
      'A curious magical food made by the fairies. Eat one and you are transported to wherever that sandwich was made; fairies often leave them in far-off regions for travellers.',
    portable: true,
    madeAt: 'forestown-square'
  },
  map: {
    id: 'map',
    name: 'map',
    description: 'A tourist map showing Forestown, the woods, the mansion, mountains, caves, and valley.',
    portable: true
  },
  stick: {
    id: 'stick',
    name: 'stick',
    description:
      'A sturdy stick. The recovered rules say attacks use the most effective weapon you are holding.',
    portable: true,
    attack: 6,
    defense: 2
  },
  sword: {
    id: 'sword',
    name: 'sword',
    description: 'A guarded cave weapon represented by recovered early artwork.',
    portable: true,
    attack: 14,
    defense: 7
  },
  'swim stone': {
    id: 'swim stone',
    name: 'swim stone',
    description: 'A smooth skill stone with a water mark. While carrying it, you can swim.',
    portable: true,
    skill: 'swim'
  },
  'climb stone': {
    id: 'climb stone',
    name: 'climb stone',
    description: 'A rough skill stone with a tree mark. While carrying it, you can climb.',
    portable: true,
    skill: 'climb'
  },
  'marker key': {
    id: 'marker key',
    name: 'marker key',
    description: 'A key for claiming one of the world markers for about 24 hours.',
    portable: true
  },
  'valley key': {
    id: 'valley key',
    name: 'valley key',
    description:
      'A key from the recovered valley-house hint. The exact original location is unknown, so this reconstruction keeps it near the waterfall clue.',
    portable: true
  },
  coat: {
    id: 'coat',
    name: 'coat',
    description: 'A warm coat from lost property.',
    portable: true,
    defense: 4
  },
  seal: {
    id: 'seal',
    name: "Baron's seal",
    aliases: ['barons seal', "baron's seal"],
    description: 'A crest used to satisfy the guards and open the mansion gate.',
    portable: true
  },
  spellbook: {
    id: 'spellbook',
    name: 'spellbook',
    description:
      "A scattered spellbook. Reading it teaches the chocolate-weapons spell, which can be cast on any other awake player to turn the weapons they are holding into chocolate. Once learned, the spell is permanent.",
    portable: true,
    teachesSpell: 'chocolate weapons'
  },
  water: {
    id: 'water',
    name: 'water',
    description: 'Cold water from the waterfall pool. Food or water can restore low strength.',
    portable: false
  },
  wolf: {
    id: 'wolf',
    name: 'wolf',
    description: 'An angry wolf with something wrong with its paw.',
    portable: false
  },
  thorn: {
    id: 'thorn',
    name: 'thorn',
    description: "A thorn stuck in the wolf's paw.",
    portable: false
  },
  gate: {
    id: 'gate',
    name: 'gate',
    description: 'A closed wooden gate in a high wall.',
    portable: false
  },
  guard: {
    id: 'guard',
    name: 'guard',
    description: 'A mansion guard watching for the Baronial seal.',
    portable: false
  },
  woman: {
    id: 'woman',
    name: 'woman',
    description: 'An old woman asleep in a rocking chair.',
    portable: false
  },
  camera: {
    id: 'camera',
    name: 'text camera',
    description: 'A live text camera. The archived live page says there were five cameras.',
    portable: false
  },
  marker: {
    id: 'marker',
    name: 'game marker',
    description:
      'A physical world marker. With the appropriate marker key, a player can plant a flag here.',
    portable: false
  },
  'sleeping players': {
    id: 'sleeping players',
    name: 'sleeping players',
    description:
      'Characters who stopped playing. They are visible for a short while, cannot be attacked, and can still have carried objects taken.',
    portable: false
  },
  'hand stamp': {
    id: 'hand stamp',
    name: 'hand stamp',
    description: 'A temporary stamp from the tourist information booth that lets you into the mall.',
    portable: false
  },
  refreshments: {
    id: 'refreshments',
    name: 'refreshments',
    description: 'Food and drink sold in the Forestown Mall.',
    portable: false
  },
  clothing: {
    id: 'clothing',
    name: 'clothing',
    description: 'Articles of clothing sold in the Forestown Mall.',
    portable: false
  },
  fairy: {
    id: 'fairy',
    name: 'fairy',
    description:
      'A housekeeping character. The technical page says fairies are special characters who keep the world in order. ifinfo4.wml adds that if a key gets lost, or a person becomes stuck in a tree, sooner or later the fairies will sort it out, and that they sometimes give skill stones to travellers.',
    portable: false
  },
  bot: {
    id: 'bot',
    name: 'bot',
    description:
      'A dull-named non-attacking character used to provide movement when no one else is playing.',
    portable: false
  },
  tourist: {
    id: 'tourist',
    name: 'tourist',
    description: 'Another visitor near the forest stream and camping clearing.',
    portable: false
  },
  'lost tourist': {
    id: 'lost tourist',
    name: 'lost tourist',
    description: "Someone rumoured to be lost in Forestown's customer-services system.",
    portable: false
  },
  door: {
    id: 'door',
    name: 'locked door',
    description: 'A locked door from the recovered reception state.',
    portable: false
  },
  receptionist: {
    id: 'receptionist',
    name: 'receptionist',
    description: 'An iForest staff member behind a reception desk.',
    portable: false
  },
  forms: {
    id: 'forms',
    name: 'forms',
    description: 'A standard adventuring waiver. The receptionist taps her pen pointedly until you sign.',
    portable: false
  },
  frames: {
    id: 'frames',
    name: 'framed adventurers',
    description: 'Past adventurers in the framed photographs all look proud, fit, and annoyingly confident.',
    portable: false
  },
  lift: {
    id: 'lift',
    name: 'lift',
    description: 'A lift with a level-code prompt.',
    portable: false
  },
  'level code': {
    id: 'level code',
    name: 'level code',
    description: 'A code field shown by the recovered lift state.',
    portable: false
  },
  giant: {
    id: 'giant',
    name: 'giant',
    description: 'A giant fussing around with knives and other utensils outside a cage.',
    portable: false
  },
  cage: {
    id: 'cage',
    name: 'cage',
    description: 'A cage just big enough to move around in.',
    portable: false
  },
  'baron trace': {
    id: 'baron trace',
    name: 'baron trace',
    description:
      'A reconstruction clue for the unrecovered Baron step at the top of the waterfall.',
    portable: false
  },
  'tall tree': {
    id: 'tall tree',
    name: 'tall tree',
    description: 'The tree that requires a climbing skill stone.',
    portable: false
  },
  goblin: {
    id: 'goblin',
    name: 'goblin',
    description: 'A non-human mountain resident suggested by recovered creature artwork.',
    portable: false
  },
  troll: {
    id: 'troll',
    name: 'troll',
    description: 'A non-human mountain resident suggested by recovered creature artwork.',
    portable: false
  },
  dragon: {
    id: 'dragon',
    name: 'dragon',
    description: 'A rumoured creature from the story page and recovered artwork.',
    portable: false
  },
  'locked door': {
    id: 'locked door',
    name: 'locked door',
    description: 'A locked door. Locked rooms make safer places to sleep if you have the key.',
    portable: false
  }
};
