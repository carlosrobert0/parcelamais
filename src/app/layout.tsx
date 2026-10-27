import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Image from "next/image";
import logo from "@/assets/parcela-mais-logo.png";
import { Button } from "@/components/ui/button";
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
          <div className="mx-auto flex h-20 max-w-3xl items-center justify-between gap-4 px-4">
            <NewPreApprovalLink className="shrink-0">
              <Image src={logo} alt="parcela mais" priority unoptimized className="h-5 w-auto min-[400px]:h-6 sm:h-8" />
            </NewPreApprovalLink>
            <Button asChild variant="outline" className="h-9 border-brand-navy/50 bg-transparent px-3 min-[400px]:px-4 sm:h-10 sm:px-5">
              <NewPreApprovalLink>Nova consulta</NewPreApprovalLink>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
