import { TopBar } from "@/components/layout";
import { LiveLoop } from "@/components/live";

export default function LivePage() {
  return (
    <>
      <TopBar
        title="Live loop"
        subtitle="Three-department requests → ABP decisions → reflected sections"
      />
      <LiveLoop />
    </>
  );
}