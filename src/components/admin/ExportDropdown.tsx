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

const ExportDropdown = ({ data, filename }: ExportDropdownProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => exportToCSV(data, filename)}>
        Export CSV
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => exportToExcel(data, filename)}>
        Export Excel
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export default ExportDropdown;
