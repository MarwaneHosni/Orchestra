"use client";

import { useParams } from "next/navigation";
import { TaskGraphView } from "@/components/task-graph/task-graph-view";

export default function TasksPage() {
  const params = useParams();
  return (
    <div className="py-4">
      <TaskGraphView sessionId={params.id as string} />
    </div>
  );
}
