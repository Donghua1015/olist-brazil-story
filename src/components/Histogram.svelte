<script>
  import * as d3 from 'd3';
  import { varLabels } from "../stories/story.js";

  export let data = [];
  export let fullData = [];
  export let variable;
  export let filter;
  export let update;

  const margin = { top: 10, right: 20, bottom: 32, left: 40 };
  const W = 320, H = 160;
  const chartW = W - margin.left - margin.right;
  const chartH = H - margin.top - margin.bottom;

  let brushLayer;
  let xAxisEl;
  let yAxisEl;

  const brush = d3.brushX()
    .extent([[0, 0], [chartW, chartH]])
    .on("brush", brushed)
    .on("end", brushended);

  function brushed(event) {
    if (event && event.selection) {
      filter = [xScale.invert(event.selection[0]), xScale.invert(event.selection[1])];
      update();
    }
  }

  function brushended(event) {
    if (event && !event.selection) {
      filter = [];
      update();
    }
  }

  export function clearBrush() {
    if (brushLayer) d3.select(brushLayer).call(brush.move, null);
  }

  export function applyBrush(valueRange) {
    if (!brushLayer || !valueRange || valueRange.length !== 2) return;
    const x1 = xScale(valueRange[0]);
    const x2 = xScale(valueRange[1]);
    d3.select(brushLayer).transition().duration(750).call(brush.move, [x1, x2]);
  }

  $: xScale = d3.scaleLinear()
    .range([0, chartW])
    .domain(d3.extent(fullData, d => d[variable])).nice();
  $: binData = d3.histogram()
    .value(d => d[variable])
    .domain(xScale.domain())
    .thresholds(xScale.ticks(15));
  $: bgBins = binData(fullData);
  $: fgBins = binData(data);
  $: yScale = d3.scaleLinear()
    .range([chartH, 0])
    .domain([0, d3.max(bgBins, d => d.length)]);

  $: if (brushLayer && xAxisEl && yAxisEl) {
    d3.select(brushLayer).call(brush);
    d3.select(xAxisEl).call(d3.axisBottom(xScale).ticks(5));
    d3.select(yAxisEl).call(d3.axisLeft(yScale).ticks(4));
  }
</script>

<svg viewBox="0 0 {W} {H}" width="100%" height="100%">
  <g transform="translate({margin.left}, {margin.top})">
    {#each bgBins as d}
      <rect class="bg"
        x={xScale(d.x0)} y={yScale(d.length)}
        width={Math.max(0, xScale(d.x1) - xScale(d.x0) - 1)}
        height={chartH - yScale(d.length)} />
    {/each}
    {#each fgBins as d}
      <rect class="fg"
        x={xScale(d.x0)} y={yScale(d.length)}
        width={Math.max(0, xScale(d.x1) - xScale(d.x0) - 1)}
        height={chartH - yScale(d.length)} />
    {/each}
  </g>
  <g transform="translate({margin.left}, {margin.top})" bind:this={brushLayer} />
  <g transform="translate({margin.left}, {chartH + margin.top})" bind:this={xAxisEl} />
  <g transform="translate({margin.left}, {margin.top})" bind:this={yAxisEl} />
  <text x={W / 2} y={H - 4} text-anchor="middle" font-size="11" fill="#333">
    {varLabels[variable] || variable}
  </text>
  <text
    transform="rotate(-90, 12, {margin.top + chartH / 2})"
    x="12" y={margin.top + chartH / 2}
    text-anchor="middle"
    font-size="10" fill="#666">
    states
  </text>
</svg>

<style>
  .bg { fill: #ccc; }
  .fg { fill: crimson; }
</style>
