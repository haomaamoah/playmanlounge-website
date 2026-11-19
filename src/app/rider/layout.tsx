import type { Metadata } from "next";
import { RiderShell } from "@/components/rider/rider-shell";
import "./rider.css";

export const metadata: Metadata = {
  title: "Play Man Lounge | Rider Portal",
};

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return <RiderShell>{children}</RiderShell>;
}
