import "../styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { AppProps } from "next/app";
import { SnackbarProvider } from "notistack";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";

const config = getDefaultConfig({
  appName: "RainbowKit App",
  projectId: "YOUR_PROJECT_ID",
  chains: [arbitrumSepolia],
  ssr: true,
});

const client = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider>
          <SnackbarProvider>
            <Component {...pageProps} />
          </SnackbarProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default MyApp;
