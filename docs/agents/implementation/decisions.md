# Decisions

## D-001: default civil layer uses UTC offset stripes
Reason: zero-license friction, minimal payload, clear civil-vs-solar comparison.

## D-002: use equation-of-time approximation toggle
Reason: preserves nerd mode while keeping implementation small and deterministic.

## D-003: 2D projection is equirectangular for terminator shading simplicity
Reason: reliable day/night polygon fill and straightforward line rendering.
