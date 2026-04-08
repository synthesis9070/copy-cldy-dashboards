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

## Project Structure

copy-cldy-dashboards/
├── copy-cldy-dashboard.js
├── config/
│   └── cloudability.config.json
├── dashboards.txt
├── package.json