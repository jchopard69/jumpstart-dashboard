/** Read a stable, explicitly ordered query without silently accepting a server row cap. */
export async function readAllRows<T>(
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  let expected: number | undefined;
  while (true) {
    const result = await readPage(rows.length, rows.length + pageSize - 1);
    if (result.error) throw new Error(`Impossible de charger ${label}.`);
    if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error(`Le nombre de lignes de ${label} n'a pas pu être vérifié.`);
    }
    if (expected !== undefined && result.count !== expected) {
      throw new Error(`Les données de ${label} ont changé pendant la lecture. Réessayez.`);
    }
    expected = result.count;
    const page = result.data ?? [];
    rows.push(...page);
    if (rows.length === expected) return rows;
    if (!page.length || rows.length > expected) {
      throw new Error(`Lecture incomplète de ${label}. Réessayez.`);
    }
  }
}
