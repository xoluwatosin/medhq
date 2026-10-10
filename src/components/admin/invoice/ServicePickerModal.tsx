import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalogue } from "@/hooks/useCatalogue";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (description: string, price: number) => void;
}

export function ServicePickerModal({ open, onClose, onSelect }: Props) {
  const { categories, services } = useCatalogue();

  const handleSelect = (name: string, price: number) => {
    onSelect(name, price);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Pick from the catalogue</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          {categories.map((cat) => {
            const catServices = services.filter((s) => s.category_id === cat.id);
            return (
              <div key={cat.id} className="mb-6">
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-label">
                  {cat.name}
                </h4>
                <div className="space-y-1">
                  {catServices.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => handleSelect(svc.name, svc.price)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <span>{svc.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono">
                          ₦{svc.price.toLocaleString()}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-primary" />
                      </div>
                    </button>
                  ))}
                  {catServices.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">No services in this category yet.</p>
                  )}
                </div>
              </div>
            );
          })}
          {categories.length === 0 && (
            <MuEmpty
              art={art.objPriceTagNaira}
              title="No catalogue items"
              description="Add services on the Catalogue tab, then pick them here."
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
