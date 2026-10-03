import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_CATALOGUE } from "@/lib/default-catalogue";

const CATEGORY_TABLE = "invoice_service_categories";
const SERVICE_TABLE = "invoice_services";

export interface ServiceCategory {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  category_id: string;
  created_at: string;
}

export function useCatalogue() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: [CATEGORY_TABLE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CATEGORY_TABLE as any)
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as ServiceCategory[];
    },
    enabled: !!user,
  });

  const servicesQuery = useQuery({
    queryKey: [SERVICE_TABLE],
    queryFn: async () => {
      const { data, error } = await supabase.from(SERVICE_TABLE as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Service[];
    },
    enabled: !!user,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: [CATEGORY_TABLE] });
    qc.invalidateQueries({ queryKey: [SERVICE_TABLE] });
  };

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      await supabase.from(SERVICE_TABLE as any).delete().not("id", "is", null);
      await supabase.from(CATEGORY_TABLE as any).delete().not("id", "is", null);

      for (let i = 0; i < DEFAULT_CATALOGUE.length; i++) {
        const cat = DEFAULT_CATALOGUE[i];
        const { data: catData, error: catError } = await supabase
          .from(CATEGORY_TABLE as any)
          .insert({ name: cat.name, display_order: i })
          .select()
          .single();
        if (catError) throw catError;

        if (cat.services.length > 0) {
          const { error: svcError } = await supabase.from(SERVICE_TABLE as any).insert(
            cat.services.map((s) => ({
              name: s.name,
              price: s.price,
              category_id: (catData as any).id,
            }))
          );
          if (svcError) throw svcError;
        }
      }
    },
    onSuccess: invalidateAll,
  });

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const order = categoriesQuery.data?.length ?? 0;
      const { error } = await supabase
        .from(CATEGORY_TABLE as any)
        .insert({ name, display_order: order });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CATEGORY_TABLE] }),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from(CATEGORY_TABLE as any).update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CATEGORY_TABLE] }),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(CATEGORY_TABLE as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const addService = useMutation({
    mutationFn: async ({ categoryId, name, price }: { categoryId: string; name: string; price: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from(SERVICE_TABLE as any)
        .insert({ name, price, category_id: categoryId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SERVICE_TABLE] }),
  });

  const updateService = useMutation({
    mutationFn: async ({ id, name, price }: { id: string; name?: string; price?: number }) => {
      const update: Record<string, unknown> = {};
      if (name !== undefined) update.name = name;
      if (price !== undefined) update.price = price;
      const { error } = await supabase.from(SERVICE_TABLE as any).update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SERVICE_TABLE] }),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(SERVICE_TABLE as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SERVICE_TABLE] }),
  });

  return {
    categories: categoriesQuery.data ?? [],
    services: servicesQuery.data ?? [],
    isLoading: categoriesQuery.isLoading || servicesQuery.isLoading,
    seedDefaults,
    addCategory,
    updateCategory,
    deleteCategory,
    addService,
    updateService,
    deleteService,
  };
}
