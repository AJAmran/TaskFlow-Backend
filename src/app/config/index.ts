import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const config = {
	node_env: (process.env.NODE_ENV as string) || "development",
	port: Number(process.env.PORT) || 5000,
	database_url: process.env.DATABASE_URL as string,
	backend_url: process.env.BACKEND_URL as string,
	frontend_url: process.env.FRONTEND_URL as string,
	bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
	jwt_access_secret: process.env.JWT_ACCESS_SECRET as string,
	jwt_refresh_secret: process.env.JWT_REFRESH_SECRET as string,
	jwt_access_expires_in: (process.env.JWT_ACCESS_EXPIRES_IN as string) || "15m",
	jwt_refresh_expires_in: (process.env.JWT_REFRESH_EXPIRES_IN as string) || "7d",
	google_client_id: process.env.GOOGLE_CLIENT_ID as string,
	google_client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
	super_admin_name: process.env.SUPER_ADMIN_NAME as string,
	super_admin_email: process.env.SUPER_ADMIN_EMAIL as string,
	super_admin_password: process.env.SUPER_ADMIN_PASSWORD as string,
	redis_user: process.env.REDIS_USER as string,
	redis_password: process.env.REDIS_PASSWORD as string,
	redis_host: process.env.REDIS_HOST as string,
	redis_port: Number(process.env.REDIS_PORT) || 6379,
	smtp_user: process.env.SMTP_USER as string,
	smtp_password: process.env.SMTP_PASSWORD as string,
	email_sender: process.env.EMAIL_SENDER as string,
	cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
	cloudinary_api_key: process.env.CLOUDINARY_API_KEY as string,
	cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET as string,
	bkash_base_url: process.env.BKASH_BASE_URL as string,
	bkash_username: process.env.BKASH_USERNAME as string,
	bkash_password: process.env.BKASH_PASSWORD as string,
	bkash_app_key: process.env.BKASH_APP_KEY as string,
	bkash_app_secret: process.env.BKASH_APP_SECRET as string,
	bkash_callback_url: process.env.BKASH_CALLBACK_URL as string,
} as const;

export default config;
