import { v2 as cloudinary } from "cloudinary";
import config from "../config";
import { AppError } from "../utils/AppError";
import httpStatus from "http-status";


cloudinary.config({
	cloud_name: config.cloudinary_cloud_name,
	api_key: config.cloudinary_api_key,
	api_secret: config.cloudinary_api_secret,
});

export { cloudinary };

export const uploadBufferToCloudinary = (
	buffer: Buffer,
	folder = "taskflow",
): Promise<{ secure_url: string; public_id: string }> => {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "auto" }, (error, result) => {
			if (error || !result) {
				return reject(new AppError(httpStatus.INTERNAL_SERVER_ERROR, error?.message || "Cloudinary upload failed"));
			}
			resolve({ secure_url: result.secure_url, public_id: result.public_id });
		});
		stream.end(buffer);
	});
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
	try {
		await cloudinary.uploader.destroy(publicId);
	} catch {
		// silent — not critical for main flow
	}
};
