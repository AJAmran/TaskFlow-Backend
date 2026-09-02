export type TPaginationOptions = {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
};

export type TPaginationMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};
