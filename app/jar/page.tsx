"use client";

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  type Provider,
  useAppKitConnection,
} from "@reown/appkit-adapter-solana/react";
import { BN } from "@coral-xyz/anchor";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useMemo, useState, useEffect, useCallback } from "react";

import { ConnectButton } from "../components/connect-button";
import { deriveDonationPDA, useProgram } from "./use-program";

type JarState = {
  creator: PublicKey;
  totalRaised: BN;
  donationCount: BN;
  lastDonor: PublicKey;
  bump: number;
};

export default function JarPage() {
  const program = useProgram();
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const { connection } = useAppKitConnection();

  const [reciepient, setRecipient] = useState<string>("");
  const [donateAmount, setDonateAmount] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    signature?: string;
  } | null>(null);
  const [lookupJar, setLookupJar] = useState<JarState | null>(null);
  const [myJar, setMyJar] = useState<JarState | null>(null);
  const [myJarBalance, setMyJarBalance] = useState<number>(0);

  const me = address ? new PublicKey(address) : null;

  const refreshMine = useCallback(async () => {
    if (!program || !me || !connection) return;
    const jarPDA = deriveDonationPDA(me);
    try {
      const state = (await program.account.jar.fetch(jarPDA)) as JarState;
      setMyJar(state);
      const lamports = await connection.getBalance(jarPDA);
      setMyJarBalance(lamports / LAMPORTS_PER_SOL);
    } catch (e) {
      setMyJar(null);
      setMyJarBalance(0);
    }
  }, [program, me?.toBase58(), connection]);

  useEffect(() => {
    refreshMine();
  }, [refreshMine]);

  const lookupReciepient = useCallback(async () => {
    if (!program || !reciepient) {
      setLookupJar(null);
      return;
    }

    try {
      const pk = new PublicKey(reciepient);
      const pda = deriveDonationPDA(pk);
      const state = (await program.account.jar.fetch(pda)) as JarState;
      setLookupJar(state);
      setStatus(null);
    } catch (e) {
      setLookupJar(null);
      setStatus({ message: "No jar found for this address." });
    }
  }, [program, reciepient]);

  const onInit = useCallback(async () => {
    if (!program || !me) return;
    setBusy(true);
    setStatus({ message: "Initializing jar..." });
    try {
      const tx = await program.methods
        .initJar()
        .accounts({
          creator: me,
        })
        .rpc();
      setStatus({ message: "Jar initialized!", signature: tx });
      await refreshMine();
    } catch (e) {
      console.error("initJar failed", e);
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ message: `Failed to initialize jar: ${msg}` });
    } finally {
      setBusy(false);
    }
  }, [program, me, refreshMine]);

  const onDonate = async () => {
    if (!program || !me) return;
    setBusy(true);
    setStatus({ message: "Processing donation..." });
    try {
      const target = reciepient ? new PublicKey(reciepient) : me;
      const lamports = new BN(Math.floor(donateAmount * LAMPORTS_PER_SOL));
      const jarPDA = deriveDonationPDA(target);
      const tx = await program.methods
        .donate(lamports)
        .accountsPartial({
          jar: jarPDA,
          donor: me,
        })
        .rpc();
      setStatus({ message: "Donation successful!", signature: tx });
      await refreshMine();
      if (reciepient) {
        await lookupReciepient();
      }
    } catch (e) {
      setStatus({ message: "Failed to process donation." });
    } finally {
      setBusy(false);
    }
  };

  const onWithdraw = async () => {
    if (!program || !me) return;
    setBusy(true);
    setStatus({ message: "Processing withdrawal..." });
    try {
      const lamports = new BN(Math.floor(withdrawAmount * LAMPORTS_PER_SOL));
      const tx = await program.methods
        .withdraw(lamports)
        .accountsPartial({
          jar: deriveDonationPDA(me),
          creator: me,
        })
        .rpc();
      setStatus({ message: "Withdrawal successful!", signature: tx });
      await refreshMine();
    } catch (e) {
      console.error("Withdrawal failed", e);
      setStatus({ message: "Failed to process withdrawal." });
    } finally {
      setBusy(false);
    }
  };

  const explorerUrl = (signature: string): string => {
    return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Donation Jar</h1>
      <ConnectButton />
      {status && (
        <div style={{ marginTop: 20 }}>
          <p>{status.message}</p>
          {status.signature && (
            <>
              {" "}
              <a
                href={explorerUrl(status.signature)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Explorer
              </a>
            </>
          )}
        </div>
      )}
      {me && !myJar && (
        <div style={{ marginTop: 20 }}>
          <button onClick={onInit} disabled={busy}>
            Initialize My Jar
          </button>
        </div>
      )}
      {address && (
        <div style={{ marginTop: 20 }}>
          <h2>Donate to a Jar</h2>
          <input
            type="number"
            placeholder="Amount to donate (SOL)"
            value={donateAmount}
            onChange={(e) => setDonateAmount(parseFloat(e.target.value))}
            disabled={busy}
          />
          <button onClick={onDonate} disabled={busy || donateAmount <= 0}>
            Donate to My Jar
          </button>
        </div>
      )}
      {myJar && (
        <div style={{ marginTop: 20 }}>
          <h2>My Jar</h2>
          <p>Total Raised: {myJar.totalRaised.toString()} lamports</p>
          <p>Donation Count: {myJar.donationCount.toString()}</p>
          <p>Last Donor: {myJar.lastDonor.toBase58()}</p>
          <p>Balance: {myJarBalance} SOL</p>
          <input
            type="number"
            placeholder="Amount to withdraw (SOL)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(parseFloat(e.target.value))}
            disabled={busy}
          />
          <button onClick={onWithdraw} disabled={busy || withdrawAmount <= 0}>
            Withdraw
          </button>
        </div>
      )}
      <div style={{ marginTop: 40 }}>
        <h2>Lookup Another Jar</h2>
        <input
          type="text"
          placeholder="Creator's Public Key"
          value={reciepient || ""}
          onChange={(e) => setRecipient(e.target.value)}
          disabled={busy}
          style={{ width: "400px" }}
        />
        <button onClick={lookupReciepient} disabled={busy || !reciepient}>
          Lookup
        </button>
      </div>
      {lookupJar && (
        <div style={{ marginTop: 20 }}>
          <h3>Jar Details</h3>
          <p>Creator: {reciepient}</p>
          <p>Total Raised: {lookupJar.totalRaised.toString()} lamports</p>
          <p>Donation Count: {lookupJar.donationCount.toString()}</p>
          <p>Last Donor: {lookupJar.lastDonor.toBase58()}</p>
        </div>
      )}
    </div>
  );
}
