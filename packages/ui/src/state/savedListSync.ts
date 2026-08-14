export type SavedListAction =
  | { revision: number; type: "toggle"; id: string }
  | { revision: number; type: "clear" };

export type SavedListEntity = {
  id: string;
  databaseId?: number | null;
};

/** Use WordPress database IDs for backend-synced collections while preserving local
 * mock IDs for guest-only content that has no backend record. */
export function savedListEntityId(entity: SavedListEntity): string {
  return Number.isInteger(entity.databaseId) && Number(entity.databaseId) > 0
    ? String(entity.databaseId)
    : entity.id;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Applies unacknowledged operations to an authoritative saved-list snapshot. */
export function applySavedListActions(authoritativeIds: string[], actions: SavedListAction[]): string[] {
  return actions.reduce<string[]>((ids, action) => {
    if (action.type === "clear") return [];
    return ids.includes(action.id) ? ids.filter((id) => id !== action.id) : [...ids, action.id];
  }, uniqueIds(authoritativeIds));
}

/**
 * Keeps an authoritative snapshot separate from optimistic operations. Settling an
 * older request updates the base only; newer operations are reapplied, so an old
 * response cannot overwrite a later click.
 */
export class SavedListSyncState {
  private authoritativeIds: string[] = [];
  private actions: SavedListAction[] = [];
  private nextRevision = 0;

  reset(ids: string[]): void {
    this.authoritativeIds = uniqueIds(ids);
    this.actions = [];
    this.nextRevision = 0;
  }

  replaceAuthoritative(ids: string[]): void {
    this.authoritativeIds = uniqueIds(ids);
  }

  toggle(id: string): number {
    const revision = ++this.nextRevision;
    this.actions.push({ revision, type: "toggle", id });
    return revision;
  }

  clear(): number {
    const revision = ++this.nextRevision;
    this.actions.push({ revision, type: "clear" });
    return revision;
  }

  resolve(revision: number, ids: string[]): void {
    this.authoritativeIds = uniqueIds(ids);
    this.actions = this.actions.filter((action) => action.revision !== revision);
  }

  reject(revision: number): void {
    this.actions = this.actions.filter((action) => action.revision !== revision);
  }

  get ids(): string[] {
    return applySavedListActions(this.authoritativeIds, this.actions);
  }
}
