import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NewPreApprovalLink } from "@/features/registration/NewPreApprovalLink";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Parcela Mais · Pré-aprovação",
  description: "Pré-aprovação do paciente em várias financeiras ao mesmo tempo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-muted/40">
        <header className="border-b bg-background">
          <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
            <NewPreApprovalLink className="font-semibold tracking-tight">
              Parcela <span className="text-primary">Mais</span>
            </NewPreApprovalLink>
            <span className="ml-3 text-sm text-muted-foreground">Pré-aprovação</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
