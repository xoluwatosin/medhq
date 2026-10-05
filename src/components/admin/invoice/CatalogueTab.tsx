import { useState } from "react";
import { useCatalogue } from "@/hooks/useCatalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { Plus, Trash2, RotateCcw, Pencil, Check, X } from "lucide-react";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";

const HEAD = "text-[11px] font-bold uppercase tracking-[0.14em] text-label";

export function CatalogueTab() {
  const {
    categories,
    services,
    isLoading,
    seedDefaults,
    addCategory,
    updateCategory,
    deleteCategory,
    addService,
    updateService,
    deleteService,
  } = useCatalogue();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [newServiceData, setNewServiceData] = useState<Record<string, { name: string; price: string }>>({});

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    addCategory.mutate(newCategoryName.trim(), {
      onSuccess: () => {
        setNewCategoryName("");
        toast.success("Category added");
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleResetDefaults = () => {
    seedDefaults.mutate(undefined, {
      onSuccess: () => toast.success("Catalogue reset to defaults"),
      onError: (e) => toast.error(e.message),
    });
  };

  const startEditCategory = (id: string, name: string) => {
    setEditingCatId(id);
    setEditingCatName(name);
  };

  const saveEditCategory = () => {
    if (!editingCatId || !editingCatName.trim()) return;
    updateCategory.mutate(
      { id: editingCatId, name: editingCatName.trim() },
      {
        onSuccess: () => {
          setEditingCatId(null);
          toast.success("Category updated");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleAddService = (categoryId: string) => {
    const svcData = newServiceData[categoryId];
    if (!svcData?.name?.trim()) return;
    addService.mutate(
      { categoryId, name: svcData.name.trim(), price: parseFloat(svcData.price) || 0 },
      {
        onSuccess: () => {
          setNewServiceData((prev) => ({ ...prev, [categoryId]: { name: "", price: "" } }));
          toast.success("Service added");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading catalogue.</div>;
  }

  return (
    <div className="space-y-6 no-print">
      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
          />
          <Button onClick={handleAddCategory} disabled={addCategory.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Add category
          </Button>
        </div>
        <ConfirmAction
          title="Reset the catalogue to the defaults?"
          description={
            <>
              <p>Every category and service here is deleted, including any prices you have changed, and the default catalogue is loaded in their place.</p>
              <p>Invoices already sent are not changed. This cannot be undone.</p>
            </>
          }
          confirmLabel="Reset catalogue"
          destructive
          onConfirm={handleResetDefaults}
          trigger={
            <Button variant="outline" disabled={seedDefaults.isPending}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset to defaults
            </Button>
          }
        />
      </div>

      {/* Category cards */}
      {categories.map((cat) => {
        const catServices = services.filter((s) => s.category_id === cat.id);
        const svcInput = newServiceData[cat.id] ?? { name: "", price: "" };

        return (
          <section key={cat.id} className="border border-line bg-card">
            <div className="flex flex-row items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
              {editingCatId === cat.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingCatName}
                    onChange={(e) => setEditingCatName(e.target.value)}
                    className="h-8 w-60"
                    onKeyDown={(e) => e.key === "Enter" && saveEditCategory()}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveEditCategory}>
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingCatId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-navy">{cat.name}</h2>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Rename ${cat.name}`} onClick={() => startEditCategory(cat.id, cat.name)}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )}
              <ConfirmAction
                title={`Remove ${cat.name}?`}
                description={<p>The category and every service in it come off the catalogue. Invoices already sent are not changed.</p>}
                confirmLabel="Remove category"
                destructive
                onConfirm={() =>
                  deleteCategory.mutate(cat.id, {
                    onSuccess: () => toast.success("Category deleted"),
                    onError: (e) => toast.error(e.message),
                  })
                }
                trigger={
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                }
              />
            </div>
            <div className="px-5 py-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={HEAD}>Service name</TableHead>
                    <TableHead className={`w-32 ${HEAD}`}>Price (₦)</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catServices.map((svc) => (
                    <TableRow key={svc.id}>
                      <TableCell>
                        <Input
                          defaultValue={svc.name}
                          onBlur={(e) => {
                            if (e.target.value !== svc.name)
                              updateService.mutate({ id: svc.id, name: e.target.value });
                          }}
                          className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          defaultValue={svc.price}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val !== svc.price)
                              updateService.mutate({ id: svc.id, price: val });
                          }}
                          className="border-0 bg-transparent p-0 h-auto w-28 font-mono focus-visible:ring-0"
                        />
                      </TableCell>
                      <TableCell>
                        <ConfirmAction
                          title={`Remove ${svc.name}?`}
                          description={<p>It comes off the catalogue. Invoices already sent are not changed.</p>}
                          confirmLabel="Remove service"
                          destructive
                          onConfirm={() =>
                            deleteService.mutate(svc.id, {
                              onSuccess: () => toast.success("Service deleted"),
                              onError: (e) => toast.error(e.message),
                            })
                          }
                          trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Add new service row */}
                  <TableRow>
                    <TableCell>
                      <Input
                        placeholder="New service name"
                        value={svcInput.name}
                        onChange={(e) =>
                          setNewServiceData((prev) => ({
                            ...prev,
                            [cat.id]: { ...svcInput, name: e.target.value },
                          }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddService(cat.id)}
                        className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="0"
                        value={svcInput.price}
                        onChange={(e) =>
                          setNewServiceData((prev) => ({
                            ...prev,
                            [cat.id]: { ...svcInput, price: e.target.value },
                          }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddService(cat.id)}
                        className="border-0 bg-transparent p-0 h-auto w-28 font-mono focus-visible:ring-0"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleAddService(cat.id)}
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}

      {categories.length === 0 && (
        <div className="border border-line bg-card">
          <MuEmpty
            art={art.objPriceTagNaira}
            title="No service categories yet"
            description="Add a category above, or load the default catalogue to start."
            action={
              <Button onClick={handleResetDefaults} disabled={seedDefaults.isPending}>
                <RotateCcw className="h-4 w-4 mr-1" /> Load default catalogue
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
