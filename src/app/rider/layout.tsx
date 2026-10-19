import { RiderShell } from "@/components/rider/rider-shell";
import "./rider.css";

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return <RiderShell>{children}</RiderShell>;
}
