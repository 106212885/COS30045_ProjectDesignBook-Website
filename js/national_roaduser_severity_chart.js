/* ==========================================================================
   js/national_roaduser_severity_chart.js  (Graph 2)
   Paired horizontal bar chart: how serious are injuries for each road user?
   Left panel  = average bed days per case
   Right panel = share of cases ending in death (%), 2011-2020 only.
   ========================================================================== */

const SEVERITY_MIN_WIDTH = 900;   // below this the chart scrolls sideways instead of shrinking text
const SEVERITY_ROW_HEIGHT = 38;   // pixels per road user row

/**
 * Renders Graph 2.
 * @param {Array<Object>} data - rows with roadUser, hospitalisations, bedDaysPerCase, diedPct, diedCases, group.
 */
function renderSeverityChart(data) {
  const container = d3.select("#severity-chart-container");
  const containerNode = container.node();
  if (!containerNode) return;

  // Edge case: file loaded but empty
  if (!data || data.length === 0) {
    container.html("<p>No severity data available.</p>");
    return;
  }

  // ---- 1. Dimensions (same pattern as G1: minimum width + horizontal scroll) ----
  containerNode.style.overflowX = "auto";
  const svgWidth = Math.max(containerNode.getBoundingClientRect().width || 900, SEVERITY_MIN_WIDTH);
  const margin = { top: 90, right: 60, bottom: 60, left: 270 };
  const panelGap = 50;
  const panelWidth = (svgWidth - margin.left - margin.right - panelGap) / 2;
  const height = SEVERITY_ROW_HEIGHT * data.length;

  container.html(""); // clear previous drawing so a resize does not duplicate elements

  // Sorted copy so the longest stays are at the top
  const rows = [...data].sort((a, b) => b.bedDaysPerCase - a.bedDaysPerCase);

  // ---- 2. Scales ----
  const y = d3.scaleBand().domain(rows.map(d => d.roadUser)).range([0, height]).padding(0.25);
  const xBed = d3.scaleLinear().domain([0, d3.max(rows, d => d.bedDaysPerCase)]).nice().range([0, panelWidth]);
  const xDeath = d3.scaleLinear().domain([0, d3.max(rows, d => d.diedPct)]).nice().range([0, panelWidth]);

  // Colour rule: highest = vermillion, lowest = green, everything else grey context.
  // The two highlighted rows also get bold labels so colour is never the only cue.
  const highest = rows[0].roadUser;
  const lowestMeaningful = rows[rows.length - 1].roadUser; // sorted descending, so last row is the shortest stay
  function barColour(name) {
    if (name === highest) return PALETTE.VERMILLION;
    if (name === lowestMeaningful) return PALETTE.GREEN;
    return PALETTE.GREY_CONTEXT;
  }

  // ---- 3. SVG canvas (focusable group of rows, labelled for screen readers) ----
  const svgParent = container.append("svg")
    .attr("width", svgWidth)
    .attr("height", height + margin.top + margin.bottom)
    .attr("role", "group")
    .attr("aria-label", "Paired bar chart of average bed days per case and percentage of cases ending in death by road user. Tab to each row to hear its values.")
    .style("overflow", "visible");
  const svg = svgParent.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Panel titles
  svg.append("text").attr("x", 0).attr("y", -52).style("font-size", "1.1rem").style("font-weight", "700")
    .style("fill", "#2A2730").text("Average bed days per case");
  svg.append("text").attr("x", panelWidth + panelGap).attr("y", -52).style("font-size", "1.1rem").style("font-weight", "700")
    .style("fill", "#2A2730").text("Cases ending in death (%), 2011–2020");

  // Colour key (text + colour, so it does not rely on hue alone)
  svg.append("text").attr("x", 0).attr("y", -24).style("font-size", "0.9rem").style("fill", PALETTE.GREY_CONTEXT)
    .text(`Highlighted: ${highest} (longest stays, vermillion) and ${lowestMeaningful} (shortest stays, green)`);

  // ---- 4. Axes and light gridlines ----
  function drawPanel(offsetX, scale, tickFormat) {
    const panel = svg.append("g").attr("transform", `translate(${offsetX},0)`);
    panel.append("g").attr("class", "grid")
      .call(d3.axisBottom(scale).ticks(5).tickSize(height).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").attr("stroke", "#E4DFEA"));
    panel.append("g").attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(scale).ticks(5).tickFormat(tickFormat).tickPadding(8))
      .attr("font-size", "1rem");
    return panel;
  }
  const bedPanel = drawPanel(0, xBed, d3.format("d"));
  const deathPanel = drawPanel(panelWidth + panelGap, xDeath, d => d + "%");

  // ---- 5. Tooltip (own class so G1's tooltip clean-up never removes it) ----
  d3.selectAll(".severity-tooltip").remove();
  const tooltip = d3.select("body").append("div")
    .attr("class", "chart-tooltip severity-tooltip")
    .attr("aria-live", "polite")
    .style("opacity", 0);

  function showTooltip(d, left, top) {
    tooltip.html(
      `<div style="font-size:1.1rem; font-weight:700; border-bottom:1.5px solid #C3B1E0; padding-bottom:6px; margin-bottom:8px;">${d.roadUser}</div>
       <div>Group: ${d.group}</div>
       <div>Hospitalisations: <strong>${d3.format(",")(d.hospitalisations)}</strong></div>
       <div>Bed days per case: <strong>${d3.format(".1f")(d.bedDaysPerCase)}</strong></div>
       <div>Cases ending in death: <strong>${d3.format(".2f")(d.diedPct)}%</strong> (${d3.format(",")(d.diedCases)} cases)</div>`
    ).style("left", left + "px").style("top", top + "px").style("opacity", 1);
  }
  const hideTooltip = () => tooltip.style("opacity", 0);

  // ---- 6. One focusable <g> per road user holding both bars ----
  const rowGroups = svg.selectAll("g.severity-row").data(rows).join("g")
    .attr("class", "severity-row")
    .attr("transform", d => `translate(0,${y(d.roadUser)})`)
    .attr("tabindex", 0)
    .attr("role", "img")
    .attr("aria-label", d => `${d.roadUser}: ${d3.format(".1f")(d.bedDaysPerCase)} bed days per case, ${d3.format(".2f")(d.diedPct)} percent of cases ended in death, ${d3.format(",")(d.hospitalisations)} hospitalisations.`)
    .style("outline", "none");

  // Hover band behind each row (turns visible on hover / focus)
  rowGroups.append("rect").attr("class", "row-band")
    .attr("x", -margin.left + 10).attr("y", -4)
    .attr("width", svgWidth - 20).attr("height", y.bandwidth() + 8)
    .attr("rx", 8).style("fill", "#C3B1E0").style("opacity", 0);

  // Row labels (bold for the two highlighted users)
  rowGroups.append("text")
    .attr("x", -14).attr("y", y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end")
    .style("font-size", "1rem")
    .style("font-weight", d => (d.roadUser === highest || d.roadUser === lowestMeaningful) ? 800 : 500)
    .style("fill", "#2A2730").text(d => d.roadUser);

  // Bars
  rowGroups.append("rect").attr("x", 0).attr("y", 0).attr("height", y.bandwidth())
    .attr("width", d => xBed(d.bedDaysPerCase)).style("fill", d => barColour(d.roadUser));
  rowGroups.append("rect").attr("x", panelWidth + panelGap).attr("y", 0).attr("height", y.bandwidth())
    .attr("width", d => xDeath(d.diedPct)).style("fill", d => barColour(d.roadUser));

  // Direct value labels at the bar ends
  rowGroups.append("text").attr("x", d => xBed(d.bedDaysPerCase) + 6).attr("y", y.bandwidth() / 2).attr("dy", "0.35em")
    .style("font-size", "0.9rem").style("font-weight", 700).style("fill", "#2A2730").text(d => d3.format(".1f")(d.bedDaysPerCase));
  rowGroups.append("text").attr("x", d => panelWidth + panelGap + xDeath(d.diedPct) + 6).attr("y", y.bandwidth() / 2).attr("dy", "0.35em")
    .style("font-size", "0.9rem").style("font-weight", 700).style("fill", "#2A2730").text(d => d3.format(".2f")(d.diedPct) + "%");

  // ---- 7. Interaction: mouse, touch and keyboard focus ----
  rowGroups
    .on("mousemove", function (event, d) {
      d3.select(this).select(".row-band").style("opacity", 0.25);
      showTooltip(d, event.pageX + 20, event.pageY - 20);
    })
    .on("mouseout", function () { d3.select(this).select(".row-band").style("opacity", 0); hideTooltip(); })
    .on("focus", function (event, d) {
      d3.select(this).select(".row-band").style("opacity", 0.25);
      const r = this.getBoundingClientRect(); // dock the tooltip next to the focused row
      showTooltip(d, r.left + window.scrollX + r.width * 0.55, r.top + window.scrollY - 10);
    })
    .on("blur", function () { d3.select(this).select(".row-band").style("opacity", 0); hideTooltip(); })
    .on("keydown", (event) => { if (event.key === "Escape") hideTooltip(); });
}