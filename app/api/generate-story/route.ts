import { NextResponse } from "next/server"
import { Alchemy, Network } from "alchemy-sdk"

/**
 * POST /api/generate-story
 * Request body: { walletAddress: string }
 */
export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json()
    if (!walletAddress) return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })

    const apiKey = process.env.ALCHEMY_API_KEY
    if (!apiKey) return NextResponse.json({ error: "Missing ALCHEMY_API_KEY" }, { status: 500 })

    /* ------------------------------------------------------------------ */
    /* Initialise clients                                                 */
    /* ------------------------------------------------------------------ */
    const alchemyBase = new Alchemy({ apiKey, network: Network.BASE_MAINNET })
    const alchemyEth = new Alchemy({ apiKey, network: Network.ETH_MAINNET })

    /* ------------------------------------------------------------------ */
    /* ENS (lives on Ethereum L1)                                         */
    /* ------------------------------------------------------------------ */
    let ensName: string | null = null
    try {
      ensName = await alchemyEth.core.lookupAddress(walletAddress)
    } catch {
      /* ignore – ENS optional */
    }

    /* ------------------------------------------------------------------ */
    /* Transfers on Base - may fail (not yet supported)                   */
    /* ------------------------------------------------------------------ */
    let transferCount = 0
    let sawERC721 = false
    let sawERC20 = false
    try {
      const transfers = await alchemyBase.core.getAssetTransfers({
        fromBlock: "0x0",
        toAddress: walletAddress,
        category: ["erc20", "erc721", "erc1155"],
        maxCount: 10,
        order: "desc",
      })
      transferCount = transfers.transfers.length
      sawERC721 = transfers.transfers.some((t) => t.category === "erc721")
      sawERC20 = transfers.transfers.some((t) => t.category === "erc20")
    } catch (e) {
      console.warn("getAssetTransfers unsupported on Base – continuing without transfers")
    }

    /* ------------------------------------------------------------------ */
    /* NFTs owned on Base - may also fail                                 */
    /* ------------------------------------------------------------------ */
    let nftCount = 0
    let firstNftContract: string | undefined
    try {
      const nfts = await alchemyBase.nft.getNftsForOwner(walletAddress)
      nftCount = nfts.ownedNfts.length
      firstNftContract = nfts.ownedNfts[0]?.contract?.name
    } catch (e) {
      console.warn("getNftsForOwner unsupported on Base – continuing without NFTs")
    }

    /* ------------------------------------------------------------------ */
    /* Craft the story                                                    */
    /* ------------------------------------------------------------------ */
    const story: string[] = []

    // Intro
    story.push(
      ensName
        ? `Your journey as ${ensName} `
        : `For wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}, `,
    )

    // Transfers
    if (transferCount > 0) {
      story.push(`you’ve executed ${transferCount} recent transactions, interacting with multiple protocols. `)
      if (sawERC721) story.push("Your NFT collection is expanding. ")
      if (sawERC20) story.push("You actively manage fungible assets. ")
    } else {
      story.push("your wallet shows limited recent activity—an adventure still ahead. ")
    }

    // NFTs
    if (nftCount > 0) {
      story.push(`You hold ${nftCount} NFTs`)
      if (firstNftContract) story.push(`, including pieces from ${firstNftContract}`)
      story.push(". ")
    } else {
      story.push("You haven’t minted any NFTs yet. ")
    }

    story.push("This narrative captures your footprint on the blockchain so far.")

    return NextResponse.json({
      ensName: ensName ?? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      storyText: story.join(""),
    })
  } catch (err) {
    console.error("generate-story error:", err)
    return NextResponse.json({ error: "Failed to generate story" }, { status: 500 })
  }
}
