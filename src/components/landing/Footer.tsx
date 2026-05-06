interface FooterProps {
  version: string;
}

export const Footer = ({ version }: FooterProps): JSX.Element => {
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto w-full max-w-[720px] px-5 pb-12 pt-6 text-sm text-muted-foreground">
      © {year} · v{version}
    </footer>
  );
};