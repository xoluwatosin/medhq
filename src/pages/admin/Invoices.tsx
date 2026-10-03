import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalogue } from "@/hooks/useCatalogue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceList } from "@/components/admin/invoice/InvoiceList";
import { InvoiceBuilder } from "@/components/admin/invoice/InvoiceBuilder";
import { CatalogueTab } from "@/components/admin/invoice/CatalogueTab";
import { BookOpen, FileText, Plus } from "lucide-react";

const Invoices = () => {
  const { user } = useAuth();
  const { categories, isLoading, seedDefaults } = useCatalogue();
  const [tab, setTab] = useState("invoices");

  useEffect(() => {
    if (!isLoading && categories.length === 0 && user) {
      seedDefaults.mutate();
    }
  }, [isLoading, categories.length, user]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Invoices</h1>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-1.5">
            <FileText className="h-4 w-4" /> Invoices
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5">
            <Plus className="h-4 w-4" /> New invoice
          </TabsTrigger>
          <TabsTrigger value="catalogue" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Catalogue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <InvoiceList />
        </TabsContent>

        <TabsContent value="new">
          <InvoiceBuilder onCreated={() => setTab("invoices")} />
        </TabsContent>

        <TabsContent value="catalogue">
          <CatalogueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Invoices;
