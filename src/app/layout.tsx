import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { NewPreApprovalLink } from "@/features/registration/NewPreApprovalLink";
import { Providers } from "./providers";
import "./globals.css";

const poppins = Poppins({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Parcela Mais · Pré-aprovação",
  description: "Pré-aprovação do paciente em várias financeiras ao mesmo tempo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-muted">
        <div aria-hidden className="h-1 bg-gradient-to-r from-brand-cyan to-brand-blue" />
        <header className="border-b bg-background">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
            <NewPreApprovalLink className="text-xl font-semibold tracking-tight text-primary">parcela mais</NewPreApprovalLink>
            <span className="text-sm text-muted-foreground">Pré-aprovação</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
