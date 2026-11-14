import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Linking, Platform } from 'react-native';

import { supabase, type Tables } from '@/lib/supabase';

export type Campaign = Tables<'donation_campaigns'>;
export type CampaignWithOrg = Campaign & { organizations: { id: string; name: string } };
export type Donation = Tables<'donations'>;

/** Error code from an Edge Function reply such as { error: 'not_accepting' }. */
async function functionError(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError) {
    try {
      const body = (await e.context.json()) as { error?: string };
      return body.error ?? 'generic';
    } catch {
      return 'generic';
    }
  }
  return 'generic';
}

function openUrl(url: string) {
  if (Platform.OS === 'web') window.location.assign(url);
  else Linking.openURL(url);
}

export function useOrgPayments(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-payments', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('org_payments').select('*').eq('org_id', orgId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** 'link' opens Stripe's onboarding; 'status' refreshes whether the account can take payments. */
export function useStripeConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { orgId: string; action: 'link' | 'status' }) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect', { body: { org_id: v.orgId, action: v.action } });
      if (error) throw new Error(await functionError(error));
      if (v.action === 'link' && data?.url) openUrl(data.url as string);
      return data as { url?: string; connected?: boolean; charges_enabled?: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-payments'] }),
  });
}

export function useOrgCampaigns(orgId: string | undefined) {
  return useQuery({
    queryKey: ['campaigns', 'org', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Campaign[]> => {
      const { data, error } = await supabase.from('donation_campaigns').select('*').eq('org_id', orgId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActiveCampaigns() {
  return useQuery({
    queryKey: ['campaigns', 'active'],
    queryFn: async (): Promise<CampaignWithOrg[]> => {
      const { data, error } = await supabase
        .from('donation_campaigns')
        .select('*, organizations!inner(id, name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CampaignWithOrg[];
    },
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['campaigns', 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<CampaignWithOrg | null> => {
      const { data, error } = await supabase.from('donation_campaigns').select('*, organizations!inner(id, name)').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as CampaignWithOrg | null;
    },
  });
}

export function useAcceptsDonations(orgId: string | undefined) {
  return useQuery({
    queryKey: ['accepts-donations', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('org_accepts_donations', { p_org: orgId! });
      if (error) throw error;
      return !!data;
    },
  });
}

export type CampaignInput = Pick<Campaign, 'title' | 'description' | 'image_url' | 'goal_cents' | 'presets' | 'allow_monthly' | 'allow_cover_fees' | 'status'>;

export function useSaveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; orgId: string; input: CampaignInput }) => {
      if (v.id) {
        const { error } = await supabase.from('donation_campaigns').update(v.input).eq('id', v.id);
        if (error) throw error;
        return v.id;
      }
      const { data, error } = await supabase.from('donation_campaigns').insert({ ...v.input, org_id: v.orgId }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('donation_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useCampaignDonations(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['donations', campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<Donation[]> => {
      const { data, error } = await supabase.from('donations').select('*').eq('campaign_id', campaignId!).neq('status', 'pending').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Creates the Stripe Checkout and sends the donor there. Throws an error code (e.g. not_accepting). */
export function useStartCheckout() {
  return useMutation({
    mutationFn: async (v: { campaignId: string; amountCents: number; monthly: boolean; coverFees: boolean; name: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke('donate-checkout', {
        body: { campaign_id: v.campaignId, amount_cents: v.amountCents, monthly: v.monthly, cover_fees: v.coverFees, name: v.name, email: v.email },
      });
      if (error) throw new Error(await functionError(error));
      if (data?.url) openUrl(data.url as string);
    },
  });
}
