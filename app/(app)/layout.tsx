import { RequireAuth } from "@/components/RequireAuth";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
