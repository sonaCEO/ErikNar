import {apiFetch} from "./client";

export function createLead({variantId, customerName, phone, comment}, idempotencyKey) {
		return apiFetch("/leads", {
				method: "POST",
				idempotencyKey,
				body: {
						variant_id: variantId,
						customer_name: customerName,
						phone,
						comment: comment ?? "",
				},
		});
}
