import vumaLogo from "@/assets/vuma-logo.png";
import { Link } from "@tanstack/react-router";

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return <img src={vumaLogo} alt="VUMA" className={className} width={512} height={512} loading="lazy" />;
}

export function LogoLink() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <Logo className="h-9 w-9" />
      <div className="leading-none">
        <div className="text-lg font-bold tracking-tight text-primary">VUMA</div>
        <div className="text-[10px] text-muted-foreground">Transparency. Trust. Together.</div>
      </div>
    </Link>
  );
}
