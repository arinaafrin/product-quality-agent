# Operations FAQ — Product feed validation

### Where does the product feed come from?
The nightly feed is exported from the PIM (product information management) system
and dropped for ingestion. Each run produces one JSON array of product records.

### What happens to a rejected record?
Records with at least one `error`-severity failure are excluded from the import
and written to the failure log with the reason(s). They are **not** silently
dropped — the catalog team can see every rejection and its cause in the
dashboard, and can fix the source data and re-run the import.

### What is the difference between "rejected" and "passed with warnings"?
- **rejected**: at least one `error`-severity rule failed. The record does not
  get imported.
- **passed_with_warnings**: only `warning`-severity rules failed (currently
  only `invalid-category`). The record is imported, but flagged for review,
  because warnings usually indicate the taxonomy is out of date rather than
  bad data.

### Why did an import reject a lot of records at once?
In practice this is almost always one of three things:
1. A source system change (e.g. the PIM started exporting currency codes in
   a new format, or image URLs without the `https://` prefix), which shows up
   as many records failing the *same* rule.
2. A partial re-export, which shows up as `duplicate-sku` failures because
   the same SKUs appear twice in one feed.
3. A genuinely bad batch of new products entered without required fields.

When triaging, group failures by `ruleId` first — if 90% of failures are the
same rule, look for a systemic cause before treating it as 40 separate
data-entry mistakes.

### Can a rule be relaxed for a specific brand or supplier?
Not by editing the feed. Rule exceptions are configured in
`quality_engine.js` behind an allow-list, since the rules exist to protect
downstream systems (checkout, warehouse, search), not just to gate-keep
formatting.
