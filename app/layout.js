import './globals.css';

export const metadata = {
  title: 'Rekap Reimburse',
  description: 'Pencatatan dan rekap reimburse operasional & material per project',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
