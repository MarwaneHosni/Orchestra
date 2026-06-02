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
        await resumeSession(rawId);
        setSessionId(rawId);
        setResolving(false);
        return;
      } catch {
        // rawId is not a session — treat as project ID
      }

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
      <div className="text-center" role="status">
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>resolving session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "20px", textAlign: "center" }} role="alert">
          <p style={{ fontSize: 14, color: "var(--color-accent-red)" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="text-center" role="alert">
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No active session found for this project.</p>
      </div>
    );
  }

  return (
    <div>
      <InterviewView sessionId={sessionId} />
    </div>
  );
}
