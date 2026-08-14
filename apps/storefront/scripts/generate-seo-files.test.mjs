import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  discoverWordPressSitemapChildren,
  generateSeoFiles,
  normalizeAtomDocument,
} from "./generate-seo-files.mjs";

async function withOutputDirectory(run) {
  const outputDirectory = await mkdtemp(join(tmpdir(), "funky-seo-files-"));
  try {
    await run(outputDirectory);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

test("retries a transient product feed failure and writes only the canonical XML document", async () => {
  await withOutputDirectory(async (outputDirectory) => {
    let productFeedAttempts = 0;
    const fetchImpl = async (url) => {
      if (url.pathname !== "/product-feed.xml") return new Response("", { status: 404 });
      productFeedAttempts += 1;
      if (productFeedAttempts === 1) return new Response("", { status: 503 });
      return new Response("debug output\n<?xml version=\"1.0\"?><rss><channel /></rss>");
    };

    await generateSeoFiles({
      graphqlEndpoint: "https://cms.example.com/graphql",
      outputDirectory,
      fetchImpl,
      maxAttempts: 2,
      retryDelay: async () => {},
    });

    assert.equal(productFeedAttempts, 2);
    assert.equal(
      await readFile(join(outputDirectory, "product-feed.xml"), "utf8"),
      "<?xml version=\"1.0\"?><rss><channel /></rss>\n",
    );
    await assert.rejects(readFile(join(outputDirectory, "product.feed.xml"), "utf8"), { code: "ENOENT" });
  });
});

test("keeps existing feed output when backend XML documents remain unavailable", async () => {
  await withOutputDirectory(async (outputDirectory) => {
    const fallbackRss = "<?xml version=\"1.0\"?><rss><channel /></rss>\n";
    const warnings = [];
    await writeFile(join(outputDirectory, "feed.xml"), fallbackRss, "utf8");

    await generateSeoFiles({
      graphqlEndpoint: "https://cms.example.com/graphql",
      outputDirectory,
      fetchImpl: async () => {
        throw new Error("backend offline");
      },
      maxAttempts: 2,
      retryDelay: async () => {},
      warn: (message) => warnings.push(message),
    });

    assert.equal(await readFile(join(outputDirectory, "feed.xml"), "utf8"), fallbackRss);
    assert.ok(warnings.some((message) => message.includes("backend offline")));
    assert.ok(warnings.every((message) => message.includes("Keeping existing build output.")));
  });
});

test("never overwrites route sitemap, robots, or configured AI documents", async () => {
  await withOutputDirectory(async (outputDirectory) => {
    const controlledFiles = {
      "sitemap.xml": "<?xml version=\"1.0\"?><urlset />\n",
      "robots.txt": "User-agent: *\nAllow: /\n",
      "llms.txt": "Configured llms content\n",
      "ai-products.jsonld": "{\"configured\":true}\n",
    };
    await Promise.all(
      Object.entries(controlledFiles).map(([filename, contents]) =>
        writeFile(join(outputDirectory, filename), contents, "utf8")),
    );

    await generateSeoFiles({
      graphqlEndpoint: "https://cms.example.com/graphql",
      outputDirectory,
      fetchImpl: async () => new Response("<b>Warning</b>: debug output", { status: 200 }),
      maxAttempts: 1,
      warn: () => {},
    });

    for (const [filename, contents] of Object.entries(controlledFiles)) {
      assert.equal(await readFile(join(outputDirectory, filename), "utf8"), contents);
    }
  });
});

test("stores the WordPress sitemap separately from the storefront route sitemap", async () => {
  await withOutputDirectory(async (outputDirectory) => {
    const routeSitemap = "<?xml version=\"1.0\"?><urlset><url><loc>https://shop.example.com/</loc></url></urlset>\n";
    const wordpressSitemap = "<?xml version=\"1.0\"?><sitemapindex><sitemap><loc>https://cms.example.com/wp-sitemap-posts.xml</loc></sitemap></sitemapindex>";
    const childSitemap = "<?xml version=\"1.0\"?><urlset><url><loc>https://cms.example.com/post/</loc></url></urlset>";
    await writeFile(join(outputDirectory, "sitemap.xml"), routeSitemap, "utf8");

    await generateSeoFiles({
      graphqlEndpoint: "https://cms.example.com/graphql",
      outputDirectory,
      fetchImpl: async (url) => {
        if (url.pathname === "/wp-sitemap.xml") return new Response(wordpressSitemap);
        if (url.pathname === "/wp-sitemap-posts.xml") return new Response(childSitemap);
        return new Response("", { status: 404 });
      },
    });

    assert.equal(await readFile(join(outputDirectory, "sitemap.xml"), "utf8"), routeSitemap);
    assert.match(await readFile(join(outputDirectory, "wp-sitemap.xml"), "utf8"), /<sitemapindex>/);
    assert.match(await readFile(join(outputDirectory, "wp-sitemap-posts.xml"), "utf8"), /<urlset>/);
  });
});

test("discovers only root-level WordPress child sitemaps from the configured backend", () => {
  const sitemap = `<?xml version="1.0"?>
<sitemapindex>
  <sitemap><loc>https://cms.example.com/wp-sitemap-posts-post-1.xml?page=2&amp;lang=en</loc></sitemap>
  <sitemap><loc>/wp-sitemap-taxonomies-category-1.xml</loc></sitemap>
  <sitemap><loc>https://other.example.com/wp-sitemap-users-1.xml</loc></sitemap>
  <sitemap><loc>https://cms.example.com/nested/wp-sitemap-posts-page-1.xml</loc></sitemap>
  <sitemap><loc>https://cms.example.com/sitemap.xml</loc></sitemap>
</sitemapindex>`;

  assert.deepEqual(
    discoverWordPressSitemapChildren(sitemap, "https://cms.example.com"),
    [
      {
        filename: "wp-sitemap-posts-post-1.xml",
        path: "/wp-sitemap-posts-post-1.xml?page=2&lang=en",
      },
      {
        filename: "wp-sitemap-taxonomies-category-1.xml",
        path: "/wp-sitemap-taxonomies-category-1.xml",
      },
    ],
  );
  assert.deepEqual(
    discoverWordPressSitemapChildren("<urlset><loc>/wp-sitemap-posts.xml</loc></urlset>", "https://cms.example.com"),
    [],
  );
});

test("normalizes Atom metadata to a valid public storefront feed", () => {
  const atom = `debug
<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Example Store</title>
  <subtitle type="text"></subtitle>
  <link rel="alternate" type="text/html" href="" />
  <id>https://cms.example.com/feed/atom/</id>
  <link rel="self" type="application/atom+xml" href="https://cms.example.com/feed/atom/" />
  <entry>
    <author><name>Editor</name><uri>http://127.0.0.1</uri></author>
    <id>https://cms.example.com/?p=42</id>
    <category scheme="" term="News" />
    <link rel="replies" type="application/atom+xml" href="https://cms.example.com/post/feed/atom/" />
  </entry>
</feed>`;

  const normalized = normalizeAtomDocument(atom, {
    backendOrigin: "https://cms.example.com",
    frontendOrigin: "https://shop.example.com",
  });

  assert.match(normalized, /<subtitle type="text">Example Store<\/subtitle>/);
  assert.match(normalized, /rel="alternate" type="text\/html" href="https:\/\/shop\.example\.com\/"/);
  assert.match(normalized, /rel="self" type="application\/atom\+xml" href="https:\/\/shop\.example\.com\/atom\.xml"/);
  assert.match(normalized, /category scheme="https:\/\/shop\.example\.com\/"/);
  assert.match(normalized, /<id>https:\/\/shop\.example\.com\/\?p=42<\/id>/);
  assert.doesNotMatch(normalized, /cms\.example\.com|127\.0\.0\.1|application\/atom\+xml[^>]+replies/);
});

test("derives the public Atom origin from the feed ID when no deployment URL is available", () => {
  const atom = `<?xml version="1.0"?><feed><title>Store</title><link rel="alternate" href="" /><id>https://shop.example.com/atom.xml</id><link rel="self" href="https://cms.example.com/feed/atom/" /><entry><category scheme="" term="News" /></entry></feed>`;
  const normalized = normalizeAtomDocument(atom, {
    backendOrigin: "https://cms.example.com",
    frontendOrigin: null,
  });

  assert.match(normalized, /href="https:\/\/shop\.example\.com\/atom\.xml"/);
  assert.match(normalized, /scheme="https:\/\/shop\.example\.com\/"/);
  assert.doesNotMatch(normalized, /cms\.example\.com|scheme=""/);
});

test("uses the theme Atom endpoint before the native Atom fallback", async () => {
  await withOutputDirectory(async (outputDirectory) => {
    const atom = `<?xml version="1.0"?><feed><title>Store</title><subtitle></subtitle><link rel="alternate" href="" /><link rel="self" href="https://cms.example.com/feed/atom/" /><entry><category scheme="" term="News" /></entry></feed>`;
    const requestedPaths = [];

    await generateSeoFiles({
      graphqlEndpoint: "https://cms.example.com/graphql",
      siteUrl: "https://shop.example.com",
      outputDirectory,
      fetchImpl: async (url) => {
        requestedPaths.push(url.pathname);
        return url.pathname === "/atom.xml"
          ? new Response(atom)
          : new Response("", { status: 404 });
      },
    });

    const output = await readFile(join(outputDirectory, "atom.xml"), "utf8");
    assert.match(output, /href="https:\/\/shop\.example\.com\/atom\.xml"/);
    assert.match(output, /scheme="https:\/\/shop\.example\.com\/"/);
    assert.ok(requestedPaths.includes("/atom.xml"));
    assert.ok(!requestedPaths.includes("/feed/atom/"));
  });
});

test("falls back to the native Atom endpoint when the theme feed is invalid", async () => {
  await withOutputDirectory(async (outputDirectory) => {
    const atom = `<?xml version="1.0"?><feed><title>Store</title><id>https://cms.example.com/feed/atom/</id><link rel="self" href="https://cms.example.com/feed/atom/" /></feed>`;
    const requestedPaths = [];
    const warnings = [];

    await generateSeoFiles({
      graphqlEndpoint: "https://cms.example.com/graphql",
      siteUrl: "https://shop.example.com",
      outputDirectory,
      fetchImpl: async (url) => {
        requestedPaths.push(url.pathname);
        if (url.pathname === "/atom.xml") return new Response("<html>Theme feed unavailable</html>");
        if (url.pathname === "/feed/atom/") return new Response(atom);
        return new Response("", { status: 404 });
      },
      warn: (message) => warnings.push(message),
    });

    const output = await readFile(join(outputDirectory, "atom.xml"), "utf8");
    assert.match(output, /<feed>/);
    assert.match(output, /https:\/\/shop\.example\.com\/atom\.xml/);
    assert.deepEqual(
      requestedPaths.filter((path) => path.includes("atom")),
      ["/atom.xml", "/feed/atom/"],
    );
    assert.ok(warnings.some((message) => message.includes("trying the native Atom fallback")));
  });
});

test("falls back to the native Atom endpoint when the theme feed is missing", async () => {
  await withOutputDirectory(async (outputDirectory) => {
    const atom = `<?xml version="1.0"?><feed><title>Store</title><id>https://cms.example.com/feed/atom/</id></feed>`;
    const requestedPaths = [];

    await generateSeoFiles({
      graphqlEndpoint: "https://cms.example.com/graphql",
      siteUrl: "https://shop.example.com",
      outputDirectory,
      fetchImpl: async (url) => {
        requestedPaths.push(url.pathname);
        if (url.pathname === "/feed/atom/") return new Response(atom);
        return new Response("", { status: 404 });
      },
    });

    assert.match(await readFile(join(outputDirectory, "atom.xml"), "utf8"), /<feed>/);
    assert.deepEqual(
      requestedPaths.filter((path) => path.includes("atom")),
      ["/atom.xml", "/feed/atom/"],
    );
  });
});
