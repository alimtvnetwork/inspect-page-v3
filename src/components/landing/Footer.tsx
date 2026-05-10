import { Link } from "react-router-dom";

interface FooterProps {
  version: string;
}

export const Footer = ({ version }: FooterProps): JSX.Element => {
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto w-full max-w-[720px] px-5 pb-12 pt-6 text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>© {year} · v{version}</span>
      <span aria-hidden>·</span>
      <Link to="/privacy" className="hover:text-foreground transition-colors">
        Privacy
      </Link>
    </footer>
  );
};