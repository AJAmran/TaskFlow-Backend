import type {
	TPaginationMeta,
	TPaginationOptions,
} from "../interfaces/pagination";

const MAX_PAGE = 10_000;

export const calculatePagination = (options: TPaginationOptions) => {
	const rawPage = Number(options.page);
	const rawLimit = Number(options.limit);
	const page =
		Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, MAX_PAGE) : 1;
	const limit =
		Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;
	const skip = (page - 1) * limit;
	const sortBy = options.sortBy || "createdAt";
	const sortOrder = options.sortOrder === "asc" ? "asc" : "desc";

	return { page, limit, skip, sortBy, sortOrder };
};

export const buildPaginationMeta = (
	total: number,
	page: number,
	limit: number,
): TPaginationMeta => ({
	page,
	limit,
	total,
	totalPages: Math.ceil(total / limit),
});
