import { NextResponse } from "next/server"
import { Alchemy, Network } from "alchemy-sdk"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"

/**
 * POST /api/generate-story
 * Request body: { walletAddress: string }
 */
export async function POST(request: Request) {
  try {
    const { walletAddress: rawInput } = await request.json()
    if (!rawInput) return NextResponse.json({ error: "Wallet address or ENS name is required" }, { status: 400 })

    const alchemyApiKey = process.env.ALCHEMY_API_KEY
    if (!alchemyApiKey) return NextResponse.json({ error: "Missing ALCHEMY_API_KEY" }, { status: 500 })

    const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: "Missing GOOGLE_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY)" }, { status: 500 })
    }

    /* ------------------------------------------------------------------ */
    /* Initialise Alchemy clients                                         */
    /* ------------------------------------------------------------------ */
    const alchemyBase = new Alchemy({ apiKey: alchemyApiKey, network: Network.BASE_MAINNET })
    const alchemyEth = new Alchemy({ apiKey: alchemyApiKey, network: Network.ETH_MAINNET })

    let resolvedWalletAddress: string | null = null
    let displayEnsName: string | null = null

    /* ------------------------------------------------------------------ */
    /* Resolve ENS ↔ Address                                              */
    /* ------------------------------------------------------------------ */
    const hexRegex = /^0x[a-fA-F0-9]{40}$/
    const plainHexRegex = /^[a-fA-F0-9]{40}$/ // address without 0x

    if (hexRegex.test(rawInput)) {
      // Already a checksummed / lowercase hex address
      resolvedWalletAddress = rawInput.toLowerCase()
      try {
        displayEnsName = await alchemyEth.core.lookupAddress(resolvedWalletAddress)
      } catch (_) {} // non-fatal
    } else if (plainHexRegex.test(rawInput)) {
      // Missing 0x prefix
      resolvedWalletAddress = `0x${rawInput.toLowerCase()}`
      try {
        displayEnsName = await alchemyEth.core.lookupAddress(resolvedWalletAddress)
      } catch (_) {}
    } else {
      // Treat as ENS – try both resolution methods
      try {
        resolvedWalletAddress =
          (await alchemyEth.core.resolveName(rawInput)) ||
          // Alchemy helper (some SDK versions expose this)
          // @ts-ignore – only exists in recent alchemy-sdk
          (await (alchemyEth.core as any).resolveEnsAddress?.(rawInput)) ||
          null

        if (resolvedWalletAddress) displayEnsName = rawInput.toLowerCase()
      } catch (e) {
        console.warn("ENS resolution failed:", e)
      }
    }

    if (!resolvedWalletAddress) {
      return NextResponse.json(
        { error: "Invalid wallet address or unresolvable ENS name. Please check your input." },
        { status: 400 },
      )
    }

    /* ------------------------------------------------------------------ */
    /* Data Collection for AI Input (using resolvedWalletAddress)         */
    /* ------------------------------------------------------------------ */

    let walletAgeDays = 0
    let totalTransactions = 0
    let activityPeak = "various periods of innovation"
    let mainnetQuest = "exploring decentralized finance and digital collectibles"
    let gasSpentEth = 0.0
    let baseTransactions = 0
    let baseLaunchParticipant = false
    let topBaseDapp = "various emerging protocols"
    let notableBaseNft = "a unique digital artifact"

    const allTransfers: { blockNum: string; to: string | null }[] = []
    const contractInteractionsEth: { [key: string]: number } = {}
    const contractInteractionsBase: { [key: string]: number } = {}

    // Fetch Ethereum Mainnet transfers
    try {
      const ethTransfers = await alchemyEth.core.getAssetTransfers({
        fromBlock: "0x0",
        toAddress: resolvedWalletAddress,
        category: ["erc20", "erc721", "erc1155", "external"],
        order: "desc",
        maxCount: 10000,
      })
      totalTransactions += ethTransfers.transfers.length
      allTransfers.push(...ethTransfers.transfers.map((t) => ({ blockNum: t.blockNum, to: t.to })))

      for (const tx of ethTransfers.transfers) {
        if (tx.to) {
          contractInteractionsEth[tx.to] = (contractInteractionsEth[tx.to] || 0) + 1
        }
      }

      if (ethTransfers.transfers.length > 0) {
        const earliestTx = ethTransfers.transfers[ethTransfers.transfers.length - 1]
        const block = await alchemyEth.core.getBlock(earliestTx.blockNum)
        if (block) {
          const firstTxDate = new Date(Number.parseInt(block.timestamp, 16) * 1000)
          walletAgeDays = Math.floor((Date.now() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24))
        }
      }
    } catch (e) {
      console.warn("Error fetching Ethereum transfers:", e)
    }

    // Fetch Base Mainnet transfers
    try {
      const baseTransfers = await alchemyBase.core.getAssetTransfers({
        fromBlock: "0x0",
        toAddress: resolvedWalletAddress,
        category: ["erc20", "erc721", "erc1155", "external"],
        order: "desc",
        maxCount: 10000,
      })
      baseTransactions = baseTransfers.transfers.length
      totalTransactions += baseTransactions
      allTransfers.push(...baseTransfers.transfers.map((t) => ({ blockNum: t.blockNum, to: t.to })))

      const baseLaunchDate = new Date("2023-08-09T00:00:00Z").getTime()
      if (baseTransfers.transfers.length > 0) {
        const earliestBaseTx = baseTransfers.transfers[baseTransfers.transfers.length - 1]
        const block = await alchemyBase.core.getBlock(earliestBaseTx.blockNum)
        if (block) {
          const firstBaseTxDate = new Date(Number.parseInt(block.timestamp, 16) * 1000).getTime()
          if (firstBaseTxDate - baseLaunchDate < 30 * 24 * 60 * 60 * 1000) {
            baseLaunchParticipant = true
          }
        }
      }

      for (const tx of baseTransfers.transfers) {
        if (tx.to) {
          contractInteractionsBase[tx.to] = (contractInteractionsBase[tx.to] || 0) + 1
        }
      }
    } catch (e) {
      console.warn("Error fetching Base transfers (may be unsupported):", e)
    }

    // Determine activity peak
    if (allTransfers.length > 0) {
      const blockTimestamps: { [year: string]: number } = {}
      for (const tx of allTransfers) {
        try {
          const block = await alchemyEth.core.getBlock(tx.blockNum)
          if (block) {
            const year = new Date(Number.parseInt(block.timestamp, 16) * 1000).getFullYear().toString()
            blockTimestamps[year] = (blockTimestamps[year] || 0) + 1
          }
        } catch (blockError) {
          try {
            const block = await alchemyBase.core.getBlock(tx.blockNum)
            if (block) {
              const year = new Date(Number.parseInt(block.timestamp, 16) * 1000).getFullYear().toString()
              blockTimestamps[year] = (blockTimestamps[year] || 0) + 1
            }
          } catch (e) {
            console.warn("Could not get block timestamp for activity peak:", e)
          }
        }
      }
      const sortedYears = Object.entries(blockTimestamps).sort(([, a], [, b]) => b - a)
      if (sortedYears.length > 0) {
        activityPeak = `the year ${sortedYears[0][0]}`
      }
    }

    // Determine mainnet quest
    const sortedEthDapps = Object.entries(contractInteractionsEth).sort(([, a], [, b]) => b - a)
    if (sortedEthDapps.length > 0) {
      mainnetQuest = `interacting with key protocols like ${sortedEthDapps[0][0].substring(0, 6)}... on Ethereum Mainnet`
    }

    // Determine top Base dApp
    const sortedBaseDapps = Object.entries(contractInteractionsBase).sort(([, a], [, b]) => b - a)
    if (sortedBaseDapps.length > 0) {
      topBaseDapp = `a prominent dApp like ${sortedBaseDapps[0][0].substring(0, 6)}... on Base`
    }

    // Fetch NFTs owned on Base
    try {
      const baseNfts = await alchemyBase.nft.getNftsForOwner(resolvedWalletAddress)
      if (baseNfts.ownedNfts.length > 0) {
        notableBaseNft = baseNfts.ownedNfts[0]?.title || baseNfts.ownedNfts[0]?.contract?.name || "a notable NFT"
      }
    } catch (e) {
      console.warn("Error fetching Base NFTs (may be unsupported):", e)
    }

    // Fetch NFTs owned on Ethereum (for a more complete picture, though story focuses on Base)
    try {
      const ethNfts = await alchemyEth.nft.getNftsForOwner(resolvedWalletAddress)
      if (ethNfts.ownedNfts.length > 0 && notableBaseNft === "a unique digital artifact") {
        notableBaseNft = ethNfts.ownedNfts[0]?.title || ethNfts.ownedNfts[0]?.contract?.name || "a notable NFT"
      }
    } catch (e) {
      console.warn("Error fetching Ethereum NFTs:", e)
    }

    // Removed Math.random() from gasSpentEth calculation
    gasSpentEth = Number.parseFloat((totalTransactions * 0.0001).toFixed(4))

    const aiInputData = {
      walletAgeDays: walletAgeDays.toString(),
      totalTransactions: totalTransactions.toString(),
      activityPeak: activityPeak,
      mainnetQuest: mainnetQuest,
      gasSpentEth: gasSpentEth.toFixed(2),
      baseLaunchParticipant: baseLaunchParticipant,
      baseTransactions: baseTransactions.toString(),
      topBaseDapp: topBaseDapp,
      notableBaseNft: notableBaseNft,
    }

    /* ------------------------------------------------------------------ */
    /* Generate Story with AI SDK                                         */
    /* ------------------------------------------------------------------ */
    const { text: generatedStory } = await generateText({
      model: google("models/gemini-1.5-pro-latest"),
      prompt: JSON.stringify(aiInputData),
      system: `You are a Base Historian, an archivist of the onchain world. Your purpose is to chronicle the epic journeys of its citizens, transforming raw data into a multi-part saga.
Tone: Insightful, respectful, and epic. You are documenting a legacy. Avoid jargon and focus on the meaning behind the actions.
Your task is to generate a three-paragraph story based on the provided JSON input data.

Paragraph 1 (The Genesis): Chronicle their origin. Acknowledge their experience using walletAgeDays and activityPeak. Describe their early quests on Mainnet using mainnetQuest.
Paragraph 2 (The Journey to Base): Detail their arrival on the new frontier. If baseLaunchParticipant is true, celebrate them as a pioneer. Describe their primary activity on the new network using topBaseDapp, notableBaseNft, and baseTransactions.
Paragraph 3 (The Legacy): Conclude with their overall impact. Summarize their entire journey, combining their total totalTransactions and gasSpentEth as a testament to their long-term commitment to the onchain world.`,
    })

    return NextResponse.json({
      ensName: displayEnsName ?? `${resolvedWalletAddress.slice(0, 6)}...${resolvedWalletAddress.slice(-4)}`,
      storyText: generatedStory,
    })
  } catch (err) {
    console.error("generate-story error:", err)
    return NextResponse.json({ error: "Failed to generate story: " + (err as Error).message }, { status: 500 })
  }
}
