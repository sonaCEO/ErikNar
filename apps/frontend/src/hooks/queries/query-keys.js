export const queryKeys = {
		products: ["catalog", "products"],
		product: (slug) => ["catalog", "products", slug],
		me: ["auth", "me"],
		adminLeads: (filters) => ["admin", "leads", filters],
		adminLead: (leadId) => ["admin", "leads", "detail", leadId],
		adminProducts: (page) => ["admin", "catalog", "products", page],
		adminProduct: (id) => ["admin", "catalog", "product", id],
		adminMedia: (id) => ["admin", "catalog", "media", id],
		adminVariants: (productId) => ["admin", "catalog", "variants", productId],
		adminBodyColors: ["admin", "catalog", "body-colors"],
		adminPanelColors: ["admin", "catalog", "panel-colors"],
		adminControlTypes: ["admin", "catalog", "control-types"],
		adminUsers: (page) => ["admin", "users", "page", page],
		adminUsersAll: ["admin", "users", "all"],
		adminUser: (id) => ["admin", "users", "detail", id],
};

export const catalogOptionQueryKeys = {
		body_color: queryKeys.adminBodyColors,
		panel_color: queryKeys.adminPanelColors,
		control_type: queryKeys.adminControlTypes,
};
