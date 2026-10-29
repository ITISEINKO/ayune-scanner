import { hasPpicAdminAccess } from "@/types/ppic";
import { MemberProfilePage } from "@/features/profile/MemberProfilePage";
import { redirect } from "next/navigation";
import { ppicSession } from "@/lib/session";

const Profile = async () => {
	if (hasPpicAdminAccess((await ppicSession())?.role)) redirect("/admin/profile");
	return <MemberProfilePage />;
};

export default Profile;
