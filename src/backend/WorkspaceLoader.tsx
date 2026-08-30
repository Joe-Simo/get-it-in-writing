import { LoaderCircle } from "lucide-react";

export function WorkspaceLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0d0b] text-[#f2eee5]">
      <LoaderCircle className="size-7 animate-spin text-[#c8ff53]" />
      <span className="sr-only">Loading workspace</span>
    </div>
  );
}
