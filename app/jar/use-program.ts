"use client";

import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  Keypair,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import { type Provider } from "@reown/appkit-adapter-solana/react";
import { Wallet, AnchorProvider, Program } from "@coral-xyz/anchor";

import idl from "../idl/donation_anchor.json";
import type { DonationAnchor } from "../idl/donation_anchor";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useMemo } from "react";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl("devnet");

export const PROGRAM_ID = new PublicKey(idl.address);

function buildWallet(provider: Provider): Wallet {
  return {
    publicKey: provider.publicKey!,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T,
    ) => {
      return provider.signTransaction(tx);
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[],
    ) => {
      return provider.signAllTransactions(txs);
    },
    payer: Keypair.generate(),
  };
}

export function useProgram() {
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const { address } = useAppKitAccount();

  return useMemo(() => {
    if (!walletProvider?.publicKey || !address) {
      return null;
    }

    const connection = new Connection(RPC_ENDPOINT, "confirmed");

    const provider = new AnchorProvider(
      connection,
      buildWallet(walletProvider),
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      },
    );

    return new Program<DonationAnchor>(idl as DonationAnchor, provider);
  }, [walletProvider, address]);
}

export function deriveDonationPDA(creator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("jar"), creator.toBuffer()],
    PROGRAM_ID,
  )[0];
}
