export interface DeleteDeviceRequestDTO {
  id: string;

  // The authenticated user id, so a tombstone records who made it. Null when
  // the caller is not a user (nothing does this today, but the field must not
  // pretend to know).
  deletedBy?: string | null;
}
