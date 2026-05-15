# Reconstruction Notes

## Recovered Anchors

- WAP entry menu: `evidence/wayback/raw/wap/20020813224124_wap.useeverything.com_if.wml.wml`
- Intro game menu: `evidence/wayback/raw/servlet/20030812102021_useeverything.com_servlets_Intro1.wml`
- Login/create account screen: `evidence/wayback/raw/servlet/20041109051542_useeverything.com_servlets_mfr.wml`
- Web demonstration room: `evidence/wayback/raw/servlet/20021008010511_useeverything.com_servlets_DriverHTML.wml`
- Forest thorn puzzle: `evidence/wayback/raw/html/20020829185908_useeverything.com_iforest_foresthelp.htm.html`
- Town/lost property: `evidence/wayback/raw/html/20020719162915_useeverything.com_iforest_townhelp.htm.html`
- Backend architecture: `evidence/wayback/raw/contact/20020213120859_http_littlescreen_co_uk_80_tech2_htm.html`

## Original Architecture Evidence

The archived `tech2.htm` pages describe iForest as a Java servlet game whose mutable world state was stored in XML documents. Locations were parsed into Java objects containing descriptions, exits, objects, players, and carried objects; player moves updated and saved the XML for the current location. The design included periodic location resets, sleeping-player disappearance, fairies for housekeeping, and bots for movement when no players were active.

## Implemented Scope

- HTML frontend with a WAP-style command form and quick action buttons.
- Node backend with in-memory sessions and JSON APIs.
- Reconstructed game engine with rooms, exits, pocket limits, inventory, strength, command handling, skill stones, spellbooks, marker claiming, sleeping, hospitalisation, fairy housekeeping resets, and evidence links.
- Partial world based on recovered pages: Forestown, mall hand-stamp route, Customer Services, recovered reception/lift/cage states, lost property, hospital, forest, tourist information booth, waterfall pool/top, church, tall tree/tree top, northern path, gate, mansion grounds/reception/cellars, recovered wooden house state, mountain pass, caves, ski-run summit, and valley house.
- Visual reconstruction uses recovered town, mansion, mountain, valley, marker, fairy, wolf, cave, and Palm PQA assets where available.
- The evidence sidebar now exposes the recovered Java servlet/XML architecture, bots, sleeping-player behavior, live cameras/markers, and PQA `fun=aboutchar` clue.

## Known Gaps

The original Java servlet source, XML world files, complete room graph, combat formula, spell list, live multiplayer state, and exact post-mansion puzzle chain were not recovered. This project recreates the playable surface from archived client/server outputs rather than claiming to be the original implementation.
