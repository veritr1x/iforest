# Recreated iForest Game Map

This map reflects the current reconstructed Node game in `src/gameData.js`. Solid links are playable connections. Dotted labels mark evidence-led unlocks or inferred bridges where the original full room graph has not been recovered.

```mermaid
flowchart TB
  town["Forestown Main Square\nitems: sandwich, map\nsleeping players"]
  customer["Customer Services\nmarker, lost tourist"]
  mall["Forestown Mall\nsandwich, coat, refreshments, clothing"]
  reception["Reception\nlocked door, receptionist"]
  lift["Lift\nlevel code"]
  corridor["Service Corridor\nlost tourist"]
  cage["Cage in Giant Kitchen\ngiant, cage"]
  lost["Lost Property Loop\nitem: coat"]
  hospital["Forestown Hospital\nfairy"]

  forest["Forest Edge\nwolf, stick, tourist"]
  pool["Waterfall Pool\nswim stone, water, marker"]
  infoClearing["Tourist Information Clearing\ntourist, fairy"]
  infoBooth["Tourist Information Booth\nhand stamp"]
  waterfall["Top of the Waterfall\nBaron trace, valley key"]
  church["Derelict Church\nBaron's seal, spellbook"]
  tree["Tall Tree\nneeds climb skill"]
  treetop["Tree Top\nmarker key, marker"]

  northpath["Northern Path\nbot"]
  gate["Beside Gate\ngate"]
  mansion["Mansion Grounds\nguard"]
  mansionReception["Mansion Reception\nlocked door, receptionist"]
  cellars["Wine Cellars\nlocked door"]
  house["Inside House\nold woman\nsafer sleep"]

  mountain["Mountain Pass\ncamera, marker"]
  caves["Cave Tunnels\ngoblin, troll, dragon, sword"]
  summit["Ski-Run Summit\ncamera, marker"]
  valley["Valley House\nclimb stone, sandwich, valley key\nsafer sleep"]

  town <-- "south / north" --> customer
  customer -. "west locked until hand stamped" .-> mall
  mall -->|east| customer
  customer <-- "east / south" --> reception
  reception -->|north| lift
  lift -. "use lift" .-> cage
  reception <-- "east / west" --> corridor
  lost <-- "east / west" --> town
  hospital -->|north| town
  hospital -->|west| lost

  town <-- "east / west" --> forest
  forest <-- "south / north" --> pool
  pool <-- "south / north" --> infoClearing
  infoClearing <-- "east / west" --> infoBooth
  pool -. "dive with swim stone, then east" .-> waterfall
  waterfall -->|west| pool
  forest <-- "east / west" --> church
  forest <-- "north / south" --> tree
  tree -. "climb with climb stone" .-> treetop
  treetop -->|south| tree

  town -. "north locked until wolf helped" .-> northpath
  northpath -->|south| town
  northpath <-- "north / south" --> gate
  waterfall -->|north| gate
  gate -. "use Baron's seal after waterfall clue" .-> mansion
  mansion -->|west| gate
  mansion <-- "north / south" --> mansionReception
  mansionReception <-- "east / west" --> cellars
  mansionReception <-- "north / south" --> house
  mansion <-- "east / west" --> mountain

  mountain <-- "north / south" --> caves
  mountain <-- "south / north" --> summit
  mountain <-- "east / west" --> valley
  valley <-- "north / south" --> house
```

## Implemented Evidence Details

- **Wolf/fairy unlock:** examine the wolf at Forest Edge, then use the thorn to open the northern path.
- **Big-house chain:** take the Baron's seal from the church, dive at the waterfall with the swim stone, examine the Baron trace, then use the seal at the gate.
- **Skill stones:** swim is needed to dive in the pool; climb is needed to reach the tree top.
- **Mall stamp:** the mall guard blocks entry until the tourist information booth stamps your hand.
- **Markers:** marker keys can claim fixed game markers. The claim is tracked per room.
- **Magic:** reading a spellbook grants a permanent spell. The recovered evidence proves spellbooks and permanent spells, but not the exact spell list.
- **Sleeping:** sleep is modeled everywhere; Valley House and the recovered wooden house are treated as safer sleeping places because the help pages describe locked/safe rooms.
- **Hospital/lost property:** dangerous combat can send the player to hospital and move carried objects to Lost Property.
- **Fairy housekeeping:** every eighth command resets the XML-like location documents, replacing taken objects and clearing dropped clutter.
- **Recovered servlet states:** the gate, reception, lift, wooden house, and giant-kitchen cage use recovered WML/HTML room text where available. The cage's exact place in the larger graph is still unknown.

## Still Unknown

The original Java source, XML location files, full world graph, exact combat formulas, exact spell effects, and complete post-mansion puzzle chain were not recovered. The current map is therefore a playable evidence-led reconstruction, not a claim that the original topology is complete.
