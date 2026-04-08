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

## How to Setup
1. Open a Terminal (macOS / Linux) or Command Prompt / PowerShell (Windows) and run:
    > node --version

    If you see a version like v18.x or higher ---> then you are good
    Otherwise, you will have to upgrade or install Node.js

    How to install Node.js
    - Go to https://nodejs.org
    - Download LTS (Long Term Support)
    - Install using default settings

    U can also use Homebrew to install Node.js
    - brew install node

2. Copy these files to your local directory and edit accordingly:
   - copy-cldy-dashboards.js             <---- node.js script
   - copy-cldy-dashboards.config.json    <---- Config file to configure API endpoints and tokens
   - dashboards.txt                      <---- Append dashboard IDs and target name of dashboard

3. Inside the folder, run "node copy-cldy-dashboards.js" and auto-magically copy the dashboard and widgets

4. That’s it 🎉