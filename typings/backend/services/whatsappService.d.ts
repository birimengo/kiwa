
declare interface testOrderType {
	delay(ms: any): Promise<Function>;

	sendBulkNotifications(configs: any, order: any, notificationType: any, note: any): Promise<any>;

	verifyApiKey(phoneNumber: any, apiKey: any): Promise<null>;

	createNotificationHash(orderId: any, notificationType: any): null;
}
