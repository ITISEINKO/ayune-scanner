export type ClickUpField = {
  id: string;
  name: string;
  type_config?: { options?: { id: string; name: string }[] };
};

const fieldCache = new Map<string, { expires: number; fields: ClickUpField[] }>();

export async function fieldsByName(token: string, listId: string, names: readonly string[]) {
  const cached = fieldCache.get(listId);
  let fields = cached && cached.expires > Date.now() ? cached.fields : undefined;
  if (!fields) {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!response.ok) return null;
    ({ fields = [] } = (await response.json()) as { fields?: ClickUpField[] });
    // ponytail: cache is per server process; use shared cache if field changes must be immediate across instances.
    fieldCache.set(listId, { fields, expires: Date.now() + 5 * 60_000 });
  }
  return Object.fromEntries(names.map((name) => [name, fields.find((field) => field.name === name)]));
}

export const clearFieldsCache = (listId: string) => fieldCache.delete(listId);
