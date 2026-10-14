import test from "node:test";
import assert from "node:assert/strict";
import {
  makeId,
  moneyInput,
  parseMoney,
  removeProduct,
  validateCatalog,
} from "../src/catalogForm.ts";
import { cleanCatalog } from "../server/catalog.mjs";
import type { Catalog } from "../src/Commerce.tsx";

test("prices typed in Turkish or English style become minor units", () => {
  assert.equal(parseMoney("199"), 19900);
  assert.equal(parseMoney("199,90"), 19990);
  assert.equal(parseMoney("199.9"), 19990);
  assert.equal(parseMoney("1.299,90"), 129990);
  assert.equal(parseMoney("1,299.90"), 129990);
  assert.equal(parseMoney("1.299"), 129900);
  assert.equal(parseMoney("₺ 49,5"), 4950);
  assert.equal(parseMoney(""), 0);
  assert.equal(parseMoney("-5"), null);
  assert.equal(parseMoney("1,2,3,4"), null);
  assert.equal(moneyInput(129990, "en-US"), "1299.90");
  assert.equal(moneyInput(129990, "tr-TR"), "1299,90");
});

test("ids are readable, ASCII and unique", () => {
  assert.equal(makeId("Şık Çanta Ölçü", []), "sik-canta-olcu");
  assert.equal(makeId("Aura Mini", ["aura-mini"]), "aura-mini-2");
  assert.equal(makeId("!!!", [], "product"), "product");
});

const valid = (): Catalog => ({
  source: "local",
  products: [
    {
      id: "a",
      title: "A",
      description: "",
      currency: "TRY",
      images: ["/assets/headphones.svg"],
      metafields: {},
      variants: [
        {
          id: "a-1",
          title: "S",
          price: 1000,
          comparePrice: 1500,
          stock: 2,
          image: "",
          options: { Size: "S" },
        },
      ],
    },
  ],
  collections: [
    { id: "c", title: "C", description: "", image: "", productIds: ["a"] },
  ],
});

test("the form validation accepts what the server accepts and names fields", () => {
  const catalog = valid();
  assert.deepEqual(validateCatalog(catalog), []);
  assert.doesNotThrow(() => cleanCatalog(catalog));
  catalog.products.push({ ...structuredClone(catalog.products[0]), title: "" });
  catalog.products[0].variants[0].comparePrice = 500;
  catalog.products[0].variants.push({
    ...catalog.products[0].variants[0],
    stock: -1,
  });
  catalog.collections[0].image = "javascript:alert(1)";
  const issues = validateCatalog(catalog).map((i) => `${i.path}/${i.field}`);
  assert.deepEqual(issues.sort(), [
    "collection:0/image",
    "product:0:variant:0/comparePrice",
    "product:0:variant:1/comparePrice",
    "product:0:variant:1/id",
    "product:0:variant:1/stock",
    "product:1/id",
    "product:1/title",
  ]);
});

test("deleting a product removes it from collections too", () => {
  const catalog = removeProduct(valid(), "a");
  assert.equal(catalog.products.length, 0);
  assert.deepEqual(catalog.collections[0].productIds, []);
  assert.deepEqual(validateCatalog(catalog), []);
});
