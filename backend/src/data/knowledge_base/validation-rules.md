# Product feed validation rules

_This file is generated from `backend/src/quality_engine.js` — do not edit by hand,
run `node scripts/build-kb.js` instead._

## Missing product title (`missing-title`)

**Severity:** error

Every record must have a non-empty `title`. Titles are used for search indexing, so a missing title makes the product invisible to customers even if it is otherwise valid.

## Missing or invalid price (`invalid-price`)

**Severity:** error

The `price` field must be present, numeric, and greater than 0. Negative, zero, or non-numeric prices are rejected outright because they would either break checkout or let an item be purchased for free.

## Unsupported currency code (`invalid-currency`)

**Severity:** error

The `currency` field must be one of: EUR, USD, GBP, SEK, DKK, NOK. Unsupported currencies are rejected because downstream pricing and tax logic does not have conversion rates configured for them.

## Broken or malformed image URL (`broken-image`)

**Severity:** error

The `imageUrl` must be a valid HTTPS URL ending in .jpg, .jpeg, .png, or .webp. This catches the most common feed error: a relative path, a http:// link, or a CDN URL that was truncated during export.

## Unrecognized category (`invalid-category`)

**Severity:** warning

The `category` field should be one of: lighting, furniture, textiles, tableware, decor, outdoor, kids. This is a warning rather than a hard error because new categories are sometimes introduced ahead of the taxonomy being updated, but it should be reviewed.

## Malformed SKU (`invalid-sku-format`)

**Severity:** error

A SKU must match the pattern `LETTERS-DIGITS` (2-5 letters, a dash, 3-8 digits), e.g. `FDS-10234`. Malformed SKUs cannot be matched against the warehouse system.

## Duplicate SKU within the same feed (`duplicate-sku`)

**Severity:** error

Each SKU must appear only once per feed. Duplicate SKUs usually mean the export job ran twice or two source systems disagree about the same product, and importing both would create a race condition on stock levels.
