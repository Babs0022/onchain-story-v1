"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Download } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

// Define types for the API response data
interface WalletOverview {
  walletAgeDays: string
  totalTransactions: string
  gasSpentEth: string
  baseTransactions: string
  baseLaunchParticipant: boolean
  notableBaseNft: string
}

interface TransactionHistoryData {
  month: string
  count: number
}

interface TopDappInteractionData {
  name: string
  value: number
}

interface AnalyticsResponse {
  ensName: string
  keyInsights: string
  walletOverview: WalletOverview
  transactionHistory: TransactionHistoryData[]
  topDappInteractions: TopDappInteractionData[]
}

export default function OnchainAnalyticsPage() {
  const [appState, setAppState] = useState<"initial" | "loading" | "analytics" | "download-unimplemented" | "error">(
    "initial",
  )
  const [userInput, setUserInput] = useState("") // ENS or address
  const [ensName, setEnsName] = useState("")
  const [keyInsights, setKeyInsights] = useState("")
  const [walletOverview, setWalletOverview] = useState<WalletOverview | null>(null)
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistoryData[]>([])
  const [topDappInteractions, setTopDappInteractions] = useState<TopDappInteractionData[]>([])
  const [errorMessage, setErrorMessage] = useState("")

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
    setErrorMessage("") // Clear previous errors
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

      const data: AnalyticsResponse = await response.json()
      setEnsName(data.ensName)
      setKeyInsights(data.keyInsights)
      setWalletOverview(data.walletOverview)
      setTransactionHistory(data.transactionHistory)
      setTopDappInteractions(data.topDappInteractions)
      setAppState("analytics")
    } catch (error: any) {
      console.error("Error generating analytics:", error)
      setErrorMessage(error.message ?? "An unknown error occurred.")
      toast({
        title: "Analytics generation failed",
        description: error.message ?? "Unknown error",
        variant: "destructive",
      })
      setAppState("error")
    }
  }

  const handleDownloadReport = () => {
    // Placeholder for future download functionality
    setAppState("download-unimplemented")
  }

  const handleStartOver = () => {
    setAppState("initial")
    setUserInput("")
    setEnsName("")
    setKeyInsights("")
    setWalletOverview(null)
    setTransactionHistory([])
    setTopDappInteractions([])
    setErrorMessage("")
  }

  const chartConfig = {
    transactions: {
      label: "Transactions",
      color: "hsl(210 40% 98%)", // White for dark background
    },
    dapps: {
      label: "DApps",
      color: "hsl(210 40% 98%)", // White for dark background
    },
  }

  const PIE_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00c49f", "#ffbb28"]

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

      <Card className="relative z-10 w-full max-w-4xl rounded-xl border border-white/20 bg-white/10 p-8 shadow-lg backdrop-blur-lg">
        {appState === "initial" && (
          <div className="text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight">Onchain Analytics</h1>
            <p className="mb-8 text-lg text-gray-300">
              Enter your wallet address <span className="hidden sm:inline">or ENS name</span> to get a comprehensive
              analysis of your web3 activity.
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
            <p className="text-xl font-medium text-gray-300">Analyzing your onchain data...</p>
          </div>
        )}

        {appState === "error" && (
          <div className="grid gap-6 rounded-lg border border-red-500 bg-red-500/10 p-6 text-center">
            <h2 className="text-3xl font-bold text-red-400">Error!</h2>
            <p className="text-lg text-gray-300">{errorMessage}</p>
            <div className="flex flex-col items-center gap-4">
              <Button variant="ghost" className="text-gray-400 hover:text-gray-200" onClick={handleStartOver}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {appState === "analytics" && walletOverview && (
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-200">Wallet Age</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{walletOverview.walletAgeDays} days</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-200">Total Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{walletOverview.totalTransactions}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-200">Est. Gas Spent (ETH)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{walletOverview.gasSpentEth}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-200">Base Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{walletOverview.baseTransactions}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-200">Base Launch Participant</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{walletOverview.baseLaunchParticipant ? "Yes" : "No"}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-200">Notable NFT</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-white truncate">{walletOverview.notableBaseNft}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-200">Transaction History (Last 12 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={transactionHistory}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => value.slice(0, 3)}
                          className="text-xs text-gray-400"
                        />
                        <YAxis tickLine={false} axisLine={false} className="text-xs text-gray-400" />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="hsl(210 40% 98%)" // White line
                          strokeWidth={2}
                          dot={{ fill: "hsl(210 40% 98%)" }}
                          activeDot={{ r: 6, fill: "hsl(210 40% 98%)", stroke: "hsl(210 40% 98%)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-200">Top DApp Interactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={topDappInteractions}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {topDappInteractions.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col items-center gap-4">
              <Button
                className="w-full rounded-full bg-purple-600 px-8 py-4 text-xl font-semibold text-white shadow-purple-600/50 transition-all duration-300 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                onClick={handleDownloadReport}
              >
                <Download className="mr-2 h-6 w-6" />
                Download Report
              </Button>
              <Button variant="ghost" className="text-gray-400 hover:text-gray-200" onClick={handleStartOver}>
                Start Over
              </Button>
            </div>
          </div>
        )}

        {appState === "download-unimplemented" && (
          <div className="grid gap-6 rounded-lg border border-yellow-500 bg-yellow-500/10 p-6 text-center">
            <h2 className="text-3xl font-bold text-yellow-400">Download Coming Soon!</h2>
            <p className="text-lg text-gray-300">
              The report download functionality is currently under development. Stay tuned!
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
