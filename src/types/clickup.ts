export type ClickUpCustomField = {
	id: string;
	value?: unknown;
	type_config?: { options?: ClickUpDropdownOption[] };
};

export type ClickUpTask = {
	id: string;
	parent?: string | null;
	top_level_parent?: string | null;
	custom_id?: string;
	url?: string;
	name?: string;
	status?: { status?: string };
	start_date?: string | null;
	due_date?: string | null;
	date_created?: string;
	date_closed?: string | null;
	date_done?: string | null;
	subtasks?: ClickUpTask[];
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

export type PanelMember = { id: string; name: string };
