/**
 * ============================================================
 * copy-cldy-dashboards.js
 * ============================================================
 *
 * Cloudability Dashboard / Tab / Widget Copy Utility
 *
 * Supported operations:
 * - dashboard-copy
 * - full-tab-to-existing-dashboard
 * - full-tab-to-new-dashboard
 * - widgets-to-existing-tab
 * - widgets-to-new-tab
 *
 * Execution is controlled via:
 * - operations.json
 *
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

/* ============================================================
 * UTILITIES
 * ============================================================
 */

/**
 * Sleep helper used to prevent API bursts.
 */
const wait = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Build API headers.
 */
function buildHeaders(token) {

  return {
    "Authorization":
      `Basic ${Buffer.from(token).toString("base64")}`,

    "Content-Type": "application/json"
  };
}

/**
 * Standardized HTTP wrapper.
 */
async function httpRequest(
  url,
  options = {}
) {

  console.log(
    `\n🌐 ${options.method || "GET"} ${url}`
  );

  const response =
    await fetch(url, options);

  if (!response.ok) {

    const text =
      await response.text();

    console.error(
      "\n❌ HTTP ERROR RESPONSE:"
    );

    console.error(text);

    throw new Error(
      `HTTP ${response.status}: ${text}`
    );
  }

  return response.json();
}

/* ============================================================
 * CONFIGURATION
 * ============================================================
 */

const configPath = path.join(
  __dirname,
  "./copy-cldy-dashboards.config.json"
);

if (!fs.existsSync(configPath)) {

  console.error(
    "❌ Missing configuration file"
  );

  process.exit(1);
}

const config = JSON.parse(
  fs.readFileSync(configPath, "utf8")
);

const SRC_BASE =
  config.source.src_endpoint;

const SRC_HEADERS =
  buildHeaders(
    config.source.src_token
  );

const DEST_BASE =
  config.destination.dest_endpoint;

const DEST_HEADERS =
  buildHeaders(
    config.destination.dest_token
  );

/* ============================================================
 * LOAD OPERATIONS
 * ============================================================
 */

const operationsPath = path.join(
  __dirname,
  "./operations.json"
);

if (!fs.existsSync(operationsPath)) {

  console.error(
    "❌ Missing operations.json"
  );

  process.exit(1);
}

const operations = JSON.parse(
  fs.readFileSync(
    operationsPath,
    "utf8"
  )
);

/* ============================================================
 * DASHBOARD HELPERS
 * ============================================================
 */

/**
 * Fetch dashboard with widgets and tabs.
 */
async function getDashboard(
  baseUrl,
  headers,
  dashboardId
) {

  return httpRequest(
    `${baseUrl}/v3/internal/dashboards/${dashboardId}?include_widgets=true&limit=500&use_basic_user=true`,
    {
      method: "GET",
      headers
    }
  );
}

/**
 * Create dashboard.
 */
async function createDashboard(
  name
) {

  if (
    !name ||
    typeof name !== "string" ||
    name.trim().length < 2
  ) {

    throw new Error(
      `Invalid dashboard name: "${name}"`
    );
  }

  const result =
    await httpRequest(
      `${DEST_BASE}/v3/internal/dashboards`,
      {
        method: "POST",

        headers: DEST_HEADERS,

        body: JSON.stringify({
          name: name.trim(),
          owned_by_user: true,
          star: false
        })
      }
    );

  console.log(
    `✅ Created dashboard "${name}" (${result.id})`
  );

  return result;
}

/* ============================================================
 * TAB HELPERS
 * ============================================================
 */

/**
 * Create dashboard tab.
 */
async function createTab({

  dashboardId,
  tabName

}) {

  const result =
    await httpRequest(
      `${DEST_BASE}/v3/internal/dashboards/${dashboardId}/tabs`,
      {
        method: "POST",

        headers: DEST_HEADERS,

        body: JSON.stringify({
          name: tabName
        })
      }
    );

  let createdTabId = null;

  /**
   * Some environments return:
   * meta.created_tab_id
   */
  if (
    result?.meta?.created_tab_id
  ) {

    createdTabId =
      result.meta.created_tab_id;
  }

  /**
   * Other environments return:
   * result.tabs[]
   */
  else if (
    result?.result?.tabs &&
    result.result.tabs.length > 0
  ) {

    const lastTab =
      result.result.tabs[
        result.result.tabs.length - 1
      ];

    createdTabId = lastTab.id;
  }

  if (!createdTabId) {

    console.error(
      JSON.stringify(result, null, 2)
    );

    throw new Error(
      "Tab creation failed: missing created_tab_id"
    );
  }

  const createdTab = {
    id: createdTabId,
    name: tabName
  };

  console.log(
    `✅ Created tab "${tabName}" (${createdTab.id})`
  );

  return createdTab;
}

