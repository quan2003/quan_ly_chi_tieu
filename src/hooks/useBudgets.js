import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useBudgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .order('category');
    if (!error && data) setBudgets(data);
    setLoading(false);
  };

  const saveBudget = async (category, amount, oldCategory = null) => {
    if (oldCategory && oldCategory !== category) {
      // Đổi tên → xóa cũ, tạo mới
      await supabase.from('budgets').delete().eq('category', oldCategory);
    }
    const { error } = await supabase
      .from('budgets')
      .upsert([{ category, amount }], { onConflict: 'category' });
    if (!error) await fetchAll();
    return !error;
  };

  const deleteBudget = async (category) => {
    const { error } = await supabase.from('budgets').delete().eq('category', category);
    if (!error) await fetchAll();
    return !error;
  };

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('budgets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, fetchAll)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return { budgets, loading, saveBudget, deleteBudget };
}
