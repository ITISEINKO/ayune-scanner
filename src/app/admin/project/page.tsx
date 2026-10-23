import { ProjectDetailPage } from "@/features/admin/ProjectDetailPage";
import { getProjectDashboard } from "@/lib/projectDashboard";
import {
	clickUpToken,
	requireSelectedAdminProject,
} from "@/lib/session";
import type { SelectedProject } from "@/types/project";
import { redirect } from "next/navigation";

export const maxDuration = 60;

export default async function ProjectDetail({
	searchParams,
}: {
	searchParams: Promise<{ task_id?: string }>;
}) {
	const taskId = (await searchParams).task_id?.trim();
	const [project, token] = await Promise.all([
		taskId
			? Promise.resolve<SelectedProject>({ task_id: taskId, name: null, custom_id: null })
			: requireSelectedAdminProject(),
		clickUpToken(),
	]);
	if (!token) redirect("/login");
	try {
		return <ProjectDetailPage dashboard={await getProjectDashboard(token, project)} />;
	} catch {
		return <ProjectDetailPage error="Dashboard project tidak dapat dimuat. Coba lagi." />;
	}
}
