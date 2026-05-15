# PQA Decompile Notes

Search date: 2026-05-15

## Input

- `evidence/wayback/raw/html/20020828163658_useeverything.com_iforest_iForest.pqa.pqa`
- The LittleScreen and UseEverything PQA downloads are byte-identical: SHA-256 `165a3c4600768ac7dd7ca51f4a24c7ed8215612ffd6b189a1d33a4c5324d1cde`.

## Method

- Parsed the file as a Palm PQA/PDB database: database name `iForest.pqa`, type `pqa `, creator `clpr`, 5 records.
- Built and ran Tom Zerucha's `unpqa`/`pqatobin` decompiler, using Palm OS SDK `CMLConst.h` constants and a small local 64-bit portability patch for the old C source.
- Converted extracted Palm Netpbm images to PNG with macOS `sips`.

## Extracted Resources

- `evidence/pqa-decompiled/iforest.html` from bundled `iforest.html`.
- `evidence/pqa-decompiled/info.html` from bundled `info.html`.
- `evidence/pqa-decompiled/iforestsmall.png` from bundled `iforestsmall.gif`; small iForest wordmark.
- `evidence/pqa-decompiled/smallsword.png` from bundled `smallsword.gif`; sword/character icon.
- `evidence/pqa-decompiled/littlewap.png` from bundled `littlewap.gif`; Little Screen Adventures logo.

## Gameplay-Relevant Findings

- The PQA is not a Palm executable game. It is a web clipping app containing compressed CML/HTML and Palm bitmap resources for the Palm Web Clipping Viewer.
- The main bundled page is a character-info form, not the game itself.
- The form submits `GET` requests to `http://wap.littlescreen.co.uk/servlets/mfr` with:
  - hidden field `fun=aboutchar`
  - username field `user`
  - password field `pwd`
- The info page confirms that the real game was played in a WAP browser at `wap.littlescreen.co.uk`, while the PQA only displayed current character status and attack activity since last play.

## Recovery Assessment

This decompile adds one concrete backend action, `fun=aboutchar`, and preserves three bundled Palm-era UI images. It does not contain additional rooms, exits, NPC behavior, combat rules, inventory tables, or source code for the server-side game.
