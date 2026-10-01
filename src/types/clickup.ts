export type ClickUpCustomField = {
	id: string;
	value?: unknown;
	type_config?: { options?: ClickUpDropdownOption[] };
};

export type ClickUpTask = {
	id: string;
	url?: string;
	name?: string;
	status?: { status?: string };
	date_created?: string;
	date_closed?: string | null;
	custom_fields?: ClickUpCustomField[];
	list?: { id: string };
};

export type ClickUpDropdownOption = {
	id: string;
	name: string;
	label?: string;
	orderindex?: number | string;
};

export type ClickUpField = {
	id: string;
	name: string;
	type_config?: { options?: ClickUpDropdownOption[] };
};
