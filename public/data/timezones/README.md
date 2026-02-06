# Optional Timezone Polygon Dataset

To enable accuracy mode in the app, add:

- `public/data/timezones/timezones.geojson`

Expected format:

- GeoJSON `FeatureCollection`
- Polygon or MultiPolygon features
- A timezone property key on each feature. Accepted keys include:
  - `tzid`
  - `TZID`
  - `timezone`
  - `zone`
  - `name`
  - `tz_name`
- Values should be valid IANA IDs (for example `Europe/Prague`).

Notes:

- Recommended source: timezone-boundary-builder output.
- If sourced from OSM-derived data, keep ODbL attribution and notices in `data/timezones/`.
