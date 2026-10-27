import { ProjectDetailPage } from "@/features/admin/ProjectDetailPage";
import { CompletedProjectDetailPage } from "@/features/admin/CompletedProjectDetailPage";
import { getCompletedProjectDashboard, getProjectDashboard } from "@/lib/projectDashboard";
import { isPpicSuperAdmin } from "@/lib/db";
import {
	clickUpToken,
	ppicSession,
	requireSelectedAdminProject,
} from "@/lib/session";
import type { SelectedProject } from "@/types/project";
import { redirect } from "next/navigation";

export const maxDuration = 60;

export default async function ProjectDetail({
	searchParams,
}: {
	searchParams: Promise<{ task_id?: string; review?: string }>;
}) {
	const params = await searchParams;
	const taskId = params.task_id?.trim();
	const [project, token] = await Promise.all([
		taskId
			? Promise.resolve<SelectedProject>({ task_id: taskId, name: null, custom_id: null })
			: requireSelectedAdminProject(),
		clickUpToken(),
	]);
	if (!token) redirect("/login");
	const userId = (await ppicSession())?.user_id;
	if (!userId) redirect("/login");
	if (!(await isPpicSuperAdmin(userId))) redirect("/unauthorized");
	try {
		const dashboard = await (params.review === "completed"
			? getCompletedProjectDashboard(token, project)
			: getProjectDashboard(token, project));
		return dashboard.completion && dashboard.project.status?.toLowerCase() === "complete"
			? <CompletedProjectDetailPage dashboard={dashboard} />
			: <ProjectDetailPage dashboard={dashboard} />;
	} catch {
		return <ProjectDetailPage error="Dashboard project tidak dapat dimuat. Coba lagi." />;
	}
}
