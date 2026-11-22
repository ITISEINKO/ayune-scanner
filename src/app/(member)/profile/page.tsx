import { hasPpicAdminAccess } from "@/types/ppic";
import { MemberProfilePage } from "@/features/profile/MemberProfilePage";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { getProfile } from "@/features/profile/getProfile";

const Profile = async () => {
	if (hasPpicAdminAccess((await getAppSession())?.role)) redirect("/admin/profile");
	return <MemberProfilePage profile={await getProfile()} />;
};

export default Profile;
