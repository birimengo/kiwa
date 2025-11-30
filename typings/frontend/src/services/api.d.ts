
declare interface methodsType {}

declare interface productsConfigType {
	static requiredFields: (string | any)[];

	static customValidations: {
	static sellingPrice: Function;

	static purchasePrice: Function;

	static stock: Function;
	};
}

declare interface productsAPIType {
	static getProducts: any;

	static getProduct: any;

	static createProduct: any;

	static updateProduct: any;

	static deleteProduct: any;

	static likeProduct: Function;

	static addComment: Function;

	static getFeaturedProducts: Function;

	static getProductsByCategory: Function;

	static restockProduct: Function;

	static getStockHistory: Function;

	static getProductPerformance: Function;

	static getProductStats: Function;
}

declare interface salesConfigType {
	static requiredFields: any[];

	static customValidations: {
	static items: Function;
	};
}

declare interface salesAPIType {
	static getSales: any;

	static getSale: any;

	static createSale: any;

	static updateSale: any;

	static deleteSale: any;

	static updatePayment: Function;

	static cancelSale: Function;

	static resumeSale: Function;

	static getSalesStats: Function;

	static getSalesAnalytics: Function;
}

declare interface authConfigType {
	static requiredFields: (string | any)[];

	static idRequired: boolean;
}

declare interface authAPIType {
	static getProfile: any;

	static updateProfile: any;

	static login: Function;

	static register: Function;

	static changePassword: Function;

	static logout: Function;
}

declare interface cartConfigType {
	static idRequired: boolean;
}

declare interface cartAPIType {
	static getCart: any;

	static clearCart: any;

	static addToCart: Function;

	static updateCartItem: Function;

	static removeFromCart: Function;
}

declare interface ordersAPIType {
	static getOrders: any;

	static getOrder: any;

	static createOrder: any;

	static updateOrder: any;

	static deleteOrder: any;

	static updateOrderStatus: Function;
}

declare interface analyticsAPIType {
	static getSalesOverview: Function;

	static getProductAnalytics: Function;

	static getInventoryAnalytics: Function;

	static getPerformanceMetrics: Function;

	static getDailyPerformance: Function;

	static getProductTracking: Function;
}

declare interface dashboardAPIType {
	static getOverview: Function;

	static getQuickStats: Function;

	static getRecentActivity: Function;
}
