import {test} from "node:test";
import assert from "node:assert/strict";
import {getBodyColors, getSizes, selectVariant, sortMedia} from "../src/utils/variant.js";

const variant = (id, color, width, control = "button", panel = "black") => ({
		id, width_mm: width, height_mm: 800,
		body_color: {id: color, name: color}, control_type: {id: control}, panel_color: {id: panel},
});

test("color selection preserves size and controls when the combination exists", () => {
		const current = variant("black-small", "black", 400);
		const whiteLarge = variant("white-large", "white", 600);
		const whiteSmall = variant("white-small", "white", 400);
		assert.equal(selectVariant([current, whiteLarge, whiteSmall], current, {bodyColorId: "white"}), whiteSmall);
});

test("sparse color choices always select a real matching variant", () => {
		const current = variant("black-small", "black", 400);
		const whiteLarge = variant("white-large", "white", 600, "wifi");
		assert.equal(selectVariant([current, whiteLarge], current, {bodyColorId: "white"}), whiteLarge);
});

test("size and control changes preserve the current color and panel", () => {
		const current = variant("small", "black", 400);
		const variants = [current, variant("other-color", "white", 600), variant("wrong-panel", "black", 600, "button", "white"), variant("same-color", "black", 600), variant("wifi", "black", 400, "wifi")];
		assert.equal(selectVariant(variants, current, {widthMm: 600, heightMm: 800}).id, "same-color");
		assert.equal(selectVariant(variants, current, {controlTypeId: "wifi"}).id, "wifi");
});

test("unavailable choices and empty products do not invent a variant", () => {
		const current = variant("small", "black", 400);
		assert.equal(selectVariant([current], current, {bodyColorId: "missing"}), current);
		assert.equal(selectVariant([], null, {bodyColorId: "missing"}), null);
});

test("panel selection keeps the chosen body, size and control", () => {
		const current = variant("black-panel", "black", 400, "wifi", "black");
		const otherColor = variant("other-color", "white", 400, "wifi", "white");
		const whitePanel = variant("white-panel", "black", 400, "wifi", "white");
		assert.equal(selectVariant([current, otherColor, whitePanel], current, {
				bodyColorId: "black", widthMm: 400, heightMm: 800, controlTypeId: "wifi", panelColorId: "white",
		}), whitePanel);
});

test("an unavailable option cannot change another explicitly selected dimension", () => {
		const current = variant("black-small", "black", 400);
		const whiteLarge = variant("white-large", "white", 600);
		assert.equal(selectVariant([current, whiteLarge], current, {
				bodyColorId: "black",
				widthMm: 600,
				heightMm: 800
		}), current);
});

test("color and size options are deduplicated", () => {
		const variants = [variant("one", "black", 400), variant("two", "black", 400, "wifi"), variant("three", "white", 600)];
		assert.deepEqual(getBodyColors(variants).map(color => color.id), ["black", "white"]);
		assert.deepEqual(getSizes(variants), [{width_mm: 400, height_mm: 800}, {width_mm: 600, height_mm: 800}]);
});

test("the selected variant uses its primary photo without mutating the gallery", () => {
		const media = [{id: "secondary", is_primary: false, sort_order: 0}, {
				id: "primary",
				is_primary: true,
				sort_order: 5
		}];
		assert.equal(sortMedia(media)[0].id, "primary");
		assert.equal(media[0].id, "secondary");
});
