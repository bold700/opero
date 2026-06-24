import { Suspense } from "react";
import { ProjectDetailClient } from "@/components/project-detail-client";

export default function ProjectDetailPage() {
  return (
    <Suspense>
      <ProjectDetailClient />
    </Suspense>
  );
}
