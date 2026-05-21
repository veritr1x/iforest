# Common Crawl Search

Search date: 2026-05-21

## Saved Evidence

A focused Common Crawl pass preserved independent copies under `evidence/commoncrawl`.

- `manifest.json` lists every saved raw body, original URL, index, byte size, and SHA-256.
- `cdx/` contains the Common Crawl CDX responses used for positive and negative checks.
- `raw/` contains stripped response bodies plus `.meta.json` sidecars with ARC headers and source ranges.

## Positive Captures

- `CC-MAIN-2008-2009` has 40 `useeverything.com/*` 200-status captures, including `iforest/iForest.pqa`, iForest help pages, `whattodo.htm`, `valleyhelp.htm`, site contact/tech pages, and sibling UseEverything/Vampire pages.
- `CC-MAIN-2008-2009` and `CC-MAIN-2009-2010` preserve `wap.useeverything.com/`. The 2008 and 2009 WML root payload points to `http://useeverything.com/servlets/Intro1`.
- `CC-MAIN-2008-2009` preserves `wap.littlescreen.co.uk/` with the same WML root payload as `wap.useeverything.com/`.
- Common Crawl also has later root captures for `littlescreen.co.uk`, and 2010 placeholder or empty responses showing the WAP services were no longer serving the useful game entry.

Representative saved files:

- `evidence/commoncrawl/raw/20080518072823_www.useeverything.com_iforest_iForest.pqa.pqa`
- `evidence/commoncrawl/raw/20080516203149_www.useeverything.com_iforest_valleyhelp.htm.html`
- `evidence/commoncrawl/raw/20080518072815_www.useeverything.com_iforest_whattodo.htm.html`
- `evidence/commoncrawl/raw/20080511184114_wap.useeverything.com_root.wml`
- `evidence/commoncrawl/raw/20080511185424_wap.littlescreen.co.uk_root.wml`

## Negative Checks

Older Common Crawl indexes through `CC-MAIN-2013-48` were checked for:

- `useeverything.com/servlets/*`
- `useeverything.com/servlets/Driver*`
- `useeverything.com/servlets/mfr*`
- `wap.useeverything.com/other/*`
- `wap.useeverything.com/openwave/*`
- `wap.useeverything.com/if*`
- `wap.useeverything.com/index.wml`
- `wap.useeverything.com/if.wml`
- `littlescreen.co.uk/iforest/*`
- `littlescreenmedia.com/*`

No 200-status Common Crawl rows were found for those missing backend or WAP-path targets.

## Recovery Impact

This is useful corroboration, not a new game-data source. It gives clean non-Wayback copies of public pages and the PQA, and confirms the WAP root routing to `/servlets/Intro1`. It still does not recover Java servlet source, XML location files, player/object state, or hidden room graph data.
