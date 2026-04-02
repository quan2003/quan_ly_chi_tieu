import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setGoals(data);
    setLoading(false);
  };

  const addGoal = async (goal) => {
    const { error } = await supabase.from('savings_goals').insert([goal]);
    if (!error) await fetchGoals();
    return !error;
  };

  const updateGoalProgress = async (id, current_amount) => {
    const { error } = await supabase
      .from('savings_goals')
      .update({ current_amount })
      .eq('id', id);
    if (!error) await fetchGoals();
    return !error;
  };

  const deleteGoal = async (id) => {
    const { error } = await supabase.from('savings_goals').delete().eq('id', id);
    if (!error) await fetchGoals();
    return !error;
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  return { goals, loading, addGoal, updateGoalProgress, deleteGoal, refetch: fetchGoals };
}
