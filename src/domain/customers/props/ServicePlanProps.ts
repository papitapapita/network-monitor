export interface ServicePlanProps {
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPrice: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
