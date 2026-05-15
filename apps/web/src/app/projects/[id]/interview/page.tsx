"use client";

import { useParams } from "next/navigation";
import { InterviewView } from "@/components/interview/interview-view";

export default function InterviewPage() {
  const params = useParams();
  const sessionId = params.id as string;

  return (
    <div className="py-4">
      <InterviewView sessionId={sessionId} />
    </div>
  );
}
