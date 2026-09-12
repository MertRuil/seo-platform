import assert from "node:assert";
import { decideSource } from "./src/lib/dataSource";
import { niceMax, linePath, areaPath, xPositions } from "./src/components/ui/chart-math";

function run() {
  console.log("UI LOGIC TEST SUITE");

  // decideSource: precedence no-backend > unauthorized > no-org > no-site > no-crawl > live
  assert.deepStrictEqual(
    decideSource({ backendReachable: false, authorized: false, hasOrg: false, hasSite: false, hasCrawl: false }),
    { source: "demo", reason: "no-backend" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: false, hasOrg: false, hasSite: false, hasCrawl: false }),
    { source: "demo", reason: "unauthorized" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: true, hasOrg: false, hasSite: false, hasCrawl: false }),
    { source: "demo", reason: "no-org" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: true, hasOrg: true, hasSite: false, hasCrawl: false }),
    { source: "demo", reason: "no-site" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: true, hasOrg: true, hasSite: true, hasCrawl: false }),
    { source: "demo", reason: "no-crawl" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: true, hasOrg: true, hasSite: true, hasCrawl: true }),
    { source: "live" }
  );
  console.log("  decideSource: ok");

  // niceMax: rounds up to a readable axis ceiling, never 0
  assert.strictEqual(niceMax([]), 1);
  assert.strictEqual(niceMax([0, 0]), 1);
  assert.strictEqual(niceMax([82]), 100);
  assert.strictEqual(niceMax([1420]), 1500);
  assert.strictEqual(niceMax([0.02, 0.05]), 0.05);
  assert.strictEqual(niceMax([0.02, 0.06]), 0.1);
  assert.strictEqual(niceMax([100]), 100);
  console.log("  niceMax: ok");

  // xPositions: first at padX, last at width - padX, evenly spaced; single point centered
  assert.deepStrictEqual(xPositions(3, 100, 10), [10, 50, 90]);
  assert.deepStrictEqual(xPositions(1, 100, 10), [50]);
  assert.deepStrictEqual(xPositions(0, 100, 10), []);
  console.log("  xPositions: ok");

  // linePath: max maps to padTop, 0 maps to height - padBottom
  const opts = { width: 100, height: 60, max: 10, padX: 0, padTop: 10, padBottom: 10 };
  assert.strictEqual(linePath([0, 10], opts), "M0 50 L100 10");
  assert.strictEqual(linePath([5], opts), "M50 30");
  assert.strictEqual(linePath([], opts), "");
  // areaPath closes down to the baseline
  assert.strictEqual(areaPath([0, 10], opts), "M0 50 L100 10 L100 50 L0 50 Z");
  console.log("  linePath/areaPath: ok");

  console.log("ALL UI LOGIC TESTS PASSED");
}

run();
