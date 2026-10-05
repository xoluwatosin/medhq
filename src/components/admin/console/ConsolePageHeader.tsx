import { ReactNode } from "react";
import AdminBand from "@/components/admin/mu/AdminBand";

interface ConsolePageHeaderProps {
  title: string;
  description?: string;
  id?: string;
  /** Optional single control that belongs to the page, such as Add client. */
  action?: ReactNode;
}

/** The console screens open with the same navy band as every admin page. */
const ConsolePageHeader = ({ title, description, id, action }: ConsolePageHeaderProps) => (
  <div className="mb-6">
    <AdminBand id={id} title={title} description={description} actions={action} />
  </div>
);

export default ConsolePageHeader;
