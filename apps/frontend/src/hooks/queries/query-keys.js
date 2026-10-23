export const queryKeys = {
		products: ["catalog", "products"],
		product: (slug) => ["catalog", "products", slug],
		me: ["auth", "me"],
		adminLeads: (filters) => ["admin", "leads", filters],
		adminLead: (leadId) => ["admin", "leads", "detail", leadId],
		adminProducts: (page) => ["admin", "catalog", "products", page],
		adminProduct: (id) => ["admin", "catalog", "product", id],
		adminMedia: (id) => ["admin", "catalog", "media", id],
		adminVariants: (id) => ["admin", "catalog", "session-variants", id],
		adminOptions: ["admin", "catalog", "session-options"],
		adminEmployees: ["admin", "session-employees"],
};
