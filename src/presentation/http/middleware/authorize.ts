import { Request, Response, NextFunction } from 'express';
import {
  Permission,
  ROLE_PERMISSIONS
} from 'domain/identity/permissions/Permission';

export function authorize(...required: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, error: 'Authentication required' });
      return;
    }

    const granted = ROLE_PERMISSIONS[req.user.role] ?? [];
    const hasAll = required.every((p) => granted.includes(p));

    if (!hasAll) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    next();
  };
}
