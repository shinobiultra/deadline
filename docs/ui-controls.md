# UI Controls Audit

Every button in deadLINE should justify itself by either changing core deadline state, changing visualization clarity, or reducing time-to-understanding.

## Stage Header

| Control       | Why it exists                                                   | Keep if...                                             |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| `2d map`      | fastest global context for civil vs solar comparison            | user can instantly inspect seam/wrap + bands           |
| `3d globe`    | cinematic but still analytical lens for day/night + line drift  | line visibility remains high, controls stay responsive |
| `detail zoom` | local street-level lens for following line movement near places | enters/exits cleanly without mode confusion            |
| `snap`        | exports current state for sharing/debug/review                  | captures deterministic screenshot with overlays        |
| `debug`       | layout/perf diagnostics for development                         | not shown by default in user workflow                  |

## Active Deadline Manager

| Control           | Why it exists                            | Guardrail                                       |
| ----------------- | ---------------------------------------- | ----------------------------------------------- |
| slot selector     | switch between saved deadlines quickly   | one-click switch + visible active target banner |
| `new`             | add another tracked deadline             | capped slot count                               |
| `dup`             | clone current deadline as starting point | avoids retyping                                 |
| `lock` / `unlock` | prevent accidental edits                 | lock state shown as chip                        |
| `del` / `confirm` | remove active slot                       | two-step confirm + cannot delete last slot      |
| slot name input   | semantic naming for quick recognition    | enter/blur commits rename                       |
| `apply`           | commit draft to active slot              | only visible when dirty                         |
| `discard`         | revert draft changes                     | only visible when dirty                         |

## Deadline Input

| Control                                                                    | Why it exists                      | Notes                                        |
| -------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------- |
| date input + calendar icon                                                 | primary deadline date entry        | icon embedded to avoid overlap               |
| time input + clock icon                                                    | primary deadline time entry        | monospace for readability                    |
| quick adjust chips (`-1d`, `-1h`, `-15m`, `+15m`, `+1h`, `+1d`, `now+24h`) | fast nudges during planning        | affects draft only                           |
| timezone search                                                            | fast tz discovery (`city/tz/utc+`) | searchable first, select second              |
| timezone select                                                            | deterministic IANA selection       | includes current offset labels               |
| `local` / `utc` / `aoe` / `hard stop`                                      | common one-click presets           | `aoe` supports global hard deadline use case |
| DST chooser (`earlier` / `later`)                                          | resolves ambiguous local times     | shown only when needed                       |

## Location + Layers

| Control                                                | Why it exists                           |
| ------------------------------------------------------ | --------------------------------------- |
| city chips                                             | quick location pin                      |
| `use location`                                         | geolocation-driven distance context     |
| `clear`                                                | remove pin/distance noise               |
| `civil` / `solar` / `day/night` / `landmarks` switches | layer control without opening settings  |
| `time view` segmented (`now` / `deadline` / `scrub`)   | explicit temporal lens                  |
| `warp` slider                                          | scrub timeline between now and deadline |

## In-View Map/Globe Controls

| Control                      | Why it exists                                |
| ---------------------------- | -------------------------------------------- |
| `reset view` (2d)            | deterministic return from pan/zoom drift     |
| `reset orbit` (3d)           | restore canonical framing after manual orbit |
| `follow line` (detail)       | keep moving line in frame                    |
| `zoom to line` (detail)      | fast recenter around moving line             |
| `building close-up` (detail) | demonstrate high-detail local motion         |

## Settings Drawer

| Control                             | Why it exists                                  |
| ----------------------------------- | ---------------------------------------------- |
| `apparent solar`                    | nerd-accuracy toggle (equation-of-time mode)   |
| `bright daytime lighting`           | visual preference for day hemisphere intensity |
| `accuracy mode (timezone polygons)` | optional true-zone civil matching              |
| `civil glow tolerance` slider       | tune civil highlight strictness                |
| alert threshold chips               | select which time-to-deadline alerts fire      |
| `landmark crossing alerts`          | toasts for line crossing landmarks             |
| `reduced motion`                    | accessibility + perf fallback                  |
| `browser notifications`             | optional background alert channel              |

## Removal Criteria

A control should be removed if it fails one of:

1. reduces a high-frequency user action from 2+ steps to 1 step.
2. reveals a core concept (deadline instant, solar/civil divergence, location delta).
3. improves safety (prevents accidental overwrite/destructive change).
4. supports debug/deploy reliability for a known failure mode.
