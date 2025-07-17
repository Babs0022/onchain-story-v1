import { NextResponse } from "next/server"
import { Alchemy, Network } from "alchemy-sdk"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"

/**
 * POST /api/generate-analytics
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
    /* Data Collection for AI Input and Charts (using resolvedWalletAddress) */
    /* ------------------------------------------------------------------ */

    let walletAgeDays = 0
    let totalTransactions = 0
    let gasSpentEth = 0.0
    let baseTransactions = 0
    let baseLaunchParticipant = false
    let notableBaseNft = "N/A"

    const allTransfers: { blockNum: string; to: string | null; value: number | null; asset: string | null }[] = []
    const contractInteractions: { [key: string]: number } = {}
    const transactionCountsByMonth: { [monthYear: string]: number } = {}

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
      allTransfers.push(
        ...ethTransfers.transfers.map((t) => ({ blockNum: t.blockNum, to: t.to, value: t.value, asset: t.asset })),
      )

      for (const tx of ethTransfers.transfers) {
        if (tx.to) {
          contractInteractions[tx.to] = (contractInteractions[tx.to] || 0) + 1
        }
        if (tx.value && tx.asset === "ETH") {
          gasSpentEth += tx.value // This is a simplification; actual gas calculation is more complex
        }
        try {
          const block = await alchemyEth.core.getBlock(tx.blockNum)
          if (block) {
            const date = new Date(Number.parseInt(block.timestamp, 16) * 1000)
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
            transactionCountsByMonth[monthYear] = (transactionCountsByMonth[monthYear] || 0) + 1
          }
        } catch (blockError) {
          console.warn("Error fetching block for ETH transaction history:", blockError)
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
      allTransfers.push(
        ...baseTransfers.transfers.map((t) => ({ blockNum: t.blockNum, to: t.to, value: t.value, asset: t.asset })),
      )

      const baseLaunchDate = new Date("2023-08-09T00:00:00Z").getTime()
      if (baseTransfers.transfers.length > 0) {
        const earliestBaseTx = baseTransfers.transfers[baseTransfers.transfers.length - 1]
        const block = await alchemyBase.core.getBlock(earliestBaseTx.blockNum)
        if (block) {
          const firstBaseTxDate = new Date(Number.parseInt(block.timestamp, 16) * 1000).getTime()
          if (firstBaseTxDate - baseLaunchDate < 30 * 24 * 60 * 60 * 1000) {
            baseLaunchParticipant = true
          }
          const date = new Date(Number.parseInt(block.timestamp, 16) * 1000)
          const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
          transactionCountsByMonth[monthYear] = (transactionCountsByMonth[monthYear] || 0) + 1
        }
      }

      for (const tx of baseTransfers.transfers) {
        if (tx.to) {
          contractInteractions[tx.to] = (contractInteractions[tx.to] || 0) + 1
        }
      }
    } catch (e) {
      console.warn("Error fetching Base transfers (may be unsupported):", e)
    }

    // Sort transaction history by date
    const sortedTransactionHistory = Object.entries(transactionCountsByMonth)
      .map(([date, transactions]) => ({ date, transactions }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Get top DApp interactions
    const sortedDapps = Object.entries(contractInteractions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // Get top 5 dApps
      .map(([address, count]) => ({ name: address.slice(0, 6) + "...", value: count }))

    // Fetch NFTs owned on Base
    try {
      const baseNfts = await alchemyBase.nft.getNftsForOwner(resolvedWalletAddress)
      if (baseNfts.ownedNfts.length > 0) {
        notableBaseNft = baseNfts.ownedNfts[0]?.title || baseNfts.ownedNfts[0]?.contract?.name || "a notable NFT"
      }
    } catch (e) {
      console.warn("Error fetching Base NFTs (may be unsupported):", e)
    }

    // Fetch NFTs owned on Ethereum (for a more complete picture)
    try {
      const ethNfts = await alchemyEth.nft.getNftsForOwner(resolvedWalletAddress)
      if (ethNfts.ownedNfts.length > 0 && notableBaseNft === "N/A") {
        notableBaseNft = ethNfts.ownedNfts[0]?.title || ethNfts.ownedNfts[0]?.contract?.name || "a notable NFT"
      }
    } catch (e) {
      console.warn("Error fetching Ethereum NFTs:", e)
    }

    const aiInputData = {
      walletAgeDays: walletAgeDays.toString(),
      totalTransactions: totalTransactions.toString(),
      gasSpentEth: gasSpentEth.toFixed(4),
      baseLaunchParticipant: baseLaunchParticipant,
      baseTransactions: baseTransactions.toString(),
      topDapps: sortedDapps.map((d) => `${d.name} (${d.value} interactions)`).join(", "),
      notableBaseNft: notableBaseNft,
    }

    /* ------------------------------------------------------------------ */
    /* Generate Key Insights with AI SDK                                  */
    /* ------------------------------------------------------------------ */
    const { text: generatedInsights } = await generateText({
      model: google("models/gemini-1.5-pro-latest"),
      prompt: JSON.stringify(aiInputData),
      system: `You are an Onchain Analytics AI, providing concise and insightful summaries of a wallet's activity. Your goal is to highlight key aspects of their journey based on the provided JSON data.
Tone: Informative, analytical, and clear. Avoid overly poetic language.
Your task is to generate a two-paragraph summary of the wallet's onchain activity.

Paragraph 1 (Overall Activity): Summarize the wallet's general activity, including its age (walletAgeDays), total transactions (totalTransactions), and estimated gas spent (gasSpentEth). Mention their engagement with top dApps (topDapps).
Paragraph 2 (Base Network Focus): Detail their activity on the Base network, including baseTransactions, whether they were a baseLaunchParticipant, and any notable NFTs (notableBaseNft).`,
    })

    return NextResponse.json({
      ensName: displayEnsName ?? `${resolvedWalletAddress.slice(0, 6)}...${resolvedWalletAddress.slice(-4)}`,
      keyInsights: generatedInsights,
      walletOverview: {
        walletAgeDays,
        totalTransactions,
        gasSpentEth,
        baseLaunchParticipant,
        baseTransactions,
        notableBaseNft,
      },
      transactionHistory: sortedTransactionHistory,
      topDappInteractions: sortedDapps,
    })
  } catch (err) {
    console.error("generate-analytics error:", err)
    return NextResponse.json({ error: "Failed to generate analytics: " + (err as Error).message }, { status: 500 })
  }
}
