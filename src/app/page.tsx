import { TrackerClient } from '@/components/TrackerClient';
import { supabase, fetchAllTasks } from '@/lib/supabase';

export const revalidate = 0; // Fresh on every request

export default async function Page() {
  let initialDbTasks: any[] = [];
  let initialDbProgress: any[] = [];

  try {
    const tasks = await fetchAllTasks();

    const { data: progress } = await supabase
      .from('tracker_task_progress')
      .select('*')
      .limit(5000);

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
