import type { ClickUpField } from "@/types/clickup";

export type { ClickUpField } from "@/types/clickup";

const fieldCache = new Map<string, { expires: number; fields: ClickUpField[] }>();

export async function fieldsByName(token: string, listId: string, names: readonly string[]) {
  const cached = fieldCache.get(listId);
  let fields = cached && cached.expires > Date.now() ? cached.fields : undefined;
  if (!fields) {
    let response: Response;
    try {
      response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, {
        headers: { Authorization: token },
        cache: "no-store",
      });
    } catch (error) {
      console.error("ClickUp field lookup failed", { listId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
    if (!response.ok) {
      console.error("ClickUp field lookup failed", { listId, status: response.status });
      return null;
    }
    ({ fields = [] } = (await response.json()) as { fields?: ClickUpField[] });
    // ponytail: cache is per server process; use shared cache if field changes must be immediate across instances.
    fieldCache.set(listId, { fields, expires: Date.now() + 5 * 60_000 });
  }
  return Object.fromEntries(names.map((name) => [name, fields.find((field) => field.name === name)]));
}

export const clearFieldsCache = (listId: string) => fieldCache.delete(listId);

export const optionId = (field: ClickUpField, value: unknown) =>
  field.type_config?.options?.find((option) =>
    option.id === value || (option.orderindex !== undefined && String(option.orderindex) === String(value)),
  )?.id ?? null;

export const optionName = (field: ClickUpField, value: unknown) =>
  field.type_config?.options?.find((option) => option.id === optionId(field, value))?.name ?? null;

export const hasTaskRelation = (value: unknown, taskId: string) =>
  Array.isArray(value) && value.some((item) =>
    typeof item === "object" && item !== null && "id" in item && item.id === taskId,
  );
