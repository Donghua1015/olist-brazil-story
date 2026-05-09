<script>
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";

  import { stages } from "./stories/story.js";

  const reviewTween = tweened(0, { duration: 700, easing: cubicOut });
  const ordersTween = tweened(0, { duration: 700, easing: cubicOut });

  import Scatterplot from "./components/Scatterplot.svelte";
  import BarChart from "./components/BarChart.svelte";
  import CityMap from "./components/CityMap.svelte";
  import Histogram from "./components/Histogram.svelte";

  let stageIndex = 0;
  $: stage = stages[stageIndex];

  let data = [];
  let stateFeatures = null;
  let stateMesh = null;

  // Stage 5 cross-filter state
  let filterOnTime = [];
  let filterOrders = [];
  let filteredData = [];

  function inFilter(v, f) {
    return f.length === 0 || (v >= f[0] && v < f[1]);
  }
  function updateData() {
    // No-op: filteredData is reactively recomputed below
  }
  $: if (data.length) {
    filteredData = data.filter(d =>
      inFilter(d.on_time_rate, effectiveOnTime) &&
      inFilter(d.population, effectiveOrders)
    );
  }

  function expectedReview(rows) {
    const total = rows.reduce((a, d) => a + d.population, 0);
    if (!total) return 0;
    const w = rows.reduce((a, d) =>
      a + (d.on_time_rate * d.on_time_review_score + (1 - d.on_time_rate) * d.late_review_score) * d.population, 0);
    return w / total;
  }

  $: selectedStateNames = filteredData.map(d => d.city_name);
  $: yourReview = expectedReview(filteredData);
  $: yourOrders = filteredData.reduce((a, d) => a + d.population, 0);
  $: allOrders = data.reduce((a, d) => a + d.population, 0);
  $: allReview = expectedReview(data);

  // Tween the displayed metrics so numbers + bar widths animate smoothly
  $: reviewTween.set(yourReview);
  $: ordersTween.set(yourOrders);
  // Stage 5 and Stage 6 share the interactive layout
  $: isStage5 = stage.id === "stage_5_explore" || stage.id === "stage_6_reveal";
  $: isStage6 = stage.id === "stage_6_reveal";

  // In Stage 6, override user filters with preset values
  $: effectiveOnTime = isStage6 && stage.preset?.onTime ? stage.preset.onTime : filterOnTime;
  $: effectiveOrders = isStage6 && stage.preset?.orders ? stage.preset.orders : filterOrders;

  // Reset user filters whenever crossing the stage 5/6 boundary
  let prevStageId = null;
  $: {
    if (stage.id !== prevStageId) {
      const crossing6 = prevStageId === "stage_6_reveal" || stage.id === "stage_6_reveal";
      if (crossing6) {
        filterOnTime = [];
        filterOrders = [];
        histoOnTime?.clearBrush();
        barOrders?.clearBrush();
      }
      prevStageId = stage.id;
    }
  }

  // --- Layout system ---
  function getLayoutName(views) {
    const s = !!views.scatter, m = !!views.map, b = !!views.bars;
    if (s && m && b) return "full";
    if (s && b) return "scatter-bar";
    if (m && b) return "map-bar";
    if (s) return "scatter-only";
    if (b) return "bar-only";
    if (m) return "map-only";
    return "full";
  }

  $: layoutName = getLayoutName(stage.views);

  // Track last-known props so inactive components keep valid data while fading out
  let scatterXVar = "on_time_rate", scatterYVar = "mean_review_score";
  let scatterXDomain = null, scatterYDomain = null;
  let barXVar = "population";
  let scatterAnnotations = [];
  let barAnnotation = null;
  let mapAnnotations = [];

  $: if (stage.views.scatter) {
    scatterXVar = stage.views.scatter.xVar;
    scatterYVar = stage.views.scatter.yVar;
    scatterXDomain = stage.views.scatter.xDomain || null;
    scatterYDomain = stage.views.scatter.yDomain || null;
  }
  $: if (stage.views.bars) {
    barXVar = stage.views.bars.xVar;
  }

  $: if (stage.annotations?.scatter) {
    scatterAnnotations = stage.annotations.scatter;
  } else if (stage.views.scatter) {
    scatterAnnotations = [];
  }
  $: if (stage.annotations?.bars) {
    barAnnotation = stage.annotations.bars;
  } else if (stage.views.bars) {
    barAnnotation = null;
  }
  $: if (stage.annotations?.map) {
    mapAnnotations = stage.annotations.map;
  } else if (stage.views.map) {
    mapAnnotations = [];
  }

  let dashW = 0, dashH = 0;
  let miniBarW = 0, miniBarH = 0;
  const PAD = 16, GAP = 16;

  // Refs to histogram + bar so we can clear their brushes globally
  let histoOnTime;
  let barOrders;

  function handleGlobalClick(e) {
    if (isStage6) return;
    if (e.target.closest('.histo-row')) return;
    histoOnTime?.clearBrush();
    barOrders?.clearBrush();
  }

  $: slots = computeSlots(layoutName, dashW, dashH, isStage5);

  // Track last active position so inactive slots don't snap their internal content
  let lastScatter = null;
  $: if (slots.scatter.active) lastScatter = { ...slots.scatter };
  $: scatterRender = slots.scatter.active ? slots.scatter : (lastScatter || slots.scatter);

  function computeSlots(layout, W, H, stage5) {
    const w = W - 2 * PAD;
    const h = H - 2 * PAD;
    const half = (w - GAP) / 2;
    const L = PAD, R = PAD + half + GAP;
    // Stage 5 uses 70/30 split for map-bar layout
    const leftW70 = (w - GAP) * 0.7;
    const rightW30 = (w - GAP) * 0.3;
    const R30 = PAD + leftW70 + GAP;

    // Default "full" positions — used for inactive slots
    const defaults = {
      scatter: { x: L, y: PAD, w: half, h: h },
      map:     { x: R, y: PAD, w: half, h: (h - GAP) * 0.45 },
      bars:    { x: R, y: PAD + (h - GAP) * 0.45 + GAP, w: half, h: (h - GAP) * 0.55 },
    };

    let active = {};
    switch (layout) {
      case "full":
        active = { scatter: defaults.scatter, map: defaults.map, bars: defaults.bars };
        break;
      case "scatter-bar":
        active = {
          scatter: { x: L, y: PAD, w: half, h: h },
          bars:    { x: R, y: PAD, w: half, h: h },
        };
        break;
      case "map-bar":
        active = {
          map:  { x: L, y: PAD, w: half, h: h },
          bars: { x: R, y: PAD, w: half, h: h },
        };
        break;
      case "scatter-only":
        active = { scatter: { x: L, y: PAD, w: w, h: h } };
        break;
      case "bar-only":
        active = { bars: { x: L, y: PAD, w: w, h: h } };
        break;
      case "map-only":
        active = { map: { x: L, y: PAD, w: w, h: h } };
        break;
    }

    return {
      scatter: { ...(active.scatter || defaults.scatter), active: !!active.scatter },
      map:     { ...(active.map || defaults.map),         active: !!active.map },
      bars:    { ...(active.bars || defaults.bars),        active: !!active.bars },
    };
  }

  // --- IntersectionObserver action ---
  function observe(node) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            if (!isNaN(idx)) stageIndex = idx;
          }
        });
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return {
      destroy() {
        observer.disconnect();
      }
    };
  }

  onMount(async () => {
    data = await d3.csv("olist-brazil-data.csv", d => ({
      city_name: d.city_name,
      state: d.state,
      region: d.region,

      latitude: +d.latitude,
      longitude: +d.longitude,

      population: +d.population,
      n_customers: +d.n_customers,

      mean_review_score: +d.mean_review_score,
      mean_delivery_days: +d.mean_delivery_days,
      on_time_rate: +d.on_time_rate,
      on_time_review_score: +d.on_time_review_score,
      late_review_score: +d.late_review_score,

      mean_price: +d.mean_price,
      mean_freight: +d.mean_freight
    }));

    console.log(data);

    // brazil-states.geojson is plain GeoJSON, use it for both fill and stroke
    const br = await d3.json("brazil-states.geojson");
    stateFeatures = br;
    stateMesh = br;
  });
