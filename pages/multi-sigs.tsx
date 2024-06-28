import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";

import styles from "../styles/Home.module.css";
import {
  useAccount,
  useConnect,
  useSwitchAccount,
  useWalletClient,
} from "wagmi";
import { createMultisigAccountAlchemyClient } from "@alchemy/aa-alchemy";
import {
  arbitrumSepolia,
  UserOperationRequest,
  WalletClientSigner,
} from "@alchemy/aa-core";
import { useEffect, useState } from "react";
import { BIC_ADDRESS, TO_ADDRESS } from "../utils/constants";
import {
  Address,
  createWalletClient,
  custom,
  encodeFunctionData,
  Hex,
  parseAbi,
} from "viem";
import { arbitrum } from "viem/chains";
import { useCustomSnackBar } from "../hooks";
import { Button, Input, List, ListItem } from "@mui/joy";
import { metaMask } from "wagmi/connectors";

type MultiSignsType = Awaited<
  ReturnType<typeof createMultisigAccountAlchemyClient>
>;

const defaultOwners = [
  "0xa50d98Ca4a8FCa1DB31646B06A34f89BB1a875Aa",
  "0xF850dF471142D83C1BDafDb29de69F11e10Be8ff",
  "0x9F969EcA8815562260Fba6C533533a918841da2a",
] as Hex[];
const threshold = BigInt(2);

const MultiSignPage: NextPage = () => {
  const amount = BigInt(1.42e18);

  const { data } = useWalletClient();
  const { address } = useAccount();
  const { handleNotification } = useCustomSnackBar();

  const [smartAccount, setSmartAccount] = useState<MultiSignsType>();
  const [owners, setOwners] = useState<Hex[]>(defaultOwners);

  const [txHash, setTxHash] = useState("");
  const [proposeRequestData, setProposeRequestData] =
    useState<UserOperationRequest | null>(null);
  const [totalSignatures, setTotalSignatures] = useState<any>([]);
  const [aggregatedSignature, setAggregatedSignature] = useState<Hex | null>();

  const constructMultiSignAccount = async () => {
    if (data) {
      const client = createWalletClient({
        account: address,
        chain: arbitrum,
        transport: custom(window.ethereum),
      });

      const eoaSigner = new WalletClientSigner(
        client,
        "json-rpc" //signerType
      );

      console.log("🚀 ~ constructMultiSignAccount ~ eoaSigner:", await eoaSigner.getAddress())
      const smartAccountClient = await createMultisigAccountAlchemyClient({
        apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
        chain: arbitrumSepolia,
        ...(process.env.NEXT_PUBLIC_MULTI_SIG_ACCOUNT
          ? {
              accountAddress:
                `${process.env.NEXT_PUBLIC_MULTI_SIG_ACCOUNT}` as `0x${string}`,
            }
          : {}),
        // you can swap this out for any SmartAccountSigner
        signer: eoaSigner,
        owners: owners as `0x${string}`[],
        threshold,
        gasManagerConfig: {
          policyId: process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER as string,
        },
      });
      setSmartAccount(smartAccountClient);
    }
  };

  useEffect(() => {
    constructMultiSignAccount();
  }, [data, address]);

  const renderOwners = () => {
    if (!owners) return;
    return (
      <List>
        {owners.map((owner) => (
          <ListItem key={owner}>{owner}</ListItem>
        ))}
      </List>
    );
  };

  const renderProposeData = () => {
    if (!proposeRequestData) return;
    return <h5>{proposeRequestData.sender}</h5>;
  };

  const onProposeRequest = async () => {
    if (!smartAccount) {
      handleNotification("Multi sigs not initialized", "error");
      return;
    }
    try {
      const uoCallData = {
        target: BIC_ADDRESS as Address,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: parseAbi(["function transfer(address to, uint256 amount)"]),
          functionName: "transfer",
          args: [TO_ADDRESS, amount],
        }),
      };
      const result = await smartAccount.proposeUserOperation({
        uo: uoCallData,       
      });

      setTotalSignatures([...totalSignatures, result.signatureObj]);
      setAggregatedSignature(result.aggregatedSignature);
      setProposeRequestData(result.request);
    } catch (error) {
      handleNotification(error?.message, "error");
    }
  };

  const onSignPropose = async () => {
    if (!smartAccount) {
      handleNotification("Multi sigs not initialized", "error");
      return;
    }
    if (!proposeRequestData) {
      handleNotification("Propose not found", "error");
      return;
    }
    try {
      const isLastSignPropose = (totalSignatures.length) >= Number(threshold) - 1;
      if (!isLastSignPropose) {
        const result = await smartAccount.signMultisigUserOperation({
          userOperationRequest: proposeRequestData,
          signatures: totalSignatures,
        });
        setTotalSignatures([...totalSignatures, result.signatureObj]);
        setAggregatedSignature(result.aggregatedSignature as Hex);
      }
      if (isLastSignPropose) {
        const multiSignAccount = await constructMultiSignAccount();
        const result = await multiSignAccount.sendUserOperation({
          uo: proposeRequestData.callData,
          account: smartAccount.account,
          context: {
            aggregatedSignature: aggregatedSignature!,
            signatures: totalSignatures,
            userOpSignatureType: "ACTUAL",
          },
        });
        const txHash = await smartAccount.waitForUserOperationTransaction(
          result
        );
        handleNotification("Tx hash: " + txHash, "success");
        setTxHash(txHash);
        setAggregatedSignature(null);
        setTotalSignatures([]);
        setProposeRequestData(null);
      }
    } catch (error) {
      handleNotification(error?.message, "error");
    }
  };

  const renderButton = () => {
    if (!proposeRequestData) {
      return <Button onClick={onProposeRequest}>Propose Send Token</Button>;
    }
    if (proposeRequestData) {
      if (!address) {
        return <h3>Please connect wallet</h3>;
      }
      const isInclude = totalSignatures.find(
        (signature: any) =>
          String(signature.signer).toLowerCase() ===
          String(address).toLowerCase()
      );
      if (isInclude) {
        return (
          <div>
            <p>Signed</p>
            {/* <Button onClick={()=>{switchAccount({
            connector: metaMask()
          })}}>Switch Account</Button> */}
          </div>
        );
      }
      return <Button onClick={onSignPropose}>Sign request</Button>;
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <ConnectButton />
        <div>
          <div>
            <h3>Multi sig address: {smartAccount?.account?.address}</h3>
          </div>
          <div>
            <h1>Owners</h1>
            <h4>Threshold: {Number(threshold)}</h4>
            <div>{renderOwners()}</div>
          </div>
        </div>
        <div>
          <h1>Propose request</h1>
          <h3>To Address: {TO_ADDRESS}</h3>
          <h3>Amount: {amount.toString()}</h3>
          <div>{renderProposeData()}</div>
        </div>
        <div>{renderButton()}</div>
      </main>
    </div>
  );
};

export default MultiSignPage;
