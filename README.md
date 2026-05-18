# METAR Reader

A full-stack web app that fetches live METAR aviation weather reports and translates them into plain-English summaries — no pilot training required.

Enter any ICAO airport code (e.g. `KJFK`, `EGLL`, `YSSY`) and get a human-readable breakdown of current conditions: temperature, wind, visibility, sky cover, pressure, and active weather phenomena.

## Features

- Plain-English weather summary generated from raw METAR data
- Metric units (m/s, km, hPa) alongside raw values
- Decodes wind direction, cloud layers, and weather phenomena codes
- Quick-pick buttons for example airports
- Raw METAR string available via expandable section

## Tech stack

- **Backend** — Node.js + Express, proxies [aviationweather.gov](https://aviationweather.gov) API
- **Frontend** — React 18 + Vite

## Requirements

- Node.js 18+
- npm 9+

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/metar-reader.git
   cd metar-reader
   ```

2. Install all dependencies (root + client) in one step:

   ```bash
   npm run install:all
   ```

## Running in development

Start both the backend (port 3002) and the Vite dev server (port 5173) together:

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

To run them separately:

```bash
npm run server   # Express API on :3002
npm run client   # Vite dev server on :5173
```

## Building for production

```bash
cd client
npm run build
```

The compiled frontend lands in `client/dist/`. Serve it with any static host and point API requests to the Express server.

## Data source

Weather data is sourced from the [Aviation Weather Center](https://aviationweather.gov) (NOAA). No API key is required.
