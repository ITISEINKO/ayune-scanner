import { TestingPage } from "@/components/testingPage";
import { requireClickUpToken } from "@/lib/session";

const Testing = async () => {
	await requireClickUpToken();
	return <TestingPage />;
};

export default Testing;
