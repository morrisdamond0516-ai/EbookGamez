#!/usr/bin/env node
/**
 * GA4 Conversion Events Setup for EbookGamez
 *
 * This script uses the Google Analytics Admin API v1beta to mark
 * 'purchase', 'sign_up', 'subscription_upgrade', 'begin_checkout',
 * 'view_item', and 'billing_interval_to_annual' as conversion events in the
 * GA4 property associated with measurement ID G-86TGGPV1F3.
 *
 * It is idempotent: running it more than once will not create duplicates.
 * Events that are already marked as conversions are reported and skipped.
 *
 * Usage:
 *   node scripts/ga4-conversions-setup.mjs <GOOGLE_ACCESS_TOKEN>
 *
 * To get a GOOGLE_ACCESS_TOKEN:
 *   1. Go to https://developers.google.com/oauthplayground/
 *   2. Select the "Google Analytics Admin API v1beta" scope:
 *        https://www.googleapis.com/auth/analytics.edit
 *   3. Authorize and copy the access token (valid for 1 hour)
 *   4. Run: node scripts/ga4-conversions-setup.mjs "ya29...."
 *
 * Required scope: https://www.googleapis.com/auth/analytics.edit
 */

const GA4_MEASUREMENT_ID = "G-86TGGPV1F3";
const CONVERSION_EVENTS = ["purchase", "sign_up", "subscription_upgrade", "begin_checkout", "view_item", "billing_interval_to_annual"];
const BASE = "https://analyticsadmin.googleapis.com/v1beta";

const accessToken = process.argv[2];
if (!accessToken) {
  console.error("Usage: node scripts/ga4-conversions-setup.mjs <GOOGLE_ACCESS_TOKEN>");
  console.error("See file header for instructions on obtaining a token.");
  process.exit(1);
}

async function ga4(method, path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`GA4 Admin API ${method} ${path} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function findPropertyForMeasurementId(measurementId) {
  console.log("Fetching account summaries to locate property...");
  const data = await ga4("GET", "/accountSummaries?pageSize=200");
  const summaries = data.accountSummaries || [];

  for (const account of summaries) {
    for (const propertySummary of account.propertySummaries || []) {
      const propertyId = propertySummary.property.replace("properties/", "");
      try {
        const streams = await ga4("GET", `/properties/${propertyId}/dataStreams`);
        for (const stream of streams.dataStreams || []) {
          const webData = stream.webStreamData;
          if (webData && webData.measurementId === measurementId) {
            console.log(`Found property: ${propertySummary.displayName} (${propertySummary.property})`);
            return propertyId;
          }
        }
      } catch {
        // Skip properties we don't have access to
      }
    }
  }
  throw new Error(
    `No GA4 property found with measurement ID ${measurementId}. ` +
    "Ensure the token has access to the correct Google Analytics account."
  );
}

async function getExistingConversionEvents(propertyId) {
  const data = await ga4("GET", `/properties/${propertyId}/conversionEvents`);
  return new Set((data.conversionEvents || []).map((e) => e.eventName));
}

async function createConversionEvent(propertyId, eventName) {
  return ga4("POST", `/properties/${propertyId}/conversionEvents`, { eventName });
}

async function main() {
  console.log("=== EbookGamez GA4 Conversion Events Setup ===");
  console.log(`Target measurement ID: ${GA4_MEASUREMENT_ID}`);
  console.log(`Events to mark as conversions: ${CONVERSION_EVENTS.join(", ")}\n`);

  const propertyId = await findPropertyForMeasurementId(GA4_MEASUREMENT_ID);

  console.log("\nChecking existing conversion events...");
  const existing = await getExistingConversionEvents(propertyId);
  console.log(`Currently marked as conversions: ${[...existing].join(", ") || "(none)"}`);

  console.log("\nConfiguring conversion events...");
  for (const eventName of CONVERSION_EVENTS) {
    if (existing.has(eventName)) {
      console.log(`  [SKIPPED] '${eventName}' is already a conversion event.`);
    } else {
      const result = await createConversionEvent(propertyId, eventName);
      console.log(`  [CREATED] '${eventName}' marked as conversion (name: ${result.name})`);
    }
  }

  console.log("\n=== Done! ===");
  console.log("Verify in GA4: Admin > Conversions");
  console.log(`Direct link: https://analytics.google.com/analytics/web/#/p${propertyId}/admin/conversions`);
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
