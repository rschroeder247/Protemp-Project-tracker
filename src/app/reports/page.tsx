import { ReportsClient } from '@/components/ReportsClient';
import { supabase, fetchAllTasks } from '@/lib/supabase';

export const revalidate = 0; // Fresh on every request

export default async function ReportsPage() {
  let initialDbTasks: any[] = [];
  let initialDbProgress: any[] = [];
  let initialDbProjects: any[] = [];

  try {
    const tasks = await fetchAllTasks();

    const { data: progress } = await supabase
      .from('tracker_task_progress')
      .select('*')
      .order('ticked_at', { ascending: false })
      .limit(5000);

    const { data: projects } = await supabase
      .from('tracker_projects')
      .select('*')
      .order('sort_order', { ascending: true });

    if (tasks) initialDbTasks = tasks;
    if (progress) initialDbProgress = progress || [];
    if (projects) initialDbProjects = projects || [];
  } catch (err) {
    console.error('SSR fetch error in ReportsPage:', err);
  }

  return (
    <ReportsClient
      initialDbTasks={initialDbTasks}
      initialDbProgress={initialDbProgress}
      initialDbProjects={initialDbProjects}
    />
  );
}
