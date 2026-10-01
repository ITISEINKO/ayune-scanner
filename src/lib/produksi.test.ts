import assert from "node:assert/strict";
import { moveProduction } from "./produksi.ts";

assert.deepEqual(moveProduction("QC Material", "qc", "Fail"), { to: "Komplain", progress: 15, qcResult: "Fail" });
assert.deepEqual(moveProduction("Packing", "advance"), { to: "Pengiriman", progress: 100 });
assert.equal(moveProduction("QC Material", "advance"), null);
