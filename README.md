# iForest Reconstruction

This folder contains the recovered evidence and a small Node/HTML recreation of the early-2000s WAP game iForest.

## Evidence

The archived material is under `evidence/wayback`:

- `raw/wap`: recovered WML and WBMP files from `wap.useeverything.com`
- `raw/servlet`: recovered servlet WML/HTML game states from `useeverything.com/servlets`
- `raw/html`: recovered desktop help pages, images, and the Palm PQA file
- `*.json`: Wayback CDX inventories used to find the captures

The recreation is intentionally evidence-led. It preserves the WAP command vocabulary, the login/start pattern, the Forestown/forest/mansion/mountain/valley areas, the wolf thorn puzzle, mall hand-stamp route, pocket limits, strength restoration, skill stones, teleportation sandwiches, spellbooks, game markers, sleeping, hospital/lost-property handling, fairy housekeeping resets, and several recovered servlet rooms.

The current map is in `docs/recreated-game-map.md`. It separates recovered text from inferred connective tissue where the original Java source and XML world files are still missing.

## Run

```bash
npm test
npm start
```

Then open `http://localhost:3333`.
