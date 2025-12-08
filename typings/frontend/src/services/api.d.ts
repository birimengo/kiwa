
declare interface userFieldMapType {}

declare interface methodsType {}

declare interface productsConfigType {
	static requiredFields: (string | any)[];

	static customValidations: {
	static sellingPrice: Function;

	static purchasePrice: Function;

	static stock: Function;
	};

	static endpointType: string;
}

declare interface productsAPIType {
	static getProducts: any;

	static getProduct: any;

	static createProduct: any;

	static updateProduct: any;

	static deleteProduct: any;

	static getAdminProducts: Function;

	static likeProduct: Function;

	static addComment: Function;

	static getFeaturedProducts: Function;

	static getProductsByCategory: Function;

	static restockProduct: Function;

	static getStockHistory: Function;

	static getProductPerformance: Function;

	static getProductStats: Function;

	static getTopProductsAnalytics: Function;

	static getProductTracking: Function;
}

declare interface salesConfigType {
	static requiredFields: any[];

	static customValidations: {
	static items: Function;
	};

	static endpointType: string;
}

declare interface salesAPIType {
	static getSales: any;

	static getSale: any;

	static createSale: any;

	static updateSale: any;

	static deleteSale: any;

	static getAdminSales: {	};

	static getAdminSalesStats: {	};

	static updatePayment: Function;

	static cancelSale: Function;

	static resumeSale: Function;

	static getSalesStats: Function;

	static getSalesAnalytics: Function;
}

declare interface authConfigType {
	static requiredFields: (string | any)[];

	static idRequired: boolean;

	static endpointType: string;
}

declare interface authAPIType {
	static getProfile: any;

	static updateProfile: any;

	static login: Function;

	static register: Function;

	static changePassword: Function;

	static logout: Function;
}

declare interface ordersConfigType {
	static requiredFields: (string | any)[];

	static idRequired: boolean;

	static customValidations: {
	static items: Function;

	static paymentMethod: Function;
	};

	static endpointType: string;
}

declare interface ordersAPIType {
	static getOrders: any;

	static getOrder: any;

	static createOrder: any;

	static updateOrder: any;

	static deleteOrder: any;

	static getAdminOrders: Function;

	static updateOrderStatus: Function;

	static cancelOrder: Function;

	static processOrder: Function;

	static deliverOrder: Function;

	static rejectOrder: Function;

	static confirmDelivery: Function;

	static getMyOrders: Function;

	static getOrderStats: {	};

	static getDashboardStats: Function;
}

declare interface analyticsAPIType {
	static getSalesOverview: Function;

	static getProductAnalytics: Function;

	static getInventoryAnalytics: Function;

	static getPerformanceMetrics: Function;

	static getDailyPerformance: Function;

	static getProductTracking: Function;

	static getPersonalSalesOverview: Function;

	static getPersonalProductAnalytics: Function;

	static getPersonalInventoryAnalytics: Function;

	static getPersonalPerformanceMetrics: Function;

	static getPersonalDailyPerformance: Function;

	static getPersonalProductTracking: Function;

	static getSystemSalesOverview: Function;

	static getSystemProductAnalytics: Function;

	static getSystemInventoryAnalytics: Function;

	static getSystemPerformanceMetrics: Function;

	static getSystemDailyPerformance: Function;

	static getSystemProductTracking: Function;

	static setAnalyticsView: Function;

	static getAnalyticsView: Function;

	static isAdminUser: Function;

	static getCurrentUser: Function;
}

declare interface notificationsAPIType {
	static getNotifications: Function;

	static getNotification: Function;

	static deleteNotification: Function;

	static getUnreadCount: Function;

	static markAsRead: Function;

	static markAllAsRead: Function;

	static clearAllNotifications: Function;

	static pollNotifications: {	};
}

declare interface dashboardAPIType {
	static getDashboardOverview: Function;

	static getQuickStats: Function;

	static getRecentActivity: Function;

	static getAdminDashboardOverview: Function;

	static getAdminQuickStats: Function;

	static getAdminRecentActivity: Function;
}

declare interface adminAPIType {
	static createAdmin: Function;

	static registerAdmin: Function;

	static getAdmins: Function;

	static getUsers: Function;

	static searchUsers: Function;

	static getUserById: Function;

	static getUserActivity: Function;

	static updateUserRole: Function;

	static toggleUserStatus: Function;

	static resetUserPassword: Function;

	static deleteUser: Function;

	static getDashboardStats: Function;

	static getMyDashboardStats: Function;
}
