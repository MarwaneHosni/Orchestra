"use client";

import { useParams } from "next/navigation";
import { TaskGraphView } from "@/components/task-graph/task-graph-view";

export default function TasksPage() {
  const params = useParams();
  return (
    <TaskGraphView sessionId={params.id as string} />
  );
}
