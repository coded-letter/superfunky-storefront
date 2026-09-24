export async function collectRouteNodes(request, query, connections, operationLabel) {
  const discoveredNodes = [];
  let readingSettings;
  const cursors = Object.fromEntries(connections.map(({ cursorName }) => [cursorName, null]));
  const complete = Object.fromEntries(connections.map(({ responseName }) => [responseName, false]));

  while (!Object.values(complete).every(Boolean)) {
    const skip = Object.fromEntries(Object.entries(complete).map(([name, done]) => [
      `skip${name[0].toUpperCase()}${name.slice(1)}`, done,
    ]));
    const payload = await request(
      query,
      { ...cursors, ...skip },
      operationLabel,
      { attempts: 2, timeoutMs: 20_000 },
    );
    readingSettings ||= payload.data?.readingSettings;

    for (const { responseName, cursorName, routeConnectionName } of connections) {
      if (complete[responseName]) continue;
      const connection = payload.data?.[responseName];
      if (!connection) throw new Error(`${operationLabel} omitted ${responseName}`);

      for (const node of connection.nodes || []) {
        discoveredNodes.push({ node, connectionName: routeConnectionName });
      }

      const { hasNextPage, endCursor } = connection.pageInfo || {};
      if (typeof hasNextPage !== "boolean") {
        throw new Error(`${operationLabel} omitted pagination metadata for ${responseName}`);
      }
      if (hasNextPage && (!endCursor || endCursor === cursors[cursorName])) {
        throw new Error(`${operationLabel} returned an incomplete pagination cursor for ${responseName}`);
      }
      complete[responseName] = !hasNextPage;
      cursors[cursorName] = endCursor;
    }
  }

  return { discoveredNodes, readingSettings };
}
