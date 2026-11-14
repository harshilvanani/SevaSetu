import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { localizedName, type Translatable } from '@/domain/templates';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase, type Enums, type Tables } from '@/lib/supabase';

export { localizedName, suggestedSeva } from '@/domain/templates';
export type TemplateTask = Tables<'event_template_tasks'>;
export type Template = Tables<'event_templates'> & { event_template_tasks: TemplateTask[] };
export function useLocalized() {
  const { i18n } = useTranslation();
  return (row: Translatable) => localizedName(row, i18n.language);
}

export function useTemplates() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['templates', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<Template[]> => {
      const { data, error } = await supabase.from('event_templates').select('*, event_template_tasks(*)').order('sort').order('name');
      if (error) throw error;
      return ((data ?? []) as Template[]).map((tpl) => ({
        ...tpl,
        event_template_tasks: [...tpl.event_template_tasks].sort((a, b) => a.sort - b.sort),
      }));
    },
  });
}

type TemplateInput = {
  id?: string;
  orgId: string | null;
  name: string;
  name_i18n?: Record<string, string>;
  visibility: Enums<'visibility'>;
  tasks: { name: string; name_i18n?: Record<string, string> }[];
};

/** Create or replace a template and its seva names (used by the admin editor and "Save as template"). */
export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: TemplateInput) => {
      let id = v.id;
      const row = { name: v.name.trim(), name_i18n: v.name_i18n ?? {}, visibility: v.visibility };
      if (id) {
        const { error } = await supabase.from('event_templates').update(row).eq('id', id);
        if (error) throw error;
        const { error: dErr } = await supabase.from('event_template_tasks').delete().eq('template_id', id);
        if (dErr) throw dErr;
      } else {
        const { data, error } = await supabase.from('event_templates').insert({ ...row, org_id: v.orgId }).select('id').single();
        if (error) throw error;
        id = data.id;
      }
      const rows = v.tasks.filter((x) => x.name.trim()).map((x, i) => ({ template_id: id!, name: x.name, name_i18n: x.name_i18n ?? {}, sort: i }));
      if (rows.length) {
        const { error } = await supabase.from('event_template_tasks').insert(rows);
        if (error) throw error;
      }
      return id!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}
