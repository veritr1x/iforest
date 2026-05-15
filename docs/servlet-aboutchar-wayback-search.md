# Servlet `aboutchar` Wayback Search

Search date: 2026-05-15

## Starting Clue

The Palm PQA decompile exposes a character-status form:

- action: `http://wap.littlescreen.co.uk/servlets/mfr`
- hidden field: `fun=aboutchar`
- credential fields: `user`, `pwd`

The bundled info page says this Palm clipping app was only for current character status and activity since last play, while the actual game ran through a WAP browser at `wap.littlescreen.co.uk`.

## CDX Evidence Saved

Query results are saved under `evidence/wayback/servlet-clue-cdx`.

The targeted prefix searches checked:

- `http://wap.littlescreen.co.uk/servlets/mfr`
- `http://littlescreen.co.uk/servlets/mfr`
- `http://www.littlescreen.co.uk/servlets/mfr`
- `https://wap.littlescreen.co.uk/servlets/mfr`
- `http://useeverything.com/servlets/mfr`
- `http://www.useeverything.com/servlets/mfr`
- `http://wap.useeverything.com/servlets/mfr`
- `https://useeverything.com/servlets/mfr`
- exact `?fun=aboutchar` prefixes on the same likely hosts

Additional filtered searches checked for `aboutchar` anywhere in archived URLs for:

- `*.useeverything.com/*`
- `*.littlescreen.co.uk/*`

## Result

No Wayback CDX capture was found for `fun=aboutchar` on either domain.

No `servlets/mfr` capture was found for `wap.littlescreen.co.uk`, even though the PQA points there. The only useful `mfr` captures are under `useeverything.com/servlets/mfr`.

The `useeverything.com/servlets/mfr` prefix currently yields seven indexed rows:

- `20041109051542` - `http://useeverything.com:80/servlets/mfr` - login WML
- `20041110082204` - `http://useeverything.com:80/servlets/mfr?new=false&amp` - same login digest
- `20041110081931` - `http://useeverything.com:80/servlets/mfr?new=true&amp` - same login digest
- `20061127142228` - `http://useeverything.com/servlets/mfr?fun=spycamera` - HTML login gate
- `20061127142235` - `http://useeverything.com/servlets/mfr?fun=spycamera&view=marker` - HTML login gate
- `20100202004805` - `http://useeverything.com:80/servlets/mfr?new=false&uid=$(uid)&pwd=$(pwd)` - archived 404
- `20100202005426` - `http://useeverything.com:80/servlets/mfr?new=true&uid=$(uid)&pwd=$(pwd)` - archived 404

The broader filtered servlet inventory for `useeverything.com` has 37 rows, consisting of known `Driver`, `mfr`, and `vdriver` captures. It does not add `aboutchar`. The `vdriver` rows appear to belong to Vampire Country, not iForest.

## Raw Files Added

The earlier `spycamera` files included the Wayback wrapper. These raw `id_` downloads preserve the actual captured login gates:

- `evidence/wayback/raw/servlet/20061127142228_useeverything.com_servlets_mfr_fun_spycamera_id.html`
- `evidence/wayback/raw/servlet/20061127142235_useeverything.com_servlets_mfr_fun_spycamera_view_marker_id.html`

Both pages require an iForest login and password before showing camera or marker data. They use `uid` and `pwd`, while the PQA `aboutchar` form uses `user` and `pwd`.

## Reconstruction Impact

This confirms `fun=aboutchar` as a real backend action exposed by the Palm clipping app, but not as an archived response. We can rebuild a plausible character-status screen from the PQA intent:

- login form for username/password
- character status summary
- likely current-location and carried-item output
- likely recent attack/activity output, based on the PQA info page

We still cannot recover the exact server response layout, live player data fields, room graph, object table, or backend implementation from Wayback alone.
