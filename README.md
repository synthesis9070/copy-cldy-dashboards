# copy-cldy-dashboards

A simple, reusable command-line tool to copy Cloudability dashboards and widgets from one tenant to another.

## Purpose

Cloudability dashboards are often reused across environments or tenants. This tool enables consistent, repeatable copying of dashboards without requiring complex command-line arguments or manual API interaction.

The tool is intentionally designed to favor simplicity, safety, and reusability.

## What the Tool Does

- Copies one or more dashboards from a source Cloudability tenant to a destination tenant
- Recreates dashboards and widgets using Cloudability internal APIs
- Safely handles the new Dashboard Tabs API by placing widgets into the default tab
- Supports copying multiple dashboards in a single execution

## What the Tool Does NOT Do

- Does not recreate dashboard tabs in the current version
- Does not modify existing dashboards in the destination tenant

## How to setup and use the CLI
1. Open Terminal (MacOS / Linux) or Command Prompt / PowerShell (Windows) and run:
   - node --version

   If you see a version like v18.x or higher --> ✅ you’re good
   If you see an error or an older version, then you will need to isntall Node.js

   How to install Node.js
   1. Go to: https://nodejs.org
   2. Download LTS (Long Term Support)
   3. Install using default settings
     
3. Create a folder on your local machine and download these files:
   - copy-cldy-dashboards.config.js        <---- Script in Node.js
   - copy-cldy-dashboards.config.json      <---- Edit the API endpoints and tokens
   - dashboards.txt                        <---- Edit and provide the dashboard IDs and desired dashboard name
     
5. Insider the folder, run the command and watch it auto-magically copy the dashboards and widgets:
   - node copy-cldy-dashboards.js

6. That’s it 🎉
