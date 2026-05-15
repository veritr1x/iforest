# Expanded Search Notes

Search date: 2026-05-15

## New Wayback Evidence

The most useful new material was outside the `iforest/` pages themselves: archived site-wide `contact`, `what`, and `tech` pages from `littlescreen.co.uk` and `useeverything.com`.

Preserved under `evidence/wayback/raw/contact`:

- `20010602110430_http_www_littlescreen_co_uk_80_contact_htm.html`
- `20010305091304_http_www_useeverything_com_80_contact_htm.html`
- `20010613220328_http_www_littlescreen_co_uk_80_what_htm.html`
- `20011029155057_http_littlescreen_co_uk_80_tech_htm.html`
- `20020213120859_http_littlescreen_co_uk_80_tech2_htm.html`
- `20020115204812_http_littlescreen_co_uk_80_tech3_htm.html`
- `20020605190442_http_useeverything_com_80_tech_htm.html`
- `20020826043411_http_useeverything_com_80_tech2_htm.html`

## Backend Architecture Recovered

The `tech2.htm` pages explain how iForest worked internally:

- iForest was a large self-organising multiplayer game written completely in Java.
- Game state was stored as XML documents, not in a database.
- Entering a location parsed that location's XML file into Java objects.
- Locations contained descriptions, exits, objects, players, and objects held by players.
- Player actions updated the XML file for the current location and saved it back.
- The XML layer used a custom generator/parser for speed.
- The design was modular enough that it could have used a database, but XML was chosen for editability.
- Locations periodically reset to their initial state to clean up dropped objects and replace taken objects.
- Sleeping players eventually disappeared from view until next login.
- Crowded locations were summarized as "lots of players are here" instead of listing every player.
- Fairies were special housekeeping characters.
- Bots existed to provide movement when no one else was playing.
- The engine was considered general enough for other scenarios, including a possible sci-fi version.

This is not source code, but it is the strongest evidence so far about the original backend model.

## Contact Leads

The archived contact pages preserve two old contact addresses:

- `human_being@littlescreen.co.uk`
- visible text `mail@useeverything.com`; the page's `mailto:` target is `contact@useeverything.com`

These domains are no longer useful as live contact channels, but the addresses can be used as search terms or clues if trying to identify the original operator.

## Expanded CDX Counts

Additional prefix inventories were saved under `evidence/wayback/expanded-cdx`:

- `useeverything-iforest-prefix.json`: 42 unique 200-status `useeverything.com/iforest/` captures.
- `littlescreen-iforest-prefix.json`: 33 unique 200-status `littlescreen.co.uk/iforest/` captures.
- `wap-useeverything-prefix.json`: 60 unique 200-status `wap.useeverything.com/` captures.
- `wap-littlescreen-prefix.json`: 4 unique 200-status `wap.littlescreen.co.uk/` captures.

The global `*iforest*` CDX form returned no rows, while broader cross-domain path-wildcard variants are rejected by Wayback without authorization. The useful approach remains host/prefix-specific CDX searching.

## Image Assets Added

The `useeverything.com/iforest/` prefix inventory showed several indexed image assets that were not present in the local evidence tree. These were downloaded under `evidence/wayback/raw/html-expanded`:

- `ifnice.gif` - 406 x 54
- `marker.gif` - 122 x 230
- `ForestPic_small.gif` - 90 x 113
- `MansionPic_small.gif` - 90 x 81
- `MountainPic_small.gif` - 100 x 69
- `question.gif` - 100 x 100
- `townpic_small.gif` - 100 x 83
- `valleypic_small.gif` - 100 x 67

These improve the visual reconstruction, especially area selector and marker documentation screens.

## Outside-Wayback Checks

Public web search still only surfaced the known HowardForums/T-Zones directory listing as useful external corroboration.

Additional current checks:

- GitHub repository search for exact strings such as `wap.useeverything.com`, `iForest.pqa`, `fun=aboutchar`, and `servlets/mfr` found zero repositories.
- GitHub issue search for the same exact strings found zero issues.
- GitHub code search requires authentication from this environment.
- Internet Archive item search found no uploaded collection items for `iForest.pqa`, `wap.useeverything.com`, `littlescreen.co.uk`, `UseEverything.com Mobile`, or the Little Screen role-playing-game phrase.

## Recovery Impact

This pass does not recover the Java servlet source or the XML world files. It does materially improve reconstruction confidence by confirming the original architecture:

- Java servlet request/response surface
- XML-backed mutable location files
- per-location reset/self-stabilisation
- sleeping-player visibility rules
- fairies and bots as system actors
- object/player/location model

For a faithful rebuild, the next useful step is to model rooms as editable location documents and implement periodic reset/housekeeping behaviour rather than treating the world as a static graph.