/**
 * Rename tab.
 */
async function renameTab({

  dashboardId,
  tabId,
  newName

}) {

  await httpRequest(
    `${DEST_BASE}/v3/internal/dashboards/${dashboardId}/tabs/${tabId}`,
    {
      method: "PUT",

      headers: DEST_HEADERS,

      body: JSON.stringify({
        name: newName
      })
    }
  );

  console.log(
    `✅ Renamed tab "${tabId}" -> "${newName}"`
  );
}

/**
 * Find tab by name.
 */
function getTabByName(
  dashboard,
  tabName
) {

  const tab =
    dashboard.tabs.find(
      t => t.name === tabName
    );

  if (!tab) {

    throw new Error(
      `Tab not found: ${tabName}`
    );
  }

  return tab;
}

/* ============================================================
 * WIDGET HELPERS
 * ============================================================
 */

/**
 * Get widgets belonging to tab.
 */
function getWidgetsByTab(
  dashboard,
  tabId
) {

  return (
    dashboard.widgets || []
  ).filter(
    widget =>
      String(widget.tab_id) ===
      String(tabId)
  );
}

/**
 * Normalize widget payload before POST.
 */
function normalizeWidget(widget) {

  const cleaned =
    structuredClone(widget);

  delete cleaned.id;
  delete cleaned.created_at;
  delete cleaned.updated_at;

  if (
    cleaned.options &&
    Array.isArray(
      cleaned.options.layers
    )
  ) {

    cleaned.options.layers =
      cleaned.options.layers.map(
        layer => {

          const normalizedLayer = {
            ...layer
          };

          /**
           * Normalize filter shape.
           */
          normalizedLayer.filters = [];

          return normalizedLayer;
        }
      );
  }

  return cleaned;
}

/**
 * Copy single widget.
 */
async function copyWidget({

  widget,
  destinationDashboardId,
  destinationTabId

}) {

  if (!destinationTabId) {

    throw new Error(
      `Missing destinationTabId for widget: ${widget.name}`
    );
  }

  const payload =
    normalizeWidget(widget);

  payload.dashboard_id =
    destinationDashboardId;

  /**
   * Widget API expects string tab_id.
   */
  payload.tab_id =
    String(destinationTabId);

  const result =
    await httpRequest(
      `${DEST_BASE}/v3/internal/widgets`,
      {
        method: "POST",

        headers: DEST_HEADERS,

        body: JSON.stringify(payload)
      }
    );

  console.log(
    `✅ Copied widget "${widget.name}"`
  );

  return result;
}

/**
 * Copy widgets sequentially.
 */
async function copyWidgets({

  widgets,
  destinationDashboardId,
  destinationTabId

}) {

  let successCount = 0;
  let failureCount = 0;

  for (const widget of widgets) {

    try {

      await copyWidget({

        widget,

        destinationDashboardId,

        destinationTabId

      });

      successCount++;

      console.log(
        `✅ Widget copied: ${widget.name}`
      );

    } catch (err) {

      failureCount++;

      console.error(
        `❌ Widget failed: ${widget.name}`
      );

      console.error(err.message);
    }

    await wait(300);
  }

  console.log("\n==================================================");

  console.log(
    `✅ Widgets copied successfully: ${successCount}`
  );

  console.log(
    `❌ Widget failures: ${failureCount}`
  );

  console.log("==================================================");
}


/* ============================================================
 * OPERATIONS
 * ============================================================
 */

/**
 * Copy entire dashboard.
 *
 * Uses destination dashboard's default tab.
 */
