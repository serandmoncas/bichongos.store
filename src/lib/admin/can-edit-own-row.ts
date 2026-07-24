export function canEditRow(currentUserId: string, rowUserId: string): boolean {
  return currentUserId !== rowUserId;
}
