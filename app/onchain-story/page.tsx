"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function OnchainStoryPage() {
  const [appState, setAppState] = useState<"initial" | "loading" | "story" | "success">("initial")
  const [userInput, setUserInput] = useState("") // ENS or address
  const [ensName, setEnsName] = useState("v0.eth")
  const [storyText, setStoryText] = useState(
    "Your journey onchain began with a single transaction, a digital footprint in the vast expanse of the blockchain. From your first NFT mint to your latest DeFi interaction, every move has woven a unique narrative. You've explored new protocols, collected rare digital artifacts, and contributed to decentralized communities, shaping your identity in the web3 universe.",
  )
  const [transactionHash, setTransactionHash] = useState("0x123abc...")

  // Validation function for wallet address or ENS name
  const isValidInput = (input: string) => {
    const trimmedInput = input.trim()
    // Regex for a 40-character hex string (address without 0x)
    const plainHexRegex = /^[a-fA-F0-9]{40}$/
    // Regex for a 0x-prefixed 42-character hex string (full address)
    const hexRegex = /^0x[a-fA-F0-9]{40}$/
    // Simple check for ENS name (contains a dot)
    const ensRegex = /\.eth$|\.xyz$|\.luxe$|\.kred$|\.art$|\.nft$|\.crypto$|\.dao$|\.blockchain$/i // Common ENS suffixes

    return hexRegex.test(trimmedInput) || plainHexRegex.test(trimmedInput) || ensRegex.test(trimmedInput)
  }

  const handleGenerateStory = async () => {
    setAppState("loading")
    try {
      const response = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: userInput.trim() }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to fetch story")
      }

      const data = await response.json()
      setEnsName(data.ensName)
      setStoryText(data.storyText)
      setAppState("story")
    } catch (error: any) {
      console.error("Error generating story:", error)
      toast({
        title: "Story generation failed",
        description: error.message ?? "Unknown error",
        variant: "destructive",
      })
      setAppState("initial")
    }
  }

  const handleMint = () => {
    setAppState("success")
    setTimeout(() => {
      setTransactionHash("0x" + Math.random().toString(16).substring(2, 12))
    }, 1000)
  }

  const handleStartOver = () => {
    setAppState("initial")
    setUserInput("")
    setEnsName("v0.eth")
    setStoryText(
      "Your journey onchain began with a single transaction, a digital footprint in the vast expanse of the blockchain. From your first NFT mint to your latest DeFi interaction, every move has woven a unique narrative. You've explored new protocols, collected rare digital artifacts, and contributed to decentralized communities, shaping your identity in the web3 universe.",
    )
    setTransactionHash("0x123abc...")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 to-black p-4 font-inter text-white">
      {/* Subtle background texture */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      ></div>

      <Card className="relative z-10 w-full max-w-2xl rounded-xl border border-white/20 bg-white/10 p-8 shadow-lg backdrop-blur-lg">
        {appState === "initial" && (
          <div className="text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight">Your Onchain Story</h1>
            <p className="mb-8 text-lg text-gray-300">
              Enter your wallet address <span className="hidden sm:inline">or ENS name</span> to generate and mint your
              web3 journey on Base.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Input
                type="text"
                placeholder="Enter wallet address or ENS name"
                className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-3 text-lg text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
              />
              <Button
                className="relative overflow-hidden rounded-full bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow-blue-600/50 transition-all duration-300 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
             before:absolute before:inset-0 before:animate-pulse-shadow before:rounded-full before:bg-blue-600/50 before:blur-lg before:content-['']"
                onClick={handleGenerateStory}
                disabled={!isValidInput(userInput)} // Updated disabled prop
              >
                Generate Story
              </Button>
            </div>
          </div>
        )}

        {appState === "loading" && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-400" />
            <p className="text-xl font-medium text-gray-300">Analyzing your onchain saga...</p>
          </div>
        )}

        {appState === "story" && (
          <div className="grid gap-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <Avatar className="h-24 w-24 border-2 border-white/30">
                <AvatarImage src="/placeholder.svg?height=96&width=96" alt="Profile Picture" />
                <AvatarFallback className="bg-gray-700 text-xl text-white">
                  {ensName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-1 text-center sm:text-left">
                <h2 className="text-3xl font-bold">{ensName}</h2>
                <p className="text-gray-300 whitespace-pre-line">{storyText}</p>
                <a href="#" className="mt-2 text-sm text-blue-400 underline hover:text-blue-300">
                  No PFP? Upload one.
                </a>
              </div>
            </div>
            <Button
              className="w-full rounded-full bg-green-600 px-8 py-4 text-xl font-semibold text-white shadow-green-600/50 transition-all duration-300 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              onClick={handleMint}
            >
              Mint for FREE on Base
            </Button>
          </div>
        )}

        {appState === "success" && (
          <div className="grid gap-6 rounded-lg border border-green-500 bg-green-500/10 p-6 text-center">
            <h2 className="text-3xl font-bold text-green-400">Minted Successfully!</h2>
            <p className="text-lg text-gray-300">
              Your Onchain Story has been successfully minted on Base. Share your unique web3 journey with the world!
            </p>
            <div className="flex flex-col items-center gap-4">
              <Button
                variant="link"
                className="text-blue-400 hover:text-blue-300"
                onClick={() => window.open(`https://basescan.org/tx/${transactionHash}`, "_blank")}
              >
                View Transaction
              </Button>
              <Button variant="ghost" className="text-gray-400 hover:text-gray-200" onClick={handleStartOver}>
                Start Over
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