</script>

<svelte:window on:click={handleGlobalClick} />

<main>
    <div class="scrollyteller">
        <section class="title text">
            <h2>Olist E-Commerce Across Brazil</h2>
        </section>
        <div class="text">
            {#each stages as s, i}
            <section
                class="step"
                class:is-stage5={s.id === "stage_5_explore"}
                id={s.id}
                data-index={i}
                use:observe
            >
                {@html s.copy}
            </section>
            {/each}
        </div>

        <div class="dashboard" bind:clientWidth={dashW} bind:clientHeight={dashH}>
            {#if data.length}
                <div class="slot" class:inactive={!slots.scatter.active}
                    style:left="{scatterRender.x}px" style:top="{scatterRender.y}px"
                    style:width="{scatterRender.w}px" style:height="{scatterRender.h}px">
                    <Scatterplot
                        width={scatterRender.w} height={scatterRender.h}
                        data={data}
                        xVar={scatterXVar}
                        yVar={scatterYVar}
                        xDomain={scatterXDomain}
                        yDomain={scatterYDomain}
                        highlightedCities={stage.highlightedCities}
                        annotations={scatterAnnotations}
                    />
                </div>
            {/if}

            {#if data.length && stateFeatures}
                <div class="slot map-slot"
                    class:inactive={!slots.map.active}
                    class:stage5-active={isStage5}
                    style:left="{slots.map.x}px" style:top="{slots.map.y}px"
                    style:width="{slots.map.w}px" style:height="{slots.map.h}px">
                    <CityMap
                        width={slots.map.w} height={slots.map.h}
                        data={data}
                        geojson={stateFeatures}
                        mesh={stateMesh}
                        highlightedCities={isStage5 ? selectedStateNames : stage.highlightedCities}
                        annotations={mapAnnotations}
                    />
                </div>
            {/if}

            {#if data.length}
                <!-- BarChart slot: visible whenever bars active and not stage 5 -->
                <div class="slot" class:inactive={isStage5 || !slots.bars.active}
                    style:left="{slots.bars.x}px" style:top="{slots.bars.y}px"
                    style:width="{slots.bars.w}px" style:height="{slots.bars.h}px">
                    <BarChart
                        width={slots.bars.w} height={slots.bars.h}
                        data={data}
                        xVar={barXVar}
                        highlightedCities={stage.highlightedCities}
                        annotation={barAnnotation}
                    />
                </div>

                <!-- Stage 5/6 panel: BarChart + metric bars (no Histogram in v2) -->
                <div class="slot stage5-panel" class:inactive={!isStage5} class:is-stage6={isStage6}
                    style:left="{slots.bars.x}px" style:top="{slots.bars.y}px"
                    style:width="{slots.bars.w}px" style:height="{slots.bars.h}px">
                    <div class="histo-row" bind:clientWidth={miniBarW} bind:clientHeight={miniBarH}>
                        <BarChart
                            bind:this={barOrders}
                            width={miniBarW || 200} height={miniBarH || 120}
                            data={data}
                            xVar="population"
                            highlightedCities={selectedStateNames}
                            annotation={null}
                            bind:brushFilter={filterOrders}
                            brushUpdate={updateData}
                            disabled={isStage6}
                        />
                    </div>
                    <div class="readout">
                        <div class="metric-row">
                            <div class="metric-label">Expected review</div>
                            <div class="bar-track">
                                <div class="bar-fill review" style="width: {($reviewTween / 5) * 100}%"></div>
                                <div class="baseline" style="left: {(allReview / 5) * 100}%" title="All states baseline {allReview.toFixed(2)}"></div>
                            </div>
                            <div class="metric-value">{$reviewTween.toFixed(2)} / 5</div>
                        </div>
                        <div class="metric-row">
                            <div class="metric-label">Orders kept</div>
                            <div class="bar-track">
                                <div class="bar-fill orders" style="width: {allOrders ? ($ordersTween / allOrders) * 100 : 0}%"></div>
                            </div>
                            <div class="metric-value">{Math.round($ordersTween).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</main>

<style>
.scrollyteller {
  position: relative;
  display: grid;
  grid-template-columns: 1fr minmax(auto, 32rem) 1fr;
}

/* ---- BACKGROUND DASHBOARD ---- */
.dashboard {
  position: fixed;
  top: 3rem;
  left: 0;
  right: 0;
  height: calc(100vh - 3rem);
  z-index: 0;
  pointer-events: none;
}

.slot {
  position: absolute;
  transition: left 0.5s ease, top 0.5s ease, width 0.5s ease, height 0.5s ease, opacity 0.5s ease;
}

.slot.inactive {
  opacity: 0;
  pointer-events: none;
}

.stage5-panel {
  pointer-events: auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

/* Stage 6: brushes disabled (read-only preset) */
.stage5-panel.is-stage6 .histo-row,
.stage5-panel.is-stage6 .histo-row * {
  pointer-events: none !important;
}
.histo-row {
  flex: 1;
  min-height: 0;
}
.readout {
  padding: 0.6rem 0.4rem;
  border-top: 1px solid #eee;
}
.metric-row {
  display: grid;
  grid-template-columns: 90px 1fr 80px;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.metric-row:last-child { margin-bottom: 0; }
.metric-label {
  font-size: 0.78rem;
  color: #555;
}
.bar-track {
  position: relative;
  height: 12px;
  background: #eee;
  border-radius: 2px;
}
.bar-fill {
  height: 100%;
  border-radius: 2px;
}
.bar-fill.review { background: crimson; }
.bar-fill.orders { background: steelblue; }
.baseline {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 0;
  border-left: 1.5px dashed #333;
}
.metric-value {
  font-size: 0.78rem;
  color: #333;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Stage 5 text card stays centered; clicks pass through to histograms */
:global(.step.is-stage5) {
  pointer-events: none;
}

/* ---- FOREGROUND TEXT ---- */
.text {
  position: relative;
  z-index: 1;
  grid-column: 2;
  padding: 2rem;
}

.title {
  grid-column: 2;
  margin-bottom: 5vh;
  background: rgba(255, 255, 255, 0.85);
  padding: 1rem 1.5rem;
  border-radius: 6px;
}

.step {
  margin-bottom: 80vh;
  font-size: 1.1rem;
  background: rgba(255, 255, 255, 0.85);
  padding: 1rem 1.5rem;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
</style>
