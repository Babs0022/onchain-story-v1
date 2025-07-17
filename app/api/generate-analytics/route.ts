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
      } catch (_) {
        // Non-fatal: ENS lookup might fail even for valid addresses
      }
    } else if (plainHexRegex.test(rawInput)) {
      // Missing 0x prefix
      resolvedWalletAddress = `0x${rawInput.toLowerCase()}`
      try {
        displayEnsName = await alchemyEth.core.lookupAddress(resolvedWalletAddress)
      } catch (_) {
        // Non-fatal
      }
    } else {
      // Treat as ENS – try resolution
      try {
        resolvedWalletAddress = await alchemyEth.core.resolveName(rawInput)
        if (resolvedWalletAddress) displayEnsName = rawInput.toLowerCase()
      } catch (e) {
        console.warn("ENS resolution failed:", e)
      }
    }

    if (!resolvedWalletAddress) {
      console.error("Invalid wallet address or unresolvable ENS name:", rawInput)
      return NextResponse.json(
        { error: "Invalid wallet address or unresolvable ENS name. Please check your input." },
        { status: 400 },
      )
    }
    console.log("Resolved Wallet Address:", resolvedWalletAddress)
    console.log("Display ENS Name:", displayEnsName)

    /* ------------------------------------------------------------------ */
    /* Data Collection for AI Input and Analytics                         */
    /* ------------------------------------------------------------------ */

    let walletAgeDays = 0
    let totalTransactions = 0
    let gasSpentEth = 0.0
    let baseTransactions = 0
    let baseLaunchParticipant = false
    let notableBaseNft = "a unique digital artifact"

    const transactionCountsByMonth: { [key: string]: number } = {}
    const contractInteractions: { [key: string]: number } = {} // Combined for top dApps

    const now = Date.now()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    // Helper to add transaction to counts and interactions
    const processTransaction = async (tx: any, alchemyClient: Alchemy) => {
      totalTransactions++
      if (tx.to) {
        contractInteractions[tx.to] = (contractInteractions[tx.to] || 0) + 1
      }
      try {
        const block = await alchemyClient.core.getBlock(tx.blockNum)
        if (block) {
          const txDate = new Date(Number.parseInt(block.timestamp, 16) * 1000)
          if (txDate.getTime() >= oneYearAgo.getTime()) {
            const monthYear = txDate.toLocaleString("en-US", { month: "short", year: "numeric" })
            transactionCountsByMonth[monthYear] = (transactionCountsByMonth[monthYear] || 0) + 1
          }
          // For wallet age, only consider the earliest transaction found
          if (walletAgeDays === 0 || (Date.now() - txDate.getTime()) / (1000 * 60 * 60 * 24) > walletAgeDays) {
            walletAgeDays = Math.floor((Date.now() - txDate.getTime()) / (1000 * 60 * 60 * 24))
          }
        }
      } catch (blockError) {
        console.warn("Could not get block timestamp for transaction:", tx.blockNum, blockError)
      }
    }

    // Fetch Ethereum Mainnet transfers
    try {
      const ethTransfers = await alchemyEth.core.getAssetTransfers({
        fromBlock: "0x0",
        toAddress: resolvedWalletAddress,
        category: ["erc20", "erc721", "erc1155", "external"],
        order: "desc",
        maxCount: 10000,
      })
      console.log("Fetched ETH Transfers Count:", ethTransfers.transfers.length)
      // console.log("Sample ETH Transfer:", ethTransfers.transfers[0]); // UNCOMMENT FOR MORE DETAIL IF NEEDED
      for (const tx of ethTransfers.transfers) {
        await processTransaction(tx, alchemyEth)
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
      console.log("Fetched Base Transfers Count:", baseTransfers.transfers.length)
      // console.log("Sample Base Transfer:", baseTransfers.transfers[0]); // UNCOMMENT FOR MORE DETAIL IF NEEDED
      for (const tx of baseTransfers.transfers) {
        await processTransaction(tx, alchemyBase)
      }

      const baseLaunchDate = new Date("2023-08-09T00:00:00Z").getTime()
      if (baseTransfers.transfers.length > 0) {
        const earliestBaseTx = baseTransfers.transfers[baseTransfers.transfers.length - 1]
        const block = await alchemyBase.core.getBlock(earliestBaseTx.blockNum)
        if (block) {
          const firstBaseTxDate = new Date(Number.parseInt(block.timestamp, 16) * 1000).getTime()
          if (firstBaseTxDate >= baseLaunchDate && firstBaseTxDate - baseLaunchDate < 30 * 24 * 60 * 60 * 1000) {
            baseLaunchParticipant = true
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching Base transfers (may be unsupported):", e)
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

    // Fetch NFTs owned on Ethereum (as a fallback if no Base NFTs)
    try {
      const ethNfts = await alchemyEth.nft.getNftsForOwner(resolvedWalletAddress)
      if (ethNfts.ownedNfts.length > 0 && notableBaseNft === "a unique digital artifact") {
        notableBaseNft = ethNfts.ownedNfts[0]?.title || ethNfts.ownedNfts[0]?.contract?.name || "a notable NFT"
      }
    } catch (e) {
      console.warn("Error fetching Ethereum NFTs:", e)
    }

    // Estimate gas spent (very rough estimate, actual gas calculation is complex)
    gasSpentEth = Number.parseFloat((totalTransactions * 0.0001).toFixed(4))

    // Prepare transaction history for chart (last 12 months)
    const formattedTransactionHistory: { month: string; count: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now)
      date.setMonth(date.getMonth() - i)
      const monthYear = date.toLocaleString("en-US", { month: "short", year: "numeric" })
      formattedTransactionHistory.push({
        month: monthYear,
        count: transactionCountsByMonth[monthYear] || 0,
      })
    }
    console.log("Transaction Counts By Month (Raw):", transactionCountsByMonth)
    console.log("Formatted Transaction History:", formattedTransactionHistory)

    // Prepare top DApp interactions for chart (top 5)
    const sortedDapps = Object.entries(contractInteractions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([address, count]) => ({
        name: address.slice(0, 6) + "...", // Shorten address for display
        value: count,
      }))
    console.log("Contract Interactions (Raw):", contractInteractions)
    console.log("Sorted DApps:", sortedDapps)

    const walletOverview = {
      walletAgeDays: walletAgeDays.toString(),
      totalTransactions: totalTransactions.toString(),
      gasSpentEth: gasSpentEth.toFixed(4),
      baseTransactions: baseTransactions.toString(),
      baseLaunchParticipant: baseLaunchParticipant,
      notableBaseNft: notableBaseNft,
    }
    console.log("Wallet Overview Data:", walletOverview)

    /* ------------------------------------------------------------------ */
    /* Generate Key Insights with AI SDK                                  */
    /* ------------------------------------------------------------------ */
    console.log("AI Prompt for Key Insights:", JSON.stringify(walletOverview))
    const { text: keyInsights } = await generateText({
      model: google("models/gemini-1.5-pro-latest"),
      prompt: JSON.stringify(walletOverview),
      system: `You are an Onchain Analytics AI, providing key insights into a wallet's activity.
Tone: Professional, analytical, and concise. Focus on summarizing the data.
Your task is to generate a two-paragraph summary of the provided JSON wallet overview data.

Paragraph 1 (Overall Activity): Summarize the wallet's general activity, including its age, total transactions, and estimated gas spent. Highlight any significant numbers.
Paragraph 2 (Base Network Focus): Detail the wallet's engagement with the Base network, mentioning Base-specific transactions, participation in the Base launch (if applicable), and any notable NFTs.`,
    })
    console.log("AI Generated Key Insights:", keyInsights)

    return NextResponse.json({
      ensName: displayEnsName ?? `${resolvedWalletAddress.slice(0, 6)}...${resolvedWalletAddress.slice(-4)}`,
      keyInsights: keyInsights,
      walletOverview: walletOverview,
      transactionHistory: formattedTransactionHistory,
      topDappInteractions: sortedDapps,
    })
  } catch (err) {
    console.error("generate-analytics error:", err)
    return NextResponse.json({ error: "Failed to generate analytics: " + (err as Error).message }, { status: 500 })
  }
}
