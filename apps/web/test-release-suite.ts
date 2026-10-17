import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { extractHtmlSignals } from "./src/lib/geo-readiness";
import { gscToPerformance } from "./src/lib/mappers";

const control = extractHtmlSignals(`<TITLE class='a'> Test\n Title </TITLE><META content='Description' NAME='description'><meta content='noindex' name='robots'><script type='application/ld+json'>{"@graph":[{"@type":["WebPage","FAQPage"]},{"@type":"Organization"}]}</script><style>hidden words</style><p>visible words</p>`, "nofollow");
assert.equal(control.title, "Test Title");
assert.equal(control.metaDescription, "Description");
assert.equal(control.robotsDirectives, "noindex,nofollow");
assert.deepEqual(control.jsonLdTypes, ["WebPage", "FAQPage", "Organization"]);
assert.equal(control.wordCount, 4);
assert.equal(extractHtmlSignals("<title></title>").title, null);
assert.equal(extractHtmlSignals("<title>İstanbul</title><meta name=description content=ordinary>").metaDescription, "ordinary");
assert.equal(extractHtmlSignals("<title>İstanbul</title >").title, "İstanbul");
assert.deepEqual(extractHtmlSignals('İ<script type="application/ld+json">{"@type":"Organization"}</script\n>').jsonLdTypes, ["Organization"]);
assert.equal(extractHtmlSignals("<meta name=description content=unquoted>").metaDescription, "unquoted");
for (const unit of ["<title>", "<meta", '<script type="application/ld+json">', "<style>", "<"]) {
  const start = performance.now();
  extractHtmlSignals(unit.repeat(100_000));
  assert(performance.now() - start < 5_000, `Parsing exceeded budget for ${unit}`);
}
const start = performance.now();
extractHtmlSignals('<script type="application/ld+json">' + '"@type":['.repeat(100_000) + '</script>');
assert(performance.now() - start < 5_000);
// Large valid arrays must not overflow the JS argument/recursion stack.
assert.deepEqual(extractHtmlSignals('<script type="application/ld+json">' + JSON.stringify(Array.from({length:150_000},()=>({"@type":"WebPage"}))) + '</script>').jsonLdTypes, ["WebPage"]);

const metrics = gscToPerformance([
  { id:"1", site_id:"site", metric_date:"2026-10-14", query:"q", page:"/", clicks:10, impressions:1000, ctr:0.01, position:1 },
  { id:"2", site_id:"site", metric_date:"2026-10-14", query:"q", page:"/a", clicks:0, impressions:1, ctr:0, position:100 },
]);
assert.equal(metrics.position, 1100 / 1001);
assert.equal(metrics.queries[0].position, 1100 / 1001);
assert.equal(metrics.clicks, 10);
console.log("PASS: bounded HTML parsing, legitimate signals, large JSON-LD and weighted GSC aggregation");
