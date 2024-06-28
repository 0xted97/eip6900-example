import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";

import styles from "../styles/Home.module.css";
import { useAccount, useWalletClient } from "wagmi";
import { createMultiOwnerLightAccountAlchemyClient } from "@alchemy/aa-alchemy";
import { arbitrumSepolia, WalletClientSigner } from "@alchemy/aa-core";
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

type MultiOwnersType = Awaited<
  ReturnType<typeof createMultiOwnerLightAccountAlchemyClient>
>;
const MultiOwnersPage: NextPage = () => {
  const { data } = useWalletClient();
  const { address } = useAccount();
  const { handleNotification } = useCustomSnackBar();

  const [multiOwners, setMultiOwners] = useState<MultiOwnersType>();
  const [owners, setOwners] = useState<readonly `0x${string}`[]>(
    [] as `0x${string}`[]
  );
  const [txHash, setTxHash] = useState("");
  const [ownerAdding, setOwnerAdding] = useState<string[]>([]);
  const [ownerRemoving, setOwnerRemoving] = useState<string[]>([]);
  const [addressAdding, setAddressAdding] = useState<Hex>();

  const constructMultiOwnerAccount = async () => {
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
      const smartAccountClient =
        await createMultiOwnerLightAccountAlchemyClient({
          apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
          chain: arbitrumSepolia,
          ...(process.env.NEXT_PUBLIC_MULTI_OWNER_ACCOUNT
            ? {
                accountAddress:
                  `${process.env.NEXT_PUBLIC_MULTI_OWNER_ACCOUNT}` as `0x${string}`,
              }
            : {}),
          // you can swap this out for any SmartAccountSigner
          signer: eoaSigner,
          owners: [],
          // gasManagerConfig: {
          //   policyId: process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER as string,
          // },
        });
      setMultiOwners(smartAccountClient);
    }
  };

  useEffect(() => {
    constructMultiOwnerAccount();
  }, [data]);

  const fetchOwners = async () => {
    if (multiOwners) {
      try {
        const owners = await multiOwners.account.getOwnerAddresses();
        setOwners(owners);
      } catch (error) {
        handleNotification(error?.message, "error");
      }
    }
  };

  useEffect(() => {
    fetchOwners();
  }, [data, multiOwners]);

  const onTestSendOperation = async () => {
    if (multiOwners) {
      const amount = BigInt(1.22e18);
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
        const result = await multiOwners.sendUserOperation({
          uo: uoCallData,
          account: multiOwners.account!,
        });
        const txHash = await multiOwners.waitForUserOperationTransaction(
          result
        );
        setTxHash(txHash);
        handleNotification("Tx hash: " + txHash, "success");
      } catch (error) {
        handleNotification(error?.message, "error");
      }
    }
  };

  const onSendUpdateOwner = async () => {
    try {
      if (!multiOwners) {
        handleNotification("Multi owners not initialized", "error");
        return;
      }
      const ownersToAdd: Address[] = ownerAdding.map(
        (owner) => owner as Address
      );
      console.log("🚀 ~ onSendUpdateOwner ~ ownersToAdd:", ownersToAdd)

      const ownersToRemove: Address[] = ownerRemoving.map(
        (owner) => owner as Address
      );
      console.log("🚀 ~ onSendUpdateOwner ~ ownersToRemove:", ownersToRemove)

      const result = await (multiOwners as any).updateOwners({
        ownersToAdd, ownersToRemove
      });

      const txHash = await multiOwners.waitForUserOperationTransaction({
        hash: result,
      });
      setTxHash(txHash);
      handleNotification("Tx hash: " + txHash, "success");
    } catch (error) {
      console.log("🚀 ~ onSendUpdateOwner ~ error:", error)
      handleNotification(error?.message, "error");
    }
  };

  const renderOwners = () => {
    if (!owners) return;
    return (
      <List>
        {owners.map((owner) => (
          <ListItem key={owner}>
            {owner}
            <Button onClick={() => onUpdateOwners(owner, "remove")}>
              Remove
            </Button>
          </ListItem>
        ))}
      </List>
    );
  };

  const onUpdateOwners = (address: Hex, type: "add" | "remove") => {
    if (!address) {
      handleNotification("Please enter an address", "error");
      return;
    }
    if (type === "add") {
      setOwners(Array.from(new Set([...owners, address])));
      setOwnerAdding([...ownerAdding, address]);
    }
    if (type === "remove") {
      setOwners(owners.filter((addr) => addr.toLowerCase() !== address.toLowerCase()));
      setOwnerRemoving([...ownerRemoving, address]);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <ConnectButton />
        <div>
          <div>
            <h3>Multi owner address: {multiOwners?.account?.address}</h3>
          </div>
          <div>
            <Button onClick={onTestSendOperation}>Test Send Operation</Button>
          </div>

          <div>
            <h1>Owners</h1>
            <div>
              {renderOwners()}
              <Button
                onClick={() => fetchOwners()}
              >
                Restart
              </Button>
            </div>
            <div>
              <Input
                placeholder="Type in here…"
                value={addressAdding}
                onChange={(e) => setAddressAdding(e.target.value as Hex)}
              />
              <Button
                onClick={() => onUpdateOwners(addressAdding as Hex, "add")}
              >
                Add more
              </Button>
            </div>
            <Button  onClick={onSendUpdateOwner}>Update Owner</Button>
          </div>
          <div>
            <h1>Transaction Hash</h1>
            <div>{txHash}</div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MultiOwnersPage;
