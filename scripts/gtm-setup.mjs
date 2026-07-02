#!/usr/bin/env node
/**
 * GTM Setup Script for EbookGamez
 *
 * This script uses the Google Tag Manager Management API to create and publish:
 *   - 6 Variables (GA4 Measurement ID + 5 Data Layer Variables)
 *   - 5 Triggers (All Pages + 4 custom event triggers)
 *   - 5 Tags (GA4 Configuration + view_item, begin_checkout, purchase, sign_up)
 *
 * Usage:
 *   node scripts/gtm-setup.mjs <GOOGLE_ACCESS_TOKEN>
 *
 * WARNING: This script is NOT idempotent. Running it more than once against the
 * same workspace will create duplicate tags, triggers, and variables. Only run it
 * once. If you need to rerun after a partial failure, first delete the "GA4 Setup"
 * workspace in GTM (Admin → Workspaces) before running again.
 *
 * To get a GOOGLE_ACCESS_TOKEN:
 *   1. Go to https://developers.google.com/oauthplayground/
 *   2. Select "Tag Manager API v2" scope:
 *      https://www.googleapis.com/auth/tagmanager.edit.containers
 *      https://www.googleapis.com/auth/tagmanager.publish
 *   3. Authorize and copy the access token (valid for 1 hour)
 *   4. Run: node scripts/gtm-setup.mjs "ya29...."
 */

const CONTAINER_PUBLIC_ID = "GTM-M7X424JG";
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || "G-86TGGPV1F3";
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";

const accessToken = process.argv[2];
if (!accessToken) {
  console.error("Usage: node scripts/gtm-setup.mjs <GOOGLE_ACCESS_TOKEN>");
  console.error("See file header for instructions on obtaining a token.");
  process.exit(1);
}

