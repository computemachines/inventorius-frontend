const test = require("node:test");
const assert = require("node:assert/strict");

const {
  overlaySchemaProperties,
  persistedMixins,
  encodeChangedSchemaValues,
  valuesForSchemaEvaluation,
  valueForSchemaInput,
  valueFromSchemaInput,
} = require("../src/components/composites/schema-property-values");

test("schema overlay preserves every untouched opaque property", () => {
  const original = {
    enabled: false,
    measure: { unit: "kg", value: 2.5 },
    nested: { source: ["A", null, { exact: true }] },
    list: [1, "two", false],
    unknown: null,
    edited: "before",
    _mixins: ["Existing"],
  };

  const result = overlaySchemaProperties(
    original,
    { edited: "after" },
    ["edited"],
    ["Existing", "Triggered"],
  );

  assert.deepEqual(result, {
    ...original,
    edited: "after",
    _mixins: ["Existing", "Triggered"],
  });
  assert.strictEqual(result.measure, original.measure);
  assert.strictEqual(result.nested, original.nested);
  assert.strictEqual(result.list, original.list);
});

test("only an explicitly cleared schema field is removed", () => {
  assert.deepEqual(
    overlaySchemaProperties(
      { cleared: "old", unavailable: "keep", flag: false },
      { cleared: "" },
      ["cleared"],
      [],
    ),
    { unavailable: "keep", flag: false },
  );
});

test("numeric and unit inputs retain lexical edits and encode API value shapes", () => {
  const numberField = { name: "count", type: "number" };
  const unitField = { name: "mass", type: "unit", unit: "kg" };

  assert.equal(valueFromSchemaInput(numberField, "1."), "1.");
  assert.equal(valueFromSchemaInput(unitField, "-"), "-");
  const encoded = encodeChangedSchemaValues(
    { count: "12.5", mass: "2.75" },
    [numberField, unitField],
    ["count", "mass"],
  );
  assert.deepEqual(encoded, {
    values: { count: 12.5, mass: { unit: "kg", value: 2.75 } },
    invalidNames: [],
  });
  assert.equal(
    valueForSchemaInput(unitField, { unit: "kg", value: 2.75 }),
    "2.75",
  );
});

test("evaluation unwraps stored units and incomplete numeric input is invalid", () => {
  assert.deepEqual(
    valuesForSchemaEvaluation({ mass: { unit: "kg", value: 2.75 }, flag: false }),
    { mass: 2.75, flag: false },
  );
  assert.deepEqual(
    encodeChangedSchemaValues(
      { mass: "-" },
      [{ name: "mass", type: "unit", unit: "kg" }],
      ["mass"],
    ).invalidNames,
    ["mass"],
  );
});

test("configured and resource-ID roots are not persisted as explicit mixins", () => {
  assert.deepEqual(
    persistedMixins(
      ["ItemTypeSelector", "Description", "Resistor", "SKU000001"],
      ["ItemTypeSelector", "Description"],
      ["SKU000001"],
    ),
    ["Resistor"],
  );
});

test("an original empty _mixins array survives an unrelated schema edit", () => {
  assert.deepEqual(
    overlaySchemaProperties(
      { _mixins: [], Description: "old" },
      { Description: "new" },
      ["Description"],
      [],
    ),
    { _mixins: [], Description: "new" },
  );
});

test("flexible measurements preserve lexical values and per-item units", () => {
  const field = { name: "length", type: "unit" };
  assert.deepEqual(valueForSchemaInput(field, { value: 36, unit: "yd" }), { value: "36", unit: "yd" });
  assert.deepEqual(valueForSchemaInput(field, { value: "1.", unit: "mm" }), { value: "1.", unit: "mm" });
  assert.deepEqual(encodeChangedSchemaValues({ length: { value: "36", unit: " yd " } }, [field], ["length"]), {
    values: { length: { value: 36, unit: "yd" } }, invalidNames: [],
  });
  assert.deepEqual(encodeChangedSchemaValues({ length: { value: "36", unit: "" } }, [field], ["length"]).invalidNames, ["length"]);
  assert.deepEqual(encodeChangedSchemaValues({ length: { value: "-", unit: "yd" } }, [field], ["length"]).invalidNames, ["length"]);
  assert.deepEqual(encodeChangedSchemaValues({ length: { value: "", unit: "" } }, [field], ["length"]).values, { length: "" });
  assert.deepEqual(valuesForSchemaEvaluation({ length: { value: "36", unit: "yd" } }), { length: "36" });
});

test("item references preserve ID arrays and reject lookup text or bin IDs", () => {
  const single = { name: "tool", type: "item-reference" };
  const list = { name: "related", type: "item-reference-list" };
  assert.deepEqual(encodeChangedSchemaValues({ tool: "sku3", related: ["bat2", "SKU3", "bat2", ""] }, [single, list], ["tool", "related"]), {
    values: { tool: "SKU000003", related: ["BAT000002", "SKU000003"] }, invalidNames: [],
  });
  assert.deepEqual(valueForSchemaInput(list, ["SKU000003", "BAT000002"]), ["SKU000003", "BAT000002"]);
  assert.deepEqual(encodeChangedSchemaValues({ tool: "BIN000001", related: ["some tool"] }, [single, list], ["tool", "related"]).invalidNames, ["tool", "related"]);
  assert.deepEqual(encodeChangedSchemaValues({ related: [] }, [list], ["related"]).values, { related: [] });
  const { displayedItemReferences } = require("../src/components/composites/item-references");
  assert.deepEqual(displayedItemReferences('["SKU000003","BAT000002"]'), ["SKU000003", "BAT000002"]);
  assert.equal(displayedItemReferences('[null]'), null);
  assert.equal(displayedItemReferences('["text","SKU000003"]'), null);
});
