# Olist E-Commerce Across Brazil

A scroll-driven data story built with Svelte and D3 for DATA 31500 Assignment 3. The story walks through how delivery time and review scores vary across Brazilian states in the Olist e-commerce dataset, then asks the reader to play with a "what if I only ship to fast states" strategy.

**Live demo**: https://olistbrazilstoryvis.netlify.app/

## Running locally

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (default `http://localhost:5173/`).

## Story structure (six stages)

| # | Stage | Layout | What it shows |
|---|---|---|---|
| 1 | `stage_1_sp_dominates` | map + bar | Sao Paulo took 42% of all orders. The top three states cover two thirds of the country. |
| 2 | `stage_2_north_is_slow` | scatter only | Latitude vs. average delivery days. The further north, the longer the wait. |
| 3 | `stage_3_late_kills_review` | scatter only | On-time rate vs. review score, state level. Slower delivery means lower reviews. |
| 4 | `stage_4_seller_question` | scatter only | At the order level, late = 2.3 stars, on-time = 4.3 stars. The pivot question: should sellers just stop shipping to slow states? |
| 5 | `stage_5_explore` | map + bar | Reader-driven exploration. Drag a vertical brush on the bar chart to pick which states to ship to. The map and metric bars update. |
| 6 | `stage_6_reveal` | map + bar | Preset reveal: "only ship to Sao Paulo". Reviews climb 0.09 stars but order volume crashes 58%. Brush is disabled in this stage. |

## Project structure

```
src/
  App.svelte                  # Layout, scroll observer, data + geojson loading,
                              # cross-filter state, tweened metrics
  stories/story.js            # Six-stage narrative + variable labels
  components/
    Scatterplot.svelte        # D3 scatter (used in stages 2-4)
    BarChart.svelte           # D3 bar chart with optional Y-axis brush
                              # (two-layer rendering when brush is active:
                              #  grey background + red foreground that drops on deselect)
    CityMap.svelte            # Brazil map, Mercator projection, dot per state
    Histogram.svelte          # Brushable histogram (kept from earlier version,
                              # not currently rendered in stages 5/6)
public/
  olist-brazil-data.csv       # 27 Brazilian states with order counts, on-time rate,
                              # review scores split by on-time/late, freight, etc.
  brazil-states.geojson       # State boundaries (IBGE / code-for-germany)
```

## Data

Aggregated from the Olist Brazilian E-Commerce dataset (Kaggle / Olist), grouped to
the state level.

Columns used in the story:
- `population` - order count per state
- `mean_review_score` - average review across all orders
- `mean_delivery_days` - average actual delivery time
- `on_time_rate` - fraction of orders delivered on or before the estimated date
- `on_time_review_score`, `late_review_score` - average review split by on-time vs. late
- `latitude`, `longitude` - state centroid for the map

## Assignment 3 requirement checklist

| Requirement | Where it lives |
|---|---|
| Deliberate narrative style (Segel & Heer) | Interactive Slideshow with a martini-glass turn at stage 5 (reader-driven exploration) and a preset reveal at stage 6 |
| Informal, concise writing | `src/stories/story.js` copy fields, "we / our" student voice |
| >=2 reactive visualizations | The map and the bar chart both update when the brush selection changes |
| >=1 D3 animated transition | `BarChart.svelte` uses `d3.transition().duration(700)` on bar widths; foreground bars "drop" to zero width when their state is deselected |
| >=1 active user input | Y-axis `d3.brushY` on the bar chart in stage 5 lets the reader pick a contiguous range of states by order volume |

## Key techniques

- **Scrollytelling with `IntersectionObserver`** - a Svelte `use:` action wires up a scroll observer to drive `stageIndex`
- **Declarative story authoring** - `story.js` controls which views are visible, what variables each chart shows, which states are highlighted, and any annotations
- **Two-layer bar chart for the strategy view** - every state has a grey background bar (always full width) and a red foreground bar (full width when selected, zero when not). The foreground width transitions on selection change so deselected states "drop" smoothly while keeping their grey baseline
- **Tweened metric readouts** - `svelte/motion` `tweened` stores animate the displayed expected-review and order-count numbers as the brush moves
- **Preset stage** - stage 6 is just stage 5 with a fixed `preset.orders` filter and `disabled` brush, so the reader sees the punchline animation without being able to change it

## Deployment

This app is deployed to Netlify from this folder. Build settings:

- Build command: `npm run build`
- Publish directory: `dist`
