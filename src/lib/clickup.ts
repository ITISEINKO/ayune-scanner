type ClickUpField = {
  id: string;
  name: string;
  type_config?: { options?: { id: string; name: string }[] };
};

export async function fieldsByName(token: string, listId: string, names: readonly string[]) {
  const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const { fields = [] } = (await response.json()) as { fields?: ClickUpField[] };
  return Object.fromEntries(names.map((name) => [name, fields.find((field) => field.name === name)]));
}
