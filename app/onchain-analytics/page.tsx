"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Download } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts"

type TransactionData = {
  date: string
  transactions: number
}

type DappInteractionData = {
  name: string
  value: number
  color: string
}

export default function OnchainAnalyticsPage() {
  const [appState, setAppState] = useState<"initial" | "loading" | "analytics" | "error">("initial")
  const [userInput, setUserInput] = useState("")
  const [ensName, setEnsName] = useState("")
  const [keyInsights, setKeyInsights] = useState("")
  const [walletOverview, setWalletOverview] = useState({
    walletAgeDays: 0,
    totalTransactions: 0,
    gasSpentEth: 0,
    baseLaunchParticipant: false,
    baseTransactions: 0,
    notableBaseNft: "N/A",
  })
  const [transactionHistory, setTransactionHistory] = useState<TransactionData[]>([])
  const [topDappInteractions, setTopDappInteractions] = useState<DappInteractionData[]>([])

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF19AF"]

  // Validation function for wallet address or ENS name
  const isValidInput = (input: string) => {
    const trimmedInput = input.trim()
    const plainHexRegex = /^[a-fA-F0-9]{40}$/
    const hexRegex = /^0x[a-fA-F0-9]{40}$/
    const ensRegex = /\.eth$|\.xyz$|\.luxe$|\.kred$|\.art$|\.nft$|\.crypto$|\.dao$|\.blockchain$/i

    return hexRegex.test(trimmedInput) || plainHexRegex.test(trimmedInput) || ensRegex.test(trimmedInput)
  }

  const handleGenerateAnalytics = async () => {
    setAppState("loading")
    try {
      const response = await fetch("/api/generate-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: userInput.trim() }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to fetch analytics")
      }

      const data = await response.json()
      setEnsName(data.ensName)
      setKeyInsights(data.keyInsights)
      setWalletOverview(data.walletOverview)
      setTransactionHistory(data.transactionHistory)
      setTopDappInteractions(
        data.topDappInteractions.map((d: any, i: number) => ({ ...d, color: COLORS[i % COLORS.length] })),
      )
      setAppState("analytics")
    } catch (error: any) {
      console.error("Error generating analytics:", error)
      toast({
        title: "Analytics generation failed",
        description: error.message ?? "Unknown error",
        variant: "destructive",
      })
      setAppState("error")
    }
  }

  const handleDownloadReport = () => {
    toast({
      title: "Download Report",
      description: "Report download functionality is not yet implemented.",
    })
  }

  const handleStartOver = () => {
    setAppState("initial")
    setUserInput("")
    setEnsName("")
    setKeyInsights("")
    setWalletOverview({
      walletAgeDays: 0,
      totalTransactions: 0,
      gasSpentEth: 0,
      baseLaunchParticipant: false,
      baseTransactions: 0,
      notableBaseNft: "N/A",
    })
    setTransactionHistory([])
    setTopDappInteractions([])
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 to-black p-4 font-inter text-white">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      ></div>

      <Card className="relative z-10 w-full max-w-4xl rounded-xl border border-white/20 bg-white/10 p-8 shadow-lg backdrop-blur-lg">
        {appState === "initial" && (
          <div className="text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight">Onchain Analytics</h1>
            <p className="mb-8 text-lg text-gray-300">
              Enter your wallet address <span className="hidden sm:inline">or ENS name</span> to visualize your web3
              journey with comprehensive analytics.
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
                onClick={handleGenerateAnalytics}
                disabled={!isValidInput(userInput)}
              >
                Generate Analytics
              </Button>
            </div>
          </div>
        )}

        {appState === "loading" && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-400" />
            <p className="text-xl font-medium text-gray-300">Crunching your onchain data...</p>
          </div>
        )}

        {appState === "analytics" && (
          <div className="grid gap-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <Avatar className="h-24 w-24 border-2 border-white/30">
                <AvatarImage src="/placeholder.svg?height=96&width=96" alt="Profile Picture" />
                <AvatarFallback className="bg-gray-700 text-xl text-white">
                  {ensName ? ensName.slice(0, 2).toUpperCase() : "?? "}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-1 text-center sm:text-left">
                <h2 className="text-3xl font-bold">{ensName || "Your Wallet"}</h2>
                <p className="text-gray-300 whitespace-pre-line">{keyInsights}</p>
                <a href="#" className="mt-2 text-sm text-blue-400 underline hover:text-blue-300">
                  No PFP? Upload one.
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Wallet Overview</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300 grid gap-2">
                  <p>
                    <strong>Wallet Age:</strong> {walletOverview.walletAgeDays} days
                  </p>
                  <p>
                    <strong>Total Transactions:</strong> {walletOverview.totalTransactions}
                  </p>
                  <p>
                    <strong>Estimated Gas Spent (ETH):</strong> {walletOverview.gasSpentEth.toFixed(4)}
                  </p>
                  <p>
                    <strong>Base Transactions:</strong> {walletOverview.baseTransactions}
                  </p>
                  <p>
                    <strong>Base Launch Participant:</strong> {walletOverview.baseLaunchParticipant ? "Yes" : "No"}
                  </p>
                  <p>
                    <strong>Notable Base NFT:</strong> {walletOverview.notableBaseNft}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      transactions: {
                        label: "Transactions",
                        color: "hsl(var(--chart-1))",
                      },
                    }}
                    className="aspect-video h-[200px] w-full"
                  >
                    <LineChart data={transactionHistory}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => value.slice(2)}
                        className="text-xs text-gray-400"
                      />
                      <YAxis tickLine={false} axisLine={false} className="text-xs text-gray-400" />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                      <Line
                        dataKey="transactions"
                        type="monotone"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white">Top DApp Interactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={topDappInteractions.reduce((acc, dapp) => {
                      acc[dapp.name] = { label: dapp.name, color: dapp.color }
                      return acc
                    }, {})}
                    className="aspect-video h-[250px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={topDappInteractions}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {topDappInteractions.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                className="flex-1 rounded-full bg-purple-600 px-8 py-4 text-xl font-semibold text-white shadow-purple-600/50 transition-all duration-300 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                onClick={handleDownloadReport}
              >
                <Download className="mr-2 h-6 w-6" /> Download Report
              </Button>
              <Button variant="ghost" className="flex-1 text-gray-400 hover:text-gray-200" onClick={handleStartOver}>
                Start Over
              </Button>
            </div>
          </div>
        )}

        {appState === "error" && (
          <div className="grid gap-6 rounded-lg border border-red-500 bg-red-500/10 p-6 text-center">
            <h2 className="text-3xl font-bold text-red-400">Error Generating Analytics</h2>
            <p className="text-lg text-gray-300">
              There was an issue fetching your onchain data. Please try again with a valid wallet address or ENS name.
            </p>
            <div className="flex flex-col items-center gap-4">
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
