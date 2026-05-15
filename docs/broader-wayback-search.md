# Broader Wayback Search

Search date: 2026-05-15

## Queries Saved

CDX inventories were saved under `evidence/wayback/broader-cdx`.

- `useeverything-domain-200.json`: 235 unique 200-status captures across `useeverything.com` and subdomains.
- `littlescreen-domain-200.json`: 79 unique 200-status captures across `littlescreen.co.uk` and subdomains.
- `useeverything-driver-200.json`: 16 unique `servlets/Driver*` captures.
- `useeverything-mfr-200.json`: 5 unique `servlets/mfr*` captures.
- `wap-littlescreen-all.json`: 4 WAP mirror captures.

## New Evidence Preserved

The older `littlescreen.co.uk/iforest` mirror exposed 33 iForest files. All 33 were downloaded into `evidence/wayback/raw/littlescreen`.

The main additions versus the earlier dump are:

- Earlier iForest page versions from 2001-2002.
- `rules.htm`, which gives the original desktop rules page.
- `ins45.htm`, a marker-specific instruction page.
- Full-size/missing artwork including `MansionPic.gif`, `townpic.gif`, `Clipping1.gif`, `jag.gif`, and older creature/object images.
- Older `live.htm`, confirming marker/camera behavior against `servlets/mfr?fun=spycamera`.

## Game Details Confirmed Or Strengthened

- Game markers are physical world devices. A player with the appropriate marker key can claim a marker for 24 hours, and marker status is visible from the live page.
- The live page had text cameras and marker status links through `servlets/mfr?fun=spycamera`.
- The help puzzle chain is consistent across old and later mirrors: the big house depends on finding the Baron, the old church, and the top of the waterfall.
- The mall requires a hand stamp from the tourist information booth in the forest.
- The valley house requires a key somewhere in the world, contains useful items, and is a safe sleeping place.
- Tall-tree access requires the correct skill stone and includes useful items plus the forest game marker.

## Driver State Search Result

The broader `servlets/Driver*` search did not reveal a large hidden cache of iForest room states beyond the recovered set. It confirmed the known states:

- lift with level-code input
- reception with locked door and receptionist
- gate beside high wall
- wooden house with old woman
- cage in giant kitchen

The domain-wide servlet inventory also includes many `vdriver` captures. Those appear to belong to the separate Vampire Country game and are not treated as iForest map evidence.

## Remaining Gap

Wayback has preserved more page/artwork context than we had before, but not the original Java backend, player database, full room graph, full object table, or complete post-mansion puzzle chain.
