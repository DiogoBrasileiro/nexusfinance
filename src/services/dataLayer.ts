import { getSupabase, useSupabaseStore } from '../store/useSupabaseStore';

export const saveSetting = async (key: string, value: any) => {
  const supabase = getSupabase();
  if (!supabase || !useSupabaseStore.getState().isConnected) return false;

  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to save setting to Supabase', error);
    return false;
  }
};

export const loadSetting = async (key: string) => {
  const supabase = getSupabase();
  if (!supabase || !useSupabaseStore.getState().isConnected) return null;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error) throw error;
    return data?.value;
  } catch (error) {
    console.error('Failed to load setting from Supabase', error);
    return null;
  }
};

export const saveTradePlan = async (plan: any) => {
  const supabase = getSupabase();
  if (!supabase || !useSupabaseStore.getState().isConnected) return false;

  try {
    const { error } = await supabase
      .from('trade_plans')
      .insert({
        asset: plan.asset,
        params: plan.params,
        status: plan.status,
        linked_orders: plan.linked_orders
      });
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to save trade plan to Supabase', error);
    return false;
  }
};

export const saveAnalysisRun = async (run: any) => {
  const supabase = getSupabase();
  if (!supabase || !useSupabaseStore.getState().isConnected) return false;

  try {
    const { error } = await supabase
      .from('analysis_runs')
      .insert({
        asset: run.asset,
        snapshot: run.snapshot,
        agent_outputs: run.agent_outputs,
        strategist_output: run.strategist_output,
        fact_checker: run.fact_checker,
        data_freshness: run.data_freshness
      });
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to save analysis run to Supabase', error);
    return false;
  }
};

export const appendAuditLog = async (action: string, status: string, meta: any) => {
  const supabase = getSupabase();
  if (!supabase || !useSupabaseStore.getState().isConnected) return false;

  try {
    const { error } = await supabase
      .from('logs_audit')
      .insert({
        action,
        status,
        meta
      });
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to save audit log to Supabase', error);
    return false;
  }
};
