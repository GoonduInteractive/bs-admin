import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getVolumes } from "@/lib/api/merch";
import { VolumeForm } from "../../volume-form";

export const metadata: Metadata = { title: "New volume" };

export default async function NewVolumePage() {
  const volumes = await getVolumes();
  const nextNumber = Math.max(0, ...volumes.map((v) => v.number)) + 1;
  return (
    <>
      <PageHeader
        back={{ href: "/comics", label: "Comics" }}
        title="New volume"
        description="Name the collected edition, then add its chapters."
      />
      <VolumeForm nextNumber={nextNumber} />
    </>
  );
}