async function gtm(method, path, body) {
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
    throw new Error(`GTM API ${method} ${path} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function findAccountAndContainer() {
  const data = await gtm("GET", "/accounts");
  if (!data.account || data.account.length === 0) {
    throw new Error("No GTM accounts found. Check your access token has Tag Manager access.");
  }
  for (const account of data.account) {
    const containers = await gtm("GET", `/accounts/${account.accountId}/containers`);
    const container = (containers.container || []).find(
      (c) => c.publicId === CONTAINER_PUBLIC_ID
    );
    if (container) {
      return { accountId: account.accountId, containerId: container.containerId };
    }
  }
  throw new Error(
    `Container ${CONTAINER_PUBLIC_ID} not found in any of the ${data.account.length} GTM account(s) accessible with this token.`
  );
}

async function findOrCreateWorkspace(accountId, containerId) {
  const data = await gtm("GET", `/accounts/${accountId}/containers/${containerId}/workspaces`);
  const existing = (data.workspace || []).find(
    (w) => w.name === "GA4 Setup"
  );
  if (existing) {
    console.log(`Using existing workspace: ${existing.workspaceId}`);
    return existing.workspaceId;
  }
  const ws = await gtm("POST", `/accounts/${accountId}/containers/${containerId}/workspaces`, {
    name: "GA4 Setup",
    description: "GA4 Configuration, event tags, and triggers for EbookGamez",
  });
  console.log(`Created workspace: ${ws.workspaceId}`);
  return ws.workspaceId;
}

function workspacePath(accountId, containerId, workspaceId) {
  return `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
}

async function createVariables(path) {
  console.log("\nCreating variables...");

  const variables = [
    {
      name: "GA4 Measurement ID",
      type: "c",
      parameter: [{ type: "TEMPLATE", key: "value", value: GA4_MEASUREMENT_ID }],
    },
    {
      name: "DLV - ecommerce.value",
      type: "v",
      parameter: [
        { type: "INTEGER", key: "dataLayerVersion", value: "2" },
        { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
        { type: "TEMPLATE", key: "name", value: "ecommerce.value" },
      ],
    },
    {
      name: "DLV - ecommerce.transaction_id",
      type: "v",
      parameter: [
        { type: "INTEGER", key: "dataLayerVersion", value: "2" },
        { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
        { type: "TEMPLATE", key: "name", value: "ecommerce.transaction_id" },
      ],
    },
    {
      name: "DLV - ecommerce.currency",
      type: "v",
      parameter: [
        { type: "INTEGER", key: "dataLayerVersion", value: "2" },
        { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
        { type: "TEMPLATE", key: "name", value: "ecommerce.currency" },
      ],
    },
    {
      name: "DLV - ecommerce.items",
      type: "v",
      parameter: [
        { type: "INTEGER", key: "dataLayerVersion", value: "2" },
        { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
        { type: "TEMPLATE", key: "name", value: "ecommerce.items" },
      ],
    },
    {
      name: "DLV - method",
      type: "v",
      parameter: [
        { type: "INTEGER", key: "dataLayerVersion", value: "2" },
        { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
        { type: "TEMPLATE", key: "name", value: "method" },
      ],
    },
  ];

  const created = {};
  for (const v of variables) {
    const result = await gtm("POST", `${path}/variables`, v);
    console.log(`  Created variable: ${result.name} (${result.variableId})`);
    created[result.name] = result.variableId;
  }
  return created;
}

async function createTriggers(path) {
  console.log("\nCreating triggers...");

  const triggers = [
    { name: "All Pages", type: "PAGEVIEW" },
    {
      name: "CE - view_item",
      type: "CUSTOM_EVENT",
      customEventFilter: [
        {
          type: "EQUALS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
            { type: "TEMPLATE", key: "arg1", value: "view_item" },
          ],
        },
      ],
    },
    {
      name: "CE - begin_checkout",
      type: "CUSTOM_EVENT",
      customEventFilter: [
        {
          type: "EQUALS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
            { type: "TEMPLATE", key: "arg1", value: "begin_checkout" },
          ],
        },
      ],
    },
    {
      name: "CE - purchase",
      type: "CUSTOM_EVENT",
      customEventFilter: [
        {
          type: "EQUALS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
            { type: "TEMPLATE", key: "arg1", value: "purchase" },
          ],
        },
      ],
    },
    {
      name: "CE - sign_up",
      type: "CUSTOM_EVENT",
      customEventFilter: [
        {
          type: "EQUALS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
            { type: "TEMPLATE", key: "arg1", value: "sign_up" },
          ],
        },
      ],
    },
  ];

  const created = {};
  for (const t of triggers) {
    const result = await gtm("POST", `${path}/triggers`, t);
    console.log(`  Created trigger: ${result.name} (${result.triggerId})`);
    created[result.name] = result.triggerId;
  }
  return created;
}

async function createTags(path, triggerIds) {
  console.log("\nCreating tags...");

  function ecommerceParams(includeTransactionId = false) {
    const params = [
      {
        type: "MAP",
        map: [
          { type: "TEMPLATE", key: "name", value: "currency" },
          { type: "TEMPLATE", key: "value", value: "{{DLV - ecommerce.currency}}" },
        ],
      },
      {
        type: "MAP",
        map: [
          { type: "TEMPLATE", key: "name", value: "value" },
          { type: "TEMPLATE", key: "value", value: "{{DLV - ecommerce.value}}" },
        ],
      },
    ];
    if (includeTransactionId) {
      params.push({
        type: "MAP",
        map: [
          { type: "TEMPLATE", key: "name", value: "transaction_id" },
          { type: "TEMPLATE", key: "value", value: "{{DLV - ecommerce.transaction_id}}" },
        ],
      });
    }
    params.push({
      type: "MAP",
      map: [
        { type: "TEMPLATE", key: "name", value: "items" },
        { type: "TEMPLATE", key: "value", value: "{{DLV - ecommerce.items}}" },
      ],
    });
    return params;
  }

  const tags = [
    {
      name: "GA4 - Configuration",
      type: "googtag",
      parameter: [{ type: "TEMPLATE", key: "tagId", value: "{{GA4 Measurement ID}}" }],
      firingTriggerId: [triggerIds["All Pages"]],
      tagFiringOption: "ONCE_PER_EVENT",
    },
    {
      name: "GA4 - view_item",
      type: "gaawe",
      parameter: [
        { type: "TEMPLATE", key: "eventName", value: "view_item" },
        { type: "LIST", key: "eventParameters", list: ecommerceParams() },
        { type: "TAG_REFERENCE", key: "measurementId", value: "GA4 - Configuration" },
      ],
      firingTriggerId: [triggerIds["CE - view_item"]],
      tagFiringOption: "ONCE_PER_EVENT",
    },
    {
      name: "GA4 - begin_checkout",
      type: "gaawe",
      parameter: [
        { type: "TEMPLATE", key: "eventName", value: "begin_checkout" },
        { type: "LIST", key: "eventParameters", list: ecommerceParams() },
        { type: "TAG_REFERENCE", key: "measurementId", value: "GA4 - Configuration" },
      ],
      firingTriggerId: [triggerIds["CE - begin_checkout"]],
      tagFiringOption: "ONCE_PER_EVENT",
    },
    {
      name: "GA4 - purchase",
      type: "gaawe",
      parameter: [
        { type: "TEMPLATE", key: "eventName", value: "purchase" },
        { type: "LIST", key: "eventParameters", list: ecommerceParams(true) },
        { type: "TAG_REFERENCE", key: "measurementId", value: "GA4 - Configuration" },
      ],
      firingTriggerId: [triggerIds["CE - purchase"]],
      tagFiringOption: "ONCE_PER_EVENT",
    },
    {
      name: "GA4 - sign_up",
      type: "gaawe",
      parameter: [
        { type: "TEMPLATE", key: "eventName", value: "sign_up" },
        {
          type: "LIST",
          key: "eventParameters",
          list: [
            {
              type: "MAP",
              map: [
                { type: "TEMPLATE", key: "name", value: "method" },
                { type: "TEMPLATE", key: "value", value: "{{DLV - method}}" },
              ],
            },
          ],
        },
        { type: "TAG_REFERENCE", key: "measurementId", value: "GA4 - Configuration" },
      ],
      firingTriggerId: [triggerIds["CE - sign_up"]],
      tagFiringOption: "ONCE_PER_EVENT",
    },
  ];

  for (const tag of tags) {
    const result = await gtm("POST", `${path}/tags`, tag);
    console.log(`  Created tag: ${result.name} (${result.tagId})`);
  }
}

async function publishWorkspace(accountId, containerId, workspaceId) {
  console.log("\nCreating container version...");
  const version = await gtm(
    "POST",
    `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}:create_version`,
    {
      name: "GA4 Setup v1",
      notes: "GA4 Configuration tag + event tags for view_item, begin_checkout, purchase, sign_up",
    }
  );
  const versionId = version.containerVersion.containerVersionId;
  console.log(`  Version created: ${versionId}`);

  console.log("Publishing container version...");
  const published = await gtm(
    "POST",
    `/accounts/${accountId}/containers/${containerId}/versions/${versionId}:publish`
  );
  console.log(`  Published! Live version: ${published.containerVersion.containerVersionId}`);
  return published;
}

async function main() {
  console.log("=== EbookGamez GTM Setup ===");
  console.log(`Container: ${CONTAINER_PUBLIC_ID}`);
  console.log(`GA4 Measurement ID: ${GA4_MEASUREMENT_ID}`);

  const { accountId, containerId } = await findAccountAndContainer();
  console.log(`\nAccount ID: ${accountId}`);
  console.log(`Container ID: ${containerId}`);

  const workspaceId = await findOrCreateWorkspace(accountId, containerId);
  const path = workspacePath(accountId, containerId, workspaceId);

  await createVariables(path);
  const triggerIds = await createTriggers(path);
  await createTags(path, triggerIds);
  await publishWorkspace(accountId, containerId, workspaceId);

  console.log("\n=== Done! ===");
  console.log("The GTM container is now published with GA4 tracking.");
  console.log(`Verify in GTM: https://tagmanager.google.com/#/container/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`);
  console.log(`Verify in GA4: https://analytics.google.com → Reports → Realtime`);
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
