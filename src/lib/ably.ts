import * as Ably from "ably";

export const getAbly = () => {
	const key = process.env.ABLY_API_KEY;
	if (!key) throw new Error("ABLY_API_KEY is missing");
	return new Ably.Rest({ key });
};
