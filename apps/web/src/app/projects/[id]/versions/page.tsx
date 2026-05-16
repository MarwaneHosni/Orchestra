"use client";

import { useParams } from "next/navigation";
import { VersionHistory } from "@/components/versions/version-history";

export default function VersionsPage() {
  const params = useParams();
  const sessionId = params.id as string;

  return (
    <div className="py-4">
      <VersionHistory sessionId={sessionId} />
    </div>
  );
}