async function copyEntireDashboard({

  sourceDashboardId,
  newDashboardName

}) {

  console.log("\n==================================================");

  console.log(
    "FULL DASHBOARD COPY"
  );

  console.log("==================================================");

  const sourceDashboard =
    await getDashboard(
      SRC_BASE,
      SRC_HEADERS,
      sourceDashboardId
    );

  const destinationDashboard =
    await createDashboard(
      newDashboardName
    );

  /**
   * Wait for default tab creation.
   */
  await wait(2000);

  const refreshedDashboard =
    await getDashboard(
      DEST_BASE,
      DEST_HEADERS,
      destinationDashboard.id
    );

  if (
    !refreshedDashboard.tabs ||
    refreshedDashboard.tabs.length === 0
  ) {

    throw new Error(
      "Destination dashboard has no tabs"
    );
  }

  /**
   * Use default tab.
   */
  const defaultTab =
    refreshedDashboard.tabs[0];

  console.log(
    `✅ Using default tab "${defaultTab.name}" (${defaultTab.id})`
  );

  for (const widget of sourceDashboard.widgets) {

    await copyWidget({

      widget,

      destinationDashboardId:
        destinationDashboard.id,

      destinationTabId:
        defaultTab.id

    });

    await wait(300);
  }

  console.log(
    "\n✅ FULL DASHBOARD COPY COMPLETE"
  );
}

/**
 * Copy full tab into existing dashboard.
 */
async function copyFullTabToExistingDashboard({

  sourceDashboardId,
  sourceTabName,

  destinationDashboardId,
  newTabName

}) {

  console.log("\n==================================================");

  console.log(
    "COPY FULL TAB -> EXISTING DASHBOARD"
  );

  console.log("==================================================");

  const sourceDashboard =
    await getDashboard(
      SRC_BASE,
      SRC_HEADERS,
      sourceDashboardId
    );

  const sourceTab =
    getTabByName(
      sourceDashboard,
      sourceTabName
    );

  const widgets =
    getWidgetsByTab(
      sourceDashboard,
      sourceTab.id
    );

  console.log(
    `✅ Widgets found: ${widgets.length}`
  );

  const destinationTab =
    await createTab({

      dashboardId:
        destinationDashboardId,

      tabName:
        newTabName

    });

  await copyWidgets({

    widgets,

    destinationDashboardId,

    destinationTabId:
      destinationTab.id

  });

  console.log(
    "\n✅ FULL TAB COPY COMPLETE"
  );
}

/**
 * Copy full tab into new dashboard.
 *
 * Uses default dashboard tab.
 */
async function copyFullTabToNewDashboard({

  sourceDashboardId,
  sourceTabName,

  newDashboardName

}) {

  console.log("\n==================================================");

  console.log(
    "COPY FULL TAB -> NEW DASHBOARD"
  );

  console.log("==================================================");

  const sourceDashboard =
    await getDashboard(
      SRC_BASE,
      SRC_HEADERS,
      sourceDashboardId
    );

  const sourceTab =
    getTabByName(
      sourceDashboard,
      sourceTabName
    );

  const widgets =
    getWidgetsByTab(
      sourceDashboard,
      sourceTab.id
    );

  console.log(
    `✅ Widgets found: ${widgets.length}`
  );

  const destinationDashboard =
    await createDashboard(
      newDashboardName
    );

  /**
   * Wait for default tab creation.
   */
  await wait(2000);

  const refreshedDashboard =
    await getDashboard(
      DEST_BASE,
      DEST_HEADERS,
      destinationDashboard.id
    );

  if (
    !refreshedDashboard.tabs ||
    refreshedDashboard.tabs.length === 0
  ) {

    throw new Error(
      "Destination dashboard has no tabs"
    );
  }

  const defaultTab =
    refreshedDashboard.tabs[0];

  console.log(
    `✅ Using default tab "${defaultTab.name}" (${defaultTab.id})`
  );

  /**
   * Rename default tab.
   */
  await renameTab({

    dashboardId:
      destinationDashboard.id,

    tabId:
      defaultTab.id,

    newName:
      sourceTab.name

  });

  /**
   * Copy widgets into renamed tab.
   */
  await copyWidgets({

    widgets,

    destinationDashboardId:
      destinationDashboard.id,

    destinationTabId:
      defaultTab.id

  });

  console.log(
    "\n✅ FULL TAB -> NEW DASHBOARD COMPLETE"
  );
}

