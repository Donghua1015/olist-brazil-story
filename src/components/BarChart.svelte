<script>
  import * as d3 from "d3";
  import { varLabels } from "../stories/story.js";

  // --- Props ---
  export let data = [];
  export let xVar;
  export let highlightedCities = [];
  export let annotation = null;
  // Optional brush props (omit to disable brush)
  export let brushFilter = null;
  export let brushUpdate = null;
  // When true, brush is fully disabled (no events, no visual)
  export let disabled = false;

  // --- Layout ---
  let margin = { top: 10, right: 20, bottom: 40, left: 120 };
  export let width = 500;
  export let height = 370;

  $: chartW = width - margin.left - margin.right;
  $: chartH = height - margin.top - margin.bottom;

  // --- DOM refs ---
  let xAxisEl;
  let barLayer;
  let brushLayer;

  $: brush = d3.brushY()
    .extent([[0, 0], [chartW, chartH]])
    .on("brush", brushed)
    .on("end", brushended);

  function brushed(event) {
    if (event && event.selection && brushUpdate) {
      const [y1, y2] = event.selection;
      const inRange = sortedData.filter(d => {
        const yc = yScale(d.city_name) + yScale.bandwidth() / 2;
        return yc >= y1 && yc <= y2;
      });
      if (inRange.length) {
        const vals = inRange.map(d => d[xVar]);
        brushFilter = [Math.min(...vals), Math.max(...vals) + 0.001];
      } else {
        brushFilter = [];
      }
      brushUpdate();
    }
  }
  function brushended(event) {
    if (event && !event.selection && brushUpdate) {
      brushFilter = [];
      brushUpdate();
    }
  }
  $: if (brushLayer && brushUpdate) {
    if (disabled) {
      d3.select(brushLayer).selectAll("*").remove();
      d3.select(brushLayer).on(".brush", null);
    } else {
      d3.select(brushLayer).call(brush);
    }
  }
  export function clearBrush() {
    if (brushLayer && brushUpdate) d3.select(brushLayer).call(brush.move, null);
  }

  export function applyBrush(valueRange) {
    if (!brushLayer || !brushUpdate || !valueRange || valueRange.length !== 2) return;
    const states = sortedData.filter(d => d[xVar] >= valueRange[0] && d[xVar] <= valueRange[1]);
    if (!states.length) return;
    const ys = states.map(d => yScale(d.city_name));
    const y1 = Math.min(...ys);
    const y2 = Math.max(...ys) + yScale.bandwidth();
    d3.select(brushLayer).transition().duration(750).call(brush.move, [y1, y2]);
  }

  // Track previous xVar for axis transition logic
  let prevXVar = null;

  // ---- derived data ----
  $: sortedData = [...data]
    .filter(d => d[xVar] != null)
    .sort((a, b) => d3.descending(a[xVar], b[xVar]));

  // ---- scales ----
  $: xScale = d3.scaleLinear()
    .range([0, chartW])
    .domain([0, d3.max(sortedData, d => d[xVar])])
    .nice();

  $: yScale = d3.scaleBand()
    .range([0, chartH])
    .domain(sortedData.map(d => d.city_name))
    .padding(0.15);

  // ---- annotation L-shape ----
  $: annShape = annotation && sortedData.length && yScale.bandwidth
    ? computeAnnShape(annotation, sortedData, xScale, yScale, xVar, chartW, chartH)
    : null;

  function computeAnnShape(ann, sorted, xSc, ySc, xV, cw, ch) {
    const threshX = xSc(ann.threshold);
    const exceeding = sorted.filter(d =>
      ann.direction === "above" ? d[xV] >= ann.threshold : d[xV] <= ann.threshold
    );
    if (!exceeding.length) return null;

    // Find the cutY — midpoint of the gap between last exceeding and first non-exceeding city
    let cutY, path, textX, textY;
    if (ann.direction === "above") {
      const last = exceeding[exceeding.length - 1];
      const lastIdx = sorted.indexOf(last);
      const next = sorted[lastIdx + 1];
      cutY = next
        ? (ySc(last.city_name) + ySc.bandwidth() + ySc(next.city_name)) / 2
        : ch;
      // L-shape: full-width top band + right-of-threshold bottom arm
      path = `M0,0 H${cw} V${ch} H${threshX} V${cutY} H0 Z`;
      textX = threshX + (cw - threshX) / 2;
      textY = ch - 8;
    } else {
      const first = exceeding[0];
      const firstIdx = sorted.indexOf(first);
      const prev = sorted[firstIdx - 1];
      cutY = prev
        ? (ySc(prev.city_name) + ySc.bandwidth() + ySc(first.city_name)) / 2
        : 0;
      // L-shape: left-of-threshold top arm + full-width bottom band
      path = `M0,0 H${threshX} V${cutY} H${cw} V${ch} H0 Z`;
      textX = threshX / 2;
      textY = 16;
    }

    return { path, threshX, cutY, textX, textY };
  }

  // ---- render with D3 join ----
  $: if (barLayer && xAxisEl && sortedData.length && xVar) {
    render(sortedData, xScale, yScale, xVar, highlightedCities);
  }

  function render(sorted, xSc, ySc, xV, highlighted) {
    const t = d3.transition().duration(700);

    // --- X axis ---
    const xSel = d3.select(xAxisEl);
    if (prevXVar && prevXVar !== xV) {
      // Variable changed: instant replace, then fade in
      xSel.interrupt()
        .style("opacity", 0)
        .call(d3.axisBottom(xSc).ticks(5))
        .transition().duration(400)
        .style("opacity", 1);
    } else {
      // First render or same variable: smooth transition
      xSel.transition(t).call(d3.axisBottom(xSc).ticks(5));
    }
    prevXVar = xV;

    // --- Bar groups: one <g> per city containing rect + text label ---
    const groups = d3.select(barLayer)
      .selectAll("g.bar-group")
      .data(sorted, d => d.city_name);

    // ENTER
    const enter = groups.enter()
      .append("g")
      .attr("class", "bar-group")
      .attr("transform", d => `translate(0, ${ySc(d.city_name)})`);

    const isH = d => highlighted.includes(d.city_name);
    const widthFor = d => xSc(d[xV]);
    const fgWidthFor = d => isH(d) ? xSc(d[xV]) : 0;

    if (brushUpdate) {
      // Two-layer: grey background bar + red foreground bar that drops when deselected
      enter.append("rect")
        .attr("class", "bg-bar")
        .attr("x", 0).attr("y", 0)
        .attr("height", ySc.bandwidth())
        .attr("fill", "#ccc")
        .attr("width", 0)
        .transition(t)
        .delay((d, i) => i * 15)
        .attr("width", widthFor);

      enter.append("rect")
        .attr("class", "fg-bar")
        .attr("x", 0).attr("y", 0)
        .attr("height", ySc.bandwidth())
        .attr("fill", "crimson")
        .attr("width", fgWidthFor);
    } else {
      // Single-layer (original Stage 1 behavior)
      const fillFor = d => isH(d) ? "crimson" : "steelblue";
      enter.append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("height", ySc.bandwidth())
        .attr("fill", fillFor)
        .attr("width", 0)
        .transition(t)
        .delay((d, i) => i * 15)
        .attr("width", widthFor);
    }

    enter.append("text")
      .attr("x", -4)
      .attr("y", ySc.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("font-size", "10px")
      .attr("fill", "#333")
      .text(d => d.city_name);

    // UPDATE
    groups.transition(t)
      .delay((d, i) => i * 15)
      .attr("transform", d => `translate(0, ${ySc(d.city_name)})`);

    if (brushUpdate) {
      // bg stays at full width
      groups.select("rect.bg-bar")
        .transition(t)
        .delay((d, i) => i * 15)
        .attr("width", widthFor)
        .attr("height", ySc.bandwidth());
      // fg drops to 0 if not highlighted, rises to full if highlighted
      groups.select("rect.fg-bar")
        .transition(t)
        .delay((d, i) => i * 15)
        .attr("width", fgWidthFor)
        .attr("height", ySc.bandwidth());
    } else {
      const fillFor = d => isH(d) ? "crimson" : "steelblue";
      groups.select("rect")
        .transition(t)
        .delay((d, i) => i * 15)
        .attr("width", widthFor)
        .attr("height", ySc.bandwidth())
        .attr("fill", fillFor);
    }

    groups.select("text")
      .transition(t)
      .delay((d, i) => i * 15)
      .attr("y", ySc.bandwidth() / 2);

    // EXIT
    groups.exit()
      .transition(t)
      .style("opacity", 0)
      .remove();
  }
</script>

<svg width="100%" height="100%">
  <g transform={`translate(${margin.left}, ${margin.top})`}>
    <!-- Annotation L-shape shading (behind bars) -->
    {#if annShape}
      <path d={annShape.path} fill="#333" opacity="0.07" />
    {/if}

    <!-- bars managed by D3 -->
    <g bind:this={barLayer}></g>

    <!-- Optional brush layer -->
    {#if brushUpdate}
      <g bind:this={brushLayer}></g>
    {/if}

    <!-- Annotation threshold line + cutoff line + text (in front of bars) -->
    {#if annShape}
      <line
        x1={annShape.threshX} y1="0"
        x2={annShape.threshX} y2={chartH}
        stroke="#333" stroke-width="1.5" stroke-dasharray="5 3"
      />
      <line
        x1="0" y1={annShape.cutY}
        x2={chartW} y2={annShape.cutY}
        stroke="#333" stroke-width="1" stroke-dasharray="4 3"
      />
      <text
        x={annShape.textX}
        y={annShape.textY}
        text-anchor="middle"
        class="annotation-label"
      >{annotation.text}</text>
    {/if}

    <!-- y-axis domain line -->
    <line x1="0" y1="0" x2="0" y2={chartH} stroke="#333" />
  </g>

  <!-- x-axis -->
  <g
    class="axis"
    style:transform="translate({margin.left}px, {chartH + margin.top}px)"
    bind:this={xAxisEl}
  />

  <!-- Axis label -->
  <text
    x={margin.left + chartW / 2}
    y={chartH + margin.top + 35}
    text-anchor="middle"
    class="axis-label">
    {varLabels[xVar] || xVar}
  </text>
</svg>

<style>
  .axis {
    transition: transform 0.5s ease;
  }
  .axis-label {
    font-size: 12px;
    fill: #333;
  }
  .annotation-label {
    font-size: 11px;
    fill: #555;
  }
</style>
