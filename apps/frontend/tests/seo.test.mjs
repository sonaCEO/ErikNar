import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {env} from "node:process";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Helmet, HelmetProvider} from "react-helmet-async";
import {getPageMetadata, getSiteOrigin, OG_IMAGE_PATH} from "../src/components/seo/metadata.js";

test("home has one canonical and truthful Russian website metadata", () => {
		const metadata = getPageMetadata("home", "https://catalog.example.test");
		const tags = Object.fromEntries(metadata.meta.map(({name, property, content}) => [name ?? property, content]));
		assert.equal(Object.keys(tags).length, metadata.meta.length);
		assert.equal(metadata.title, "Электрические полотенцесушители ErikNar");
		assert.equal(tags.robots, "index, follow");
		assert.equal(tags["og:type"], "website");
		assert.equal(tags["og:locale"], "ru_RU");
		assert.equal(tags["og:title"], metadata.title);
		assert.equal(tags["twitter:title"], metadata.title);
		assert.equal(tags["og:description"], tags.description);
		assert.equal(tags["twitter:description"], tags.description);
		assert.equal(tags["twitter:card"], "summary_large_image");
		assert.deepEqual(metadata.link, [{rel: "canonical", href: "https://catalog.example.test/"}]);
		assert.equal(tags["og:url"], metadata.link[0].href);
		assert.equal(tags["og:image"], "https://catalog.example.test/og-image.jpg");
		assert.equal(tags["og:image:type"], "image/jpeg");
		assert.equal(tags["og:image:width"], "1200");
		assert.equal(tags["og:image:height"], "630");
		assert.equal(tags["twitter:image"], tags["og:image"]);
});

test("canonical and social URLs contain only the actual origin and fixed public paths", () => {
		for (const [input, expected] of [
				["https://user:password@CATALOG.example.test:443/private?token=secret#model", "https://catalog.example.test/"],
				["http://127.0.0.1:5173/?utm_source=test#collection", "http://127.0.0.1:5173/"],
		]) {
				const metadata = getPageMetadata("home", input);
				assert.equal(metadata.link[0].href, expected);
				assert.equal(metadata.meta.find((tag) => tag.property === "og:url").content, expected);
				assert.doesNotMatch(JSON.stringify(metadata), /password|secret|private|utm_source|#collection|#model/);
		}
});

test("unknown origins keep the supplied image without inventing a canonical domain", () => {
		for (const origin of [undefined, "", "not a URL", "/", "//example.test", "file:///preview/index.html", "data:text/html,preview", "javascript:alert(1)"]) {
				const metadata = getPageMetadata("home", origin);
				assert.deepEqual(metadata.link, []);
				assert.equal(getSiteOrigin(origin), undefined);
				assert.equal(metadata.meta.some((tag) => tag.property === "og:url"), false);
				assert.equal(metadata.meta.find((tag) => tag.property === "og:image").content, OG_IMAGE_PATH);
				assert.equal(metadata.meta.find((tag) => tag.name === "twitter:image").content, OG_IMAGE_PATH);
		}
});

test("login, all admin routes, errors and unknown pages have no public metadata", () => {
		for (const page of ["login", "admin", "notFound", "error", "unknown", undefined]) {
				const metadata = getPageMetadata(page, "https://catalog.example.test/admin?token=secret");
				assert.deepEqual(metadata.meta, [{name: "robots", content: "noindex, nofollow"}]);
				assert.deepEqual(metadata.link, []);
				assert.notEqual(metadata.title, getPageMetadata("home").title);
				assert.match(metadata.title, /ErikNar$/);
		}
});

test("static HTML fallback matches home metadata and is marked for removal before React mounts", async () => {
		const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
		const metadata = getPageMetadata("home");
		assert.match(html, /<html lang="ru">/);
		assert.deepEqual([...html.matchAll(/<title[^>]*>(.*?)<\/title>/g)].map((match) => match[0]), [`<title data-seo-static>${metadata.title}</title>`]);
		const tags = [...html.matchAll(/<meta\s+(name|property)="([^"]+)"\s+content="([^"]*)"\s+data-seo-static\s*\/>/g)]
				.map(([, attribute, value, content]) => ({[attribute]: value, content}));
		assert.deepEqual(tags, metadata.meta);
		assert.doesNotMatch(html, /rel="canonical"/);
});

test("OG metadata matches the supplied JPEG dimensions", async () => {
		const image = await readFile(new URL(`../public${OG_IMAGE_PATH}`, import.meta.url));
		assert.equal(image.readUInt16BE(0), 0xffd8);
		const tags = Object.fromEntries(getPageMetadata("home").meta.map(({name, property, content}) => [name ?? property, content]));
		for (let offset = 2; offset + 9 < image.length;) {
				const marker = image.readUInt16BE(offset);
				if ([0xffc0, 0xffc1, 0xffc2].includes(marker)) {
						assert.equal(Number(tags["og:image:width"]), image.readUInt16BE(offset + 7));
						assert.equal(Number(tags["og:image:height"]), image.readUInt16BE(offset + 5));
						return;
				}
				const length = image.readUInt16BE(offset + 2);
				assert.ok(length >= 2, "JPEG segment length must be valid");
				offset += length + 2;
		}
		assert.fail("JPEG frame dimensions were not found");
});

test("build configuration replaces static image paths with the configured site origin", async () => {
		const {default: configure} = await import("../vite.config.js");
		const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
		const previous = env.VITE_SITE_URL;
		try {
				env.VITE_SITE_URL = "https://catalog.example.test/path?token=ignored#fragment";
				const configured = configure({mode: "test"});
				const plugin = configured.plugins.find((entry) => entry?.name === "social-image-origin");
				const result = plugin.transformIndexHtml.handler(html);
				assert.equal([...result.html.matchAll(/content="https:\/\/catalog\.example\.test\/og-image\.jpg"/g)].length, 2);
				assert.equal(configured.define["import.meta.env.VITE_SITE_URL"], '"https://catalog.example.test"');
				assert.deepEqual(result.tags.map((tag) => tag.attrs), [
						{property: "og:url", content: "https://catalog.example.test/", "data-seo-static": true},
						{rel: "canonical", href: "https://catalog.example.test/", "data-seo-static": true},
				]);
				assert.doesNotMatch(JSON.stringify(result), /token=ignored|#fragment/);

				env.VITE_SITE_URL = "";
				const unconfigured = configure({mode: "test"});
				assert.equal(unconfigured.plugins.find((entry) => entry?.name === "social-image-origin").transformIndexHtml.handler(html), html);

				env.VITE_SITE_URL = "javascript:alert(1)";
				assert.throws(() => configure({mode: "test"}), /VITE_SITE_URL/);
		} finally {
				if (previous === undefined) delete env.VITE_SITE_URL;
				else env.VITE_SITE_URL = previous;
		}
});

test("Helmet renders a single metadata set with React 19", () => {
		for (const page of ["home", "login", "admin", "notFound", "error", "home"]) {
				const metadata = getPageMetadata(page, "https://catalog.example.test");
				const html = renderToStaticMarkup(createElement(HelmetProvider, null, createElement(Helmet, metadata)));
				assert.equal([...html.matchAll(/<title>/g)].length, 1);
				assert.equal([...html.matchAll(/name="robots"/g)].length, 1);
				assert.equal([...html.matchAll(/name="description"/g)].length, page === "home" ? 1 : 0);
				assert.equal([...html.matchAll(/rel="canonical"/g)].length, page === "home" ? 1 : 0);
				assert.equal([...html.matchAll(/property="og:title"/g)].length, page === "home" ? 1 : 0);
		}
});
