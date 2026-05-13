import './globals.css';

export const metadata = {
  title: 'Scatter Solana | CasinoOS',
  description: 'Luxury neon Solana slot experience with provably fair commit-reveal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
