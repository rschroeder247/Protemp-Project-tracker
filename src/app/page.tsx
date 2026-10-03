import { TrackerClient } from '@/components/TrackerClient';
import { supabase } from '@/lib/supabase';

export const revalidate = 0; // Fresh on every request

export default async function Page() {
  let initialDbTasks: any[] = [];
  let initialDbProgress: any[] = [];

  try {
    const { data: tasks } = await supabase
      .from('tracker_tasks')
      .select('*')
      .order('sort_order', { ascending: true })
      .limit(3000);

    const { data: progress } = await supabase
      .from('tracker_task_progress')
      .select('*');

    if (tasks) initialDbTasks = tasks;
    if (progress) initialDbProgress = progress || [];
  } catch (err) {
    console.error('SSR fetch error:', err);
  }

  return (
    <TrackerClient
      initialDbTasks={initialDbTasks}
      initialDbProgress={initialDbProgress}
    />
  );
}
