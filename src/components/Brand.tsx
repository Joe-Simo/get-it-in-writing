import { PenLine } from "lucide-react";
import { Link } from "react-router-dom";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand-lockup" aria-label="Get It in Writing home">
      <span className="brand-seal"><PenLine aria-hidden="true" /></span>
      <span>
        <strong>Get It in Writing</strong>
        {!compact && <small>Don’t rely on “probably.”</small>}
      </span>
    </Link>
  );
}
