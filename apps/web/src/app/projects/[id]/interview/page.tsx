"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { InterviewView } from "@/components/interview/interview-view";
import { createOrResumeSession, resumeSession } from "@/lib/api";

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    const resolve = async () => {
      try {
        // Try rawId as session ID first (new-project flow)
        const resumeResult = await resumeSession(rawId);
        if (resumeResult.session.status === "completed") {
          router.push(`/projects/${rawId}/summary`);
          return;
        }
        setSessionId(rawId);
        setResolving(false);
        return;
      } catch {
        // rawId is not a session — treat as project ID
      }

      // rawId is a project ID — get or create a session for it
      try {
        const result = await createOrResumeSession(rawId);
        if (result.status === "completed") {
          router.push(`/projects/${result.sessionId}/summary`);
          return;
        }
        setSessionId(result.sessionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load project");
      }
      setResolving(false);
    };
    resolve();
  }, [rawId, router]);

  if (resolving) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center" role="status">
        <p className="text-text-secondary">Loading interview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center" role="alert">
        <p className="text-text-secondary">No active session found for this project.</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <InterviewView sessionId={sessionId} />
    </div>
  );
}
