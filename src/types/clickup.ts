export type ClickUpCustomField = { id: string; value?: unknown };

export type ClickUpTask = {
	id: string;
	custom_fields?: ClickUpCustomField[];
	list?: { id: string };
};

export type ClickUpDropdownOption = {
	id: string;
	name: string;
	orderindex?: number | string;
};

export type ClickUpField = {
	id: string;
	name: string;
	type_config?: { options?: ClickUpDropdownOption[] };
};
