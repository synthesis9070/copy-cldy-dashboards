
// #!/usr/bin/env node

/**
 * ============================================================
 * copy-cldy-dashboards.js
 * ============================================================
 *
 * PUBLIC CLI – ZERO DEPENDENCIES
 *
 * Copies Cloudability dashboards (and widgets) from a source
 * tenant to a destination tenant using:
 *
 * 1. config/cloudability.config.json   → endpoints & tokens
 * 2. dashboards.txt                    → dashboards to copy
 *
 * Dashboards can be excluded by commenting lines with '#'.
 *
 * This implementation uses ONLY Node.js built-ins:
 * - fs, path, process, Buffer
 * - native fetch (Node 18+)
 */

const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------
 * Utility: sleep to avoid API rate limiting
 * ---------------------------------------------------------- */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* ------------------------------------------------------------
 * Utility: build HTTP headers for Cloudability
 * ---------------------------------------------------------- */
function buildHeaders(token) {
  return {
    "Authorization": `Basic ${Buffer.from(token).toString("base64")}`,
    "Content-Type": "application/json"
  };
}

/* ------------------------------------------------------------
 * Utility: HTTP wrapper around native fetch
 * - Ensures consistent error handling
 * - Parses JSON automatically
 * ---------------------------------------------------------- */
async function httpRequest(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  // Cloudability APIs always return JSON
  return response.json();
}

/* ------------------------------------------------------------
 * Load configuration file
 * ---------------------------------------------------------- */
const configPath = path.join(__dirname, "./cloudability.config.json");

if (!fs.existsSync(configPath)) {
  console.error("❌ Missing configuration file:", configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

/* ------------------------------------------------------------
 * Load dashboards reference file
 * ---------------------------------------------------------- */
const dashboardsFile = path.join(__dirname, "./dashboards.txt");

if (!fs.existsSync(dashboardsFile)) {
  console.error("❌ Missing dashboards reference file:", dashboardsFile);
  process.exit(1);
}

const dashboardLines = fs.readFileSync(dashboardsFile, "utf8").split("\n");

/* ------------------------------------------------------------
 * Parse dashboards.txt
 * Format:
 *   <dashboard-id><space|tab><destination-dashboard-name>
 * ---------------------------------------------------------- */
const dashboards = dashboardLines
  .map(line => line.trim())
  .filter(line => line.length > 0 && !line.startsWith("#"))
  .map(line => {
    // Split on ANY whitespace (space or tab)
    const parts = line.split(/\s+/);

    const sourceDashboardId = parts.shift();
    const destinationDashboardName = parts.join(" ");

    if (!sourceDashboardId || !destinationDashboardName) {
      throw new Error(`Invalid line in dashboards.txt: "${line}"`);
    }

    return {
      sourceDashboardId,
      destinationDashboardName
    };
  });

if (dashboards.length === 0) {
  console.log("⚠️ No dashboards enabled for copying.");
  process.exit(0);
}

/* ------------------------------------------------------------
 * Base URLs and headers
 * ---------------------------------------------------------- */
const SRC_BASE = config.source.src_endpoint;
const DEST_BASE = config.destination.dest_endpoint;

const SRC_HEADERS = buildHeaders(config.source.src_token);
const DEST_HEADERS = buildHeaders(config.destination.dest_token);

/* ============================================================
 * MAIN EXECUTION
 * ========================================================== */
(async () => {
  try {
    for (const entry of dashboards) {
      console.log(
        `🚀 Copying dashboard ${entry.sourceDashboardId} → "${entry.destinationDashboardName}"`
      );

      /* --------------------------------------------------------
       * Step 1: Create destination dashboard
       * ------------------------------------------------------ */
      const newDashboard = await httpRequest(
        `${DEST_BASE}/v3/internal/dashboards`,
        {
          method: "POST",
          headers: DEST_HEADERS,
          body: JSON.stringify({
            name: entry.destinationDashboardName,
            owned_by_user: true,
          })
        }
      );

      const newDashboardId = newDashboard.id;
      console.log(`✅ Created destination dashboard: ${newDashboardId}`);

      /* --------------------------------------------------------
       * Step 2: Fetch source dashboard + widgets
       * ------------------------------------------------------ */
      const srcDashboard = await httpRequest(
        `${SRC_BASE}/v3/internal/dashboards/${entry.sourceDashboardId}?include_widgets=true&limit=500&use_basic_user=true`,
        {
          method: "GET",
          headers: SRC_HEADERS
        }
      );

      const widgets = srcDashboard.widgets || [];

      /* --------------------------------------------------------
       * Step 3: Copy widgets
       * ------------------------------------------------------ */
      for (const originalWidget of widgets) {
        // Clone to avoid mutating source object
        const widget = structuredClone(originalWidget);

        // Remove read-only system fields
        delete widget.id;
        delete widget.created_at;
        delete widget.updated_at;
        delete widget.organization_id;
        delete widget.dashboard;

        // CRITICAL: tab_id must NOT be reused across dashboards
        delete widget.tab_id;

        widget.dashboard_id = newDashboardId;

        // Normalize filters into API-expected string format
        widget.options?.layers?.forEach(layer => {
          if (Array.isArray(layer.filters)) {
            layer.filters = layer.filters.map(
              f => `${f.name}${f.operator}${f.value}`
            );
          }
        });

        try {
          await httpRequest(
            `${DEST_BASE}/v3/internal/widgets`,
            {
              method: "POST",
              headers: DEST_HEADERS,
              body: JSON.stringify(widget)
            }
          );

          console.log(` ✅ Widget copied: ${widget.name}`);
          await wait(config.defaults?.widgetPostDelayMs || 1500);

        } catch (err) {
          console.error(` ❌ Widget failed: ${widget.name}`);
          console.error(err.message);
        }
      }

      console.log(`✅ Finished "${entry.destinationDashboardName}"`);
      console.log("--------------------------------------------------");
    }

    console.log("🎉 All dashboards and widgets copied successfully");

  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
})();