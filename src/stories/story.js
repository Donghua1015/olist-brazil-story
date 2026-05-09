// story.js
// Olist Brazil version

export const varLabels = {
  population: "Orders",
  mean_review_score: "Average Review Score (stars)",
  mean_delivery_days: "Average Delivery Days",
  on_time_rate: "On-time Rate",
  on_time_review_score: "Review When On Time (stars)",
  late_review_score: "Review When Late (stars)",
  latitude: "Latitude",
  longitude: "Longitude",
};

export const stages = [
  {
    id: "stage_1_sp_dominates",
    copy: `
      <h3>One state runs Brazilian e-commerce</h3>
      <p>
        Looking at our data, São Paulo got <strong>40,501 out of 96,478 orders</strong>.
        That's about 42 percent from a single state. If we add Rio and Minas Gerais,
        the top three already cover two thirds of the country.
        The other 24 states share what's left.
      </p>
    `,
    views: {
      scatter: false,
      bars: { xVar: "population" },
      map: true
    },
    highlightedCities: ["São Paulo"],
    annotations: {
      map: [
        { city: "São Paulo", text: "42% of all orders", direction: "NE" }
      ]
    }
  },
  {
    id: "stage_2_north_is_slow",
    copy: `
      <h3>The further north, the longer the wait</h3>
      <p>
        São Paulo gets packages in about <strong>8 days</strong>.
        Roraima, up near the Venezuela border, waits around <strong>29 days</strong>.
        Pretty much every state in between sits along the same line.
      </p>
    `,
    views: {
      scatter: { xVar: "latitude", yVar: "mean_delivery_days" },
      bars: false,
      map: false
    },
    highlightedCities: ["São Paulo", "Roraima"]
  },
  {
    id: "stage_3_late_kills_review",
    copy: `
      <h3>Slow delivery, lower reviews</h3>
      <p>
        States with more reliable delivery tend to earn higher reviews.
        SP (95.5% on-time) scores <strong>4.25</strong>.
        Roraima (87.8% on-time) scores <strong>3.90</strong>.
        The slope is gentle, but it seems every state follows it.
      </p>
    `,
    views: {
      scatter: { xVar: "on_time_rate", yVar: "mean_review_score" },
      bars: false,
      map: false
    },
    highlightedCities: ["São Paulo", "Roraima"]
  },
  {
    id: "stage_4_seller_question",
    copy: `
      <h3>What if we were sellers?</h3>
      <p>
        At the order level, the gap is much sharper. Late orders average
        <strong>2.3 stars</strong> and on-time orders average <strong>4.3</strong>.
        One late package costs about 2 whole stars.
      </p>
      <p>
        So the obvious thought might be: why not just stop shipping to slow states
        and keep only the reliable ones?
      </p>
    `,
    views: {
      scatter: {
        xVar: "on_time_review_score",
        yVar: "late_review_score",
        xDomain: [0, 5],
        yDomain: [0, 5]
      },
      bars: false,
      map: false
    },
    highlightedCities: ["São Paulo", "Roraima"],
    annotations: {
      scatter: [
        { x1: 2.5, y1: 0, x2: 2.5, y2: 5, stroke: "#eee", strokeDasharray: "none", behind: true },
        { x1: 0, y1: 2.5, x2: 5, y2: 2.5, stroke: "#eee", strokeDasharray: "none", behind: true },
        { x1: 0, y1: 2.3, x2: 5, y2: 2.3, direction: "W", text: "Late avg 2.3 stars" },
        { x1: 4.3, y1: 0, x2: 4.3, y2: 5, direction: "S", text: "On-time avg 4.3 stars" }
      ]
    }
  },
  {
    id: "stage_5_explore",
    copy: `
      <h3>Let's try it ourselves</h3>
      <p>
        We can drag a range on the bar chart to pick which states to ship to.
        The map shows our choices in red. The bars below tell us what
        happens to our reviews and our order volume.
      </p>
    `,
    views: { scatter: false, bars: true, map: true },
    highlightedCities: []
  },
  {
    id: "stage_6_reveal",
    copy: `
      <h3>0.09 stars for 58% of our orders</h3>
      <p>
        Suppose we only ship to São Paulo. Reviews climb from
        <strong>4.16 to 4.25</strong>, just <strong>0.09 stars</strong>.
        But our orders crash from <strong>96,478 to 40,501</strong>.
        That's more than half our business gone.
      </p>
      <p>
        Picking customers gives us a tiny bump. Fixing the logistics
        could push the whole country to 4.29 stars without losing any orders.
      </p>
    `,
    views: { scatter: false, bars: true, map: true },
    highlightedCities: [],
    preset: {
      orders: [40500, 50000]
    }
  }
];
