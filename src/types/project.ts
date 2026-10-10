export type SelectedProject = {
	task_id: string;
	name: string | null;
	custom_id: string | null;
};

export type ProjectSerialCacheEntry = {
	task_id: string;
	name: string | null;
	status_id: string | null;
};

export type ProjectSerialCache = {
	complete: boolean;
	entries: Record<string, ProjectSerialCacheEntry>;
	expires_at: number;
};
