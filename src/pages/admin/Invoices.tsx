import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceList } from "@/components/admin/invoice/InvoiceList";
import { InvoiceBuilder } from "@/components/admin/invoice/InvoiceBuilder";
import { CatalogueTab } from "@/components/admin/invoice/CatalogueTab";
import { MuPageHeader } from "@/components/admin/mu/MuShell";
import { BookOpen, FileText, Plus } from "lucide-react";

const Invoices = () => {
  // The catalogue is seeded from the Catalogue tab on request ("Reset to
  // defaults"), never by opening this screen.
  const [tab, setTab] = useState("invoices");

  return (
    <div className="space-y-6">
      <MuPageHeader title="Invoices" description="Raise invoices, send payment links and keep the service catalogue current." />

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
