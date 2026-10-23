import {test} from "node:test";
import assert from "node:assert/strict";
import {
		integer,
		MAX_IMAGE_BYTES,
		MAX_INTEGER,
		MAX_ORDER_POSITION,
		minorToPrice,
		orderToPosition,
		positionToOrder,
		priceToMinor,
		productDraft,
		productPayload,
		sameMediaScope,
		validateImage
} from "../src/pages/admin/products/product-form.js";
import {employeeDraft, employeePayload} from "../src/pages/admin/users/employee-form.js";
import {formatPriceMinor} from "../src/utils/format.js";

test("prices convert to minor units without floating point rounding", () => {
		for (const [input, expected] of [["0", 0], ["0.01", 1], ["1.01", 101], ["12600,50", 1260050], [" 12.3 ", 1230], ["90071992547409.91", Number.MAX_SAFE_INTEGER]]) {
				assert.equal(priceToMinor(input), expected);
				assert.equal(priceToMinor(minorToPrice(expected)), expected);
		}
});

test("invalid or unsafe prices are rejected", () => {
		for (const input of ["", " ", "-1", "1.001", "1e3", "Infinity", "NaN", "90071992547409.92"]) assert.throws(() => priceToMinor(input));
});

test("price display keeps nonzero kopecks", () => {
		assert.equal(formatPriceMinor(1260050), "12\u00a0600,50 ₽");
		assert.equal(formatPriceMinor(1260000), "12\u00a0600 ₽");
		assert.equal(formatPriceMinor(1, "EUR"), "0,01 EUR");
});

test("product payload trims required strings and uses actual numbers", () => {
		const draft = {
				...productDraft(),
				name: " Model ",
				slug: " model ",
				model_code: " EN-1 ",
				category: " Towel warmers ",
				short_description: " Short ",
				description: " Long ",
				heater_type: " Dry ",
				max_temperature: "60",
				warranty_months: "0",
				sort_order: "2"
		};
		const result = productPayload(draft);
		assert.equal(result.name, "Model");
		assert.equal(result.max_temperature, 60);
		assert.equal(result.warranty_months, 0);
		assert.equal(result.sort_order, 1);
		assert.equal(result.is_published, false);
		assert.equal(draft.name, " Model ");
		assert.throws(() => productPayload({...draft, description: "  "}));
		assert.throws(() => productPayload({...draft, max_temperature: "0"}));
});

test("integer fields follow database bounds", () => {
		assert.equal(integer("0", "field"), 0);
		assert.equal(integer("2147483647", "field"), 2147483647);
		for (const value of ["", " ", "-1", "1.5", "2147483648", "NaN"]) assert.throws(() => integer(value, "field"));
});

test("admin positions start at one while API order stays zero-based", () => {
		assert.equal(productDraft().sort_order, 1);
		assert.equal(productDraft({sort_order: 0}).sort_order, 1);
		assert.equal(productDraft({sort_order: 8}).sort_order, 9);
		for (const order of [0, 1, 8, MAX_INTEGER]) {
				assert.equal(positionToOrder(orderToPosition(order)), order);
				assert.equal(positionToOrder(String(order + 1)), order);
		}
		assert.equal(orderToPosition(MAX_INTEGER), MAX_ORDER_POSITION);
});

test("zero and invalid display positions cannot be submitted", () => {
		for (const value of ["", " ", 0, "0", -1, 1.5, NaN, Infinity, MAX_ORDER_POSITION + 1]) {
				assert.throws(() => positionToOrder(value));
		}
});

test("saving an unchanged product does not shift its API order", () => {
		const product = {
				name: "Model",
				slug: "model",
				model_code: "EN-1",
				category: "Warmers",
				short_description: "Short",
				description: "Full",
				heater_type: "Dry",
				max_temperature: 60,
				warranty_months: 24,
				sort_order: 0,
				is_published: false
		};
		assert.deepEqual(productPayload(productDraft(product)), product);
		assert.equal(productPayload({...productDraft(product), sort_order: 4}).sort_order, 3);
});

test("media validates supported MIME types and the 10 MiB boundary", () => {
		for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.doesNotThrow(() => validateImage({
				type,
				size: MAX_IMAGE_BYTES
		}));
		for (const file of [null, {type: "image/png", size: 0}, {type: "image/svg+xml", size: 10}, {
				type: "image/png",
				size: MAX_IMAGE_BYTES + 1
		}]) assert.throws(() => validateImage(file));
});

test("primary images are compared within exactly one product/color/variant scope", () => {
		const media = {product_id: "product", variant_id: null, body_color_id: null};
		assert.equal(sameMediaScope(media, {...media}), true);
		assert.equal(sameMediaScope(media, {...media, product_id: "other"}), false);
		assert.equal(sameMediaScope(media, {...media, variant_id: "variant"}), false);
		assert.equal(sameMediaScope(media, {...media, body_color_id: "color"}), false);
});

test("employee creation preserves passwords and trims name/login", () => {
		const result = employeePayload({
				...employeeDraft("create"),
				name: " Anna ",
				login: " anna ",
				password: " long password "
		}, "create");
		assert.deepEqual(result, {name: "Anna", login: "anna", password: " long password ", role: "manager"});
		assert.throws(() => employeePayload({
				...employeeDraft("create"),
				name: "Anna",
				login: "anna",
				password: "short"
		}, "create"));
});

test("employee PATCH omits unchanged fields and explicitly clears Telegram", () => {
		const initial = employeeDraft("edit", "user-id");
		assert.throws(() => employeePayload(initial, "edit"));
		assert.deepEqual(employeePayload({...initial, name: "Anna"}, "edit"), {name: "Anna"});
		assert.deepEqual(employeePayload({...initial, telegram_action: "clear"}, "edit"), {telegram_user_id: null});
		assert.deepEqual(employeePayload({...initial, is_active: "false"}, "edit"), {is_active: false});
		assert.deepEqual(employeePayload({
				...initial,
				telegram_action: "set",
				telegram_user_id: "123456789"
		}, "edit"), {telegram_user_id: 123456789});
		assert.throws(() => employeePayload({
				...initial,
				telegram_action: "set",
				telegram_user_id: "9007199254740992"
		}, "edit"));
});
