const test = require("node:test");
const assert = require("node:assert/strict");

const { createSelectionFlow } = require("../utils/selection-flow");

test("a guarded continuation fires once after 280 ms", () => {
  const scheduled = [];
  const flow = createSelectionFlow({
    setTimer(fn, delay) {
      scheduled.push({ fn, delay });
      return 7;
    },
    clearTimer() {}
  });
  let action = "";
  flow.schedule({ token: "u:5:1:0", action: "advance", run(value) { action = value; } });
  assert.equal(scheduled[0].delay, 280);
  scheduled[0].fn();
  assert.equal(action, "advance");
});

test("cancel prevents a previous-page continuation", () => {
  let cleared = null;
  let callback = null;
  let action = "";
  const flow = createSelectionFlow({
    setTimer(fn) {
      callback = fn;
      return 9;
    },
    clearTimer(id) {
      cleared = id;
    }
  });
  flow.schedule({ token: "u:5:1:4", action: "advance", run(value) { action = value; } });
  flow.cancel();
  callback();
  assert.equal(cleared, 9);
  assert.equal(action, "");
});