/**
 * Copy selected widgets into existing tab.
 */
async function copyWidgetsToExistingTab({

  sourceDashboardId,
  sourceWidgetIds,

  destinationDashboardId,
  destinationTabId

}) {

  console.log("\n==================================================");

  console.log(
    "COPY SELECTED WIDGETS -> EXISTING TAB"
  );

  console.log("==================================================");

  const sourceDashboard =
    await getDashboard(
      SRC_BASE,
      SRC_HEADERS,
      sourceDashboardId
    );

  const widgets =
    sourceDashboard.widgets.filter(
      widget =>
        sourceWidgetIds.includes(
          widget.id
        )
    );

  console.log(
    `✅ Selected widgets: ${widgets.length}`
  );

  await copyWidgets({

    widgets,

    destinationDashboardId,

    destinationTabId

  });

  console.log(
    "\n✅ SELECTED WIDGET COPY COMPLETE"
  );
}

/**
 * Copy selected widgets into new tab.
 */
async function copyWidgetsToNewTab({

  sourceDashboardId,
  sourceWidgetIds,

  destinationDashboardId,
  newTabName

}) {

  const destinationTab =
    await createTab({

      dashboardId:
        destinationDashboardId,

      tabName:
        newTabName

    });

  await copyWidgetsToExistingTab({

    sourceDashboardId,

    sourceWidgetIds,

    destinationDashboardId,

    destinationTabId:
      destinationTab.id

  });
}

/* ============================================================
 * EXECUTION
 * ============================================================
 */

(async () => {

  try {

    for (
      let index = 0;
      index < operations.length;
      index++
    ) {

      const operation =
        operations[index];

      /**
       * Skip disabled operations.
       */
      if (
        operation.enabled === false
      ) {

        console.log(
          `⏭️ Skipping disabled operation: ${operation.mode}`
        );

        continue;
      }

      console.log("\n==================================================");

      console.log(
        `🚀 EXECUTING: ${operation.mode}`
      );

      console.log("==================================================");

      switch (operation.mode) {

        case "dashboard-copy":

          await copyEntireDashboard({

            sourceDashboardId:
              operation.source_dashboard_id,

            newDashboardName:
              operation.new_dashboard_name

          });

          break;

        case "full-tab-to-existing-dashboard":

          await copyFullTabToExistingDashboard({

            sourceDashboardId:
              operation.source_dashboard_id,

            sourceTabName:
              operation.source_tab_name,

            destinationDashboardId:
              operation.destination_dashboard_id,

            newTabName:
              operation.new_tab_name

          });

          break;

        case "full-tab-to-new-dashboard":

          await copyFullTabToNewDashboard({

            sourceDashboardId:
              operation.source_dashboard_id,

            sourceTabName:
              operation.source_tab_name,

            newDashboardName:
              operation.new_dashboard_name

          });

          break;

        case "widgets-to-existing-tab":

          await copyWidgetsToExistingTab({

            sourceDashboardId:
              operation.source_dashboard_id,

            sourceWidgetIds:
              operation.source_widget_ids,

            destinationDashboardId:
              operation.destination_dashboard_id,

            destinationTabId:
              operation.destination_tab_id

          });

          break;

        case "widgets-to-new-tab":

          await copyWidgetsToNewTab({

            sourceDashboardId:
              operation.source_dashboard_id,

            sourceWidgetIds:
              operation.source_widget_ids,

            destinationDashboardId:
              operation.destination_dashboard_id,

            newTabName:
              operation.new_tab_name

          });

          break;

        default:

          console.warn(
            `⚠️ Unknown operation mode: ${operation.mode}`
          );
      }

      /**
       * Stop if next operation is missing
       * or disabled.
       */
      const nextOperation =
        operations[index + 1];

      if (
        !nextOperation ||
        nextOperation.enabled === false
      ) {

        console.log(
          "\n✅ No more enabled operations."
        );

        console.log(
          "✅ Execution complete."
        );

        process.exit(0);
      }
    }

  } catch (err) {

    console.error(
      "\n❌ EXECUTION FAILED"
    );

    console.error(err.message);

    process.exit(1);
  }

})();