import assert from "node:assert/strict";
import test from "node:test";
import { collectRouteNodes } from "./route-discovery.mjs";
import { buildCoreRoutesQuery, buildRoutesQuery } from "./route-query.mjs";

for (const core of [false, true]) test(`completed ${core ? "core" : "generic"} connections stop resolving while content pagination continues`, async () => {
  const names = core ? ["pages", "posts", "categories", "tags", "users"] : ["contentNodes", "terms", "users"];
  const connections = names.map((responseName) => ({
    responseName,
    cursorName: `${responseName}After`,
    routeConnectionName: responseName,
  }));
  const resolved = Object.fromEntries(names.map((name) => [name, 0]));
  const query = core ? buildCoreRoutesQuery() : buildRoutesQuery();
  const result = await collectRouteNodes(async (document, variables) => {
    const data = { readingSettings: { pageOnFront: 1 } };
    for (const name of names) {
      const flag = `skip${name[0].toUpperCase()}${name.slice(1)}`;
      assert.match(document, new RegExp(`\\$${flag}: Boolean! = false`));
      assert.match(document, new RegExp(`${name}\\(first:[^\\n]+@skip\\(if: \\$${flag}\\)`));
      if (variables[flag]) continue;
      resolved[name] += 1;
      const hasNextPage = name === names[0] && resolved[name] < 8;
      data[name] = {
        nodes: [{ id: `${name}:${resolved[name]}` }],
        pageInfo: { hasNextPage, endCursor: `${name}:${resolved[name]}` },
      };
    }
    return { data };
  }, query, connections, "test discovery");
  assert.deepEqual(resolved, Object.fromEntries(names.map((name, index) => [name, index ? 1 : 8])));
  assert.equal(result.discoveredNodes.length, 8 + names.length - 1);
  assert.deepEqual(result.readingSettings, { pageOnFront: 1 });
});

test("route discovery still rejects an incomplete active connection", async () => {
  await assert.rejects(collectRouteNodes(async () => ({ data: {} }), buildRoutesQuery(), [
    { responseName: "contentNodes", cursorName: "contentAfter", routeConnectionName: "contentNodes" },
  ], "routes"), /omitted contentNodes/);
});

test("isolated core connections declare only their own pagination and skip variables", () => {
  const query = buildCoreRoutesQuery({ connections: ["posts"] });
  assert.match(query, /\$postAfter: String, \$skipPosts: Boolean! = false/);
  assert.doesNotMatch(query, /\$(?:pageAfter|categoryAfter|tagAfter|userAfter|skipPages|skipCategories|skipTags|skipUsers)/);
});
