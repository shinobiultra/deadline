# UI Controls Audit (Map-First v1)

Every visible control must justify itself by reducing friction on a core action: set deadline, understand where it is, or share/snapshot it.

## Always-Visible Controls

| Control         | Why it exists                                                | Remove if...                                      |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| `deadline chip` | primary entry point to active target and edit workflow       | users can’t immediately identify current deadline |
| `2d`            | fastest global understanding of line position                | 3d alone can cover map-level comprehension        |
| `3d`            | physical day/night intuition and spatial sweep understanding | it doesn’t add information beyond 2d              |
| `snap`          | one-click visual export for updates/review                   | screenshots are not used operationally            |
| `share`         | one-click state URL for collaboration/repro                  | encoded state links are not consumed              |
| `layers`        | single home for map/lens/effect toggles                      | layer state can be changed without a panel        |
| `countdown hud` | immediate urgency cue + gateway to detailed metrics          | users don’t need persistent time-to-deadline      |

## Deadline Drawer Controls

| Control                       | Why it exists                          | Guardrail                          |
| ----------------------------- | -------------------------------------- | ---------------------------------- |
| slot selector                 | switch tracked deadlines in one action | active slot always visible in chip |
| `new`                         | create additional deadline slot        | capped slot count                  |
| `dup`                         | clone existing deadline quickly        | avoids repetitive entry            |
| `lock`                        | prevent accidental edits               | lock state reflected in chip pill  |
| `delete` + confirm phrase     | safe destructive action                | explicit confirmation required     |
| slot name input               | human-friendly identification          | commits on blur                    |
| date/time inputs              | canonical deadline definition          | no auto-commit to active slot      |
| quick adjust chips            | common deadline nudges                 | edits draft only                   |
| timezone search/select        | fast + deterministic IANA selection    | searchable plus explicit select    |
| `local` / `utc` / `aoe` chips | high-frequency timezone shortcuts      | one-click update                   |
| `apply`                       | commit draft to active slot            | shown only when dirty              |
| `discard`                     | revert draft safely                    | shown only when dirty              |
| `use location`                | direct geolocation context             | explicit permission gate           |
| `pick on map`                 | manual spatial location input          | armed state + toast feedback       |
| `clear`                       | remove location context quickly        | immediate reset                    |

## Layers Panel Controls

| Control                                                         | Why it exists                                             |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| base style segmented (`deadLINE dark`, `osm light`, `osm dark`) | quick basemap readability changes                         |
| overlay switches (`solar`, `civil`, `terminator`, `landmarks`)  | isolate conceptual layers                                 |
| detail lens segmented (`auto`, `off`, `on`)                     | control high-detail map activation without mode sprawl    |
| effects segmented (`off`, `subtle`, `spicy`)                    | balance visual punch vs performance                       |
| legend expander                                                 | decodes color semantics without permanent overlay clutter |

## Info Drawer Controls

| Control                      | Why it exists                                  |
| ---------------------------- | ---------------------------------------------- |
| close button                 | fast dismissal                                 |
| stats/details expanders      | optional depth without always-visible clutter  |
| debug actions (when enabled) | developer diagnostics isolated from default UX |

## Removal Rules

A control should be deleted if it fails all:

1. Cuts a frequent flow from 2+ interactions to 1.
2. Clarifies a core concept (deadline instant, civil vs solar, location delta).
3. Adds safety (draft/apply/lock/confirm).
4. Supports a tested operational need (share/snap/debug/deploy reliability).
