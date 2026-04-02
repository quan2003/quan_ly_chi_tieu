import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setTransactions(data);
    setLoading(false);
  };

  const addTransaction = async (tx) => {
    const { error } = await supabase.from('transactions').insert([tx]);
    if (!error) await fetchAll();
    return !error;
  };

  const updateCategory = async (id, category) => {
    const { error } = await supabase
      .from('transactions')
      .update({ category })
      .eq('id', id);
    if (!error) await fetchAll();
    return !error;
  };

  const updateContent = async (id, content) => {
    const { error } = await supabase
      .from('transactions')
      .update({ content })
      .eq('id', id);
    if (!error) await fetchAll();
    return !error;
  };

  useEffect(() => {
    fetchAll();

    // Realtime: tự cập nhật khi có giao dịch mới từ emailWatcher
    const channel = supabase
      .channel('transactions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchAll();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return { transactions, loading, addTransaction, updateCategory, updateContent, refetch: fetchAll };
}
