export interface SupplierProps {
  name: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  website?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
