import type { PpicProjectScanHistory } from "@/types/ppic";

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

export type ProjectStatusRow = {
	componentTaskId: string;
	status: string | null;
};

export type ProjectStatusChange = ProjectStatusRow & { updatedAt: number };

export type ProjectDashboardComponent = {
	id: string;
	serialNumber: string | null;
	name: string;
	status: string | null;
	history: PpicProjectScanHistory[];
};

export type ProjectDashboardItem = {
	id: string;
	name: string;
	components: ProjectDashboardComponent[];
};

export type ProjectDashboard = {
	project: SelectedProject & { startDate: string | null; dueDate: string | null };
	items: ProjectDashboardItem[];
	recentHistory: PpicProjectScanHistory[];
	memberContribution: { userId: string; name: string; scans: number }[];
	memberNames: Record<string, string>;
	statusUpdatedAt: number;
};
