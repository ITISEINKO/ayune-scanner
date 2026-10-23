import { MemberProfilePage } from "@/features/profile/MemberProfilePage";
import { redirect } from "next/navigation";
import { ppicSession } from "@/lib/session";

const Profile = async () => {
	if ((await ppicSession())?.role === "SUPER_ADMIN") redirect("/admin/profile");
	return <MemberProfilePage />;
};

export default Profile;
