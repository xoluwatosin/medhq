import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { exportToCSV, exportToExcel } from "@/lib/admin-utils";

interface ExportDropdownProps {
  data: Record<string, any>[];
  filename: string;
}

/**
 * The same two export choices as items, for pages that keep secondary
 * actions in a "More" menu instead of showing an Export button.
 */
export const ExportMenuItems = ({ data, filename }: ExportDropdownProps) => (
  <>
    <DropdownMenuItem onClick={() => exportToCSV(data, filename)}>
      Export CSV
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => exportToExcel(data, filename)}>
      Export Excel
    </DropdownMenuItem>
  </>
);

const ExportDropdown = ({ data, filename }: ExportDropdownProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <ExportMenuItems data={data} filename={filename} />
    </DropdownMenuContent>
  </DropdownMenu>
);

export default ExportDropdown;
