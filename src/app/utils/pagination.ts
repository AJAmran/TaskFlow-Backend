import type { TPaginationMeta, TPaginationOptions } from "../interfaces/pagination";

export const calculatePagination = (options: TPaginationOptions) => {
	const page = Number(options.page) || 1;
	const limit = Number(options.limit) || 10;
	const skip = (page - 1) * limit;
	const sortBy = options.sortBy || "createdAt";
	const sortOrder = options.sortOrder || "desc";

	return { page, limit, skip, sortBy, sortOrder };
};

export const buildPaginationMeta = (total: number, page: number, limit: number): TPaginationMeta => ({
	page,
	limit,
	total,
	totalPages: Math.ceil(total / limit),
});
