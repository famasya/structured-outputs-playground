"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { Validator } from "jsonschema"
import { Check, ChevronDown, Github, Key, Play, Plus, Search, Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

interface Model {
  id: string
  name: string
  context_length: number
  pricing: {
    prompt: number
    completion: number
  }
  capabilities?: string[]
}

interface TestScenario {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
  jsonSchema: string
}

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function formatJson(content: string): string {
  try {
    const startIndex = content.indexOf("{");
    const endIndex = content.lastIndexOf("}") + 1;
    const jsonString = content.substring(startIndex, endIndex);
    const unescaped = JSON.parse(`"${jsonString}"`);
    return JSON.parse(unescaped);
  } catch (error) {
    console.log(error)
    return content
  }
}

export default function Home() {
  const [apiKey, setApiKey] = useState("")
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant that generates structured data.")
  const [jsonSchema, setJsonSchema] = useState(`{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" },
    "interests": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["name", "age", "interests"]
}`)
  const [schemaError, setSchemaError] = useState("")
  const [validationMessage, setValidationMessage] = useState("")
  const [userPrompt, setUserPrompt] = useState(
    "Generate a profile for a fictional character named Alex who loves technology.",
  )
  const [output, setOutput] = useState("")
  console.log(output)
  const [isLoading, setIsLoading] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [modelError, setModelError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showOnlyStructuredModels, setShowOnlyStructuredModels] = useState(false)
  const [scenarios, setScenarios] = useState<TestScenario[]>([
    {
      id: "1",
      name: "Character Profile",
      systemPrompt: "You are a helpful assistant that generates structured data.",
      userPrompt: "Generate a profile for a fictional character named Alex who loves technology.",
      jsonSchema: `{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" },
    "interests": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["name", "age", "interests"]
}`,
    },
    {
      id: "2",
      name: "Recipe Generator",
      systemPrompt: "You are a chef assistant that creates structured recipe data.",
      userPrompt: "Create a recipe for a simple pasta dish with tomatoes and basil.",
      jsonSchema: `{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "prepTime": { "type": "string" },
    "ingredients": { 
      "type": "array", 
      "items": { 
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "amount": { "type": "string" }
        },
        "required": ["name", "amount"]
      } 
    },
    "steps": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["title", "ingredients", "steps"]
}`,
    },
  ])
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [scenarioResults, setScenarioResults] = useState<Record<string, string>>({})
  const [runningAllScenarios, setRunningAllScenarios] = useState(false)

  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Initialize JSON schema validator
  const validator = new Validator()

  // Validate JSON schema
  const validateSchema = (schema: string, showSuccess = false) => {
    try {
      const parsedSchema = JSON.parse(schema)

      // Check if it's a valid JSON Schema
      try {
        // This will throw if the schema is invalid
        validator.validate("test", parsedSchema) // Just a basic validation to check schema structure
        setSchemaError("")
        if (showSuccess) {
          setValidationMessage("✓ Schema is valid")
          setTimeout(() => setValidationMessage(""), 3000)
        }
        return true
      } catch (error) {
        const errorMessage = `Invalid JSON Schema: ${error instanceof Error ? error.message : String(error)}`
        setSchemaError(errorMessage)
        if (showSuccess) {
          setValidationMessage(errorMessage)
        }
        return false
      }
    } catch (error) {
      const errorMessage = `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
      setSchemaError(errorMessage)
      if (showSuccess) {
        setValidationMessage(errorMessage)
      }
      return false
    }
  }

  // Validate schema when it changes
  useEffect(() => {
    validateSchema(jsonSchema)
  }, [jsonSchema])

  const fetchModels = async () => {
    setIsLoadingModels(true)
    setModelError("")

    try {
      // Fetch models without authentication
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Content-Type": "application/json",
          // Add API key if available, but it's not required for this endpoint
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`)
      }

      const data = await response.json()
      setModels(data.data || [])

      // Set default model if we have models and none is selected
      if (data.data?.length && !selectedModel) {
        setSelectedModel(data.data[0].id)
      }
    } catch (error) {
      setModelError(`Error fetching models: ${error instanceof Error ? error.message : String(error)}`)
      console.error("Error fetching models:", error)
    } finally {
      setIsLoadingModels(false)
    }
  }

  const handleApiKeySubmit = () => {
    setApiKeyDialogOpen(false)
  }

  const runTest = async (model: string, sysPrompt: string, usrPrompt: string, schema: string, scenarioId?: string) => {
    if (!apiKey) {
      setApiKeyDialogOpen(true)
      return
    }

    // Validate schema before running test
    if (!validateSchema(schema)) {
      return
    }

    if (!scenarioId) {
      setIsLoading(true)
      setOutput("")
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "OpenRouter Structured Output Tester",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: usrPrompt },
          ],
          response_format: { type: "json_object", schema: JSON.parse(schema) },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      const result = JSON.stringify(data.choices[0].message.content, null, 2)

      if (scenarioId) {
        setScenarioResults((prev) => ({
          ...prev,
          [scenarioId]: result,
        }))
      } else {
        setOutput(result)
      }

      return result
    } catch (error) {
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`

      if (scenarioId) {
        setScenarioResults((prev) => ({
          ...prev,
          [scenarioId]: errorMessage,
        }))
      } else {
        setOutput(errorMessage)
      }

      return errorMessage
    } finally {
      if (!scenarioId) {
        setIsLoading(false)
      }
    }
  }

  const handleRunTest = () => {
    runTest(selectedModel, systemPrompt, userPrompt, jsonSchema)
  }

  const handleRunAllScenarios = async () => {
    if (!apiKey) {
      setApiKeyDialogOpen(true)
      return
    }

    setRunningAllScenarios(true)
    setScenarioResults({})

    try {
      for (const scenario of scenarios) {
        await runTest(selectedModel, scenario.systemPrompt, scenario.userPrompt, scenario.jsonSchema, scenario.id)
      }
    } finally {
      setRunningAllScenarios(false)
    }
  }

  // Load models on initial render
  useEffect(() => {
    fetchModels()
  }, [])

  // Check if a model supports structured output
  const supportsStructuredOutput = (model: Model) => {
    return (
      model.capabilities?.includes("json") ||
      model.capabilities?.includes("tools") ||
      model.id.includes("claude") ||
      model.id.includes("gpt-4") ||
      model.id.includes("llama-3") ||
      model.id.includes("gemini")
    )
  }

  // Filter models based on search term and structured output toggle
  const filteredModels = models.filter((model) => {
    const matchesSearch =
      model.id.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      model.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())

    const matchesStructured = !showOnlyStructuredModels || supportsStructuredOutput(model)

    return matchesSearch && matchesStructured
  })

  // Add a new test scenario
  const addScenario = () => {
    const newId = String(Date.now())
    const newScenario: TestScenario = {
      id: newId,
      name: `Scenario ${scenarios.length + 1}`,
      systemPrompt,
      userPrompt,
      jsonSchema,
    }

    setScenarios([...scenarios, newScenario])
    setSelectedScenario(newId)
  }

  // Delete a test scenario
  const deleteScenario = (id: string) => {
    setScenarios(scenarios.filter((s) => s.id !== id))
    if (selectedScenario === id) {
      setSelectedScenario(null)
    }

    // Also remove any results for this scenario
    const newResults = { ...scenarioResults }
    delete newResults[id]
    setScenarioResults(newResults)
  }

  // Load a scenario
  const loadScenario = (id: string) => {
    const scenario = scenarios.find((s) => s.id === id)
    if (scenario) {
      setSystemPrompt(scenario.systemPrompt)
      setUserPrompt(scenario.userPrompt)
      setJsonSchema(scenario.jsonSchema)
      setSelectedScenario(id)
    }
  }

  return (
    <div className="container mx-auto py-6 px-6">
      <h1 className="text-lg md:text-2xl font-medium mb-6 flex items-center justify-between">
        <span>OpenRouter Structured Output Tester</span>
        <div className="flex flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setApiKeyDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Key className="h-4 w-4" />
            {apiKey ? "Change API Key" : "Set API Key"}
          </Button>
          <Link href="https://github.com/famasya/openrouter-playground" target="_blank">
            <Button variant={"outline"} size={"sm"}><Github /></Button>
          </Link>
        </div>
      </h1>

      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter OpenRouter API Key</DialogTitle>
            <DialogDescription>
              Your API key is required to make requests to OpenRouter. The key is only stored in memory and not
              persisted. You can browse models without an API key, but you'll need one to run tests.
            </DialogDescription>
          </DialogHeader>
          <Input type="password" placeholder="sk-or-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <DialogFooter>
            <Button onClick={handleApiKeySubmit}>Save API Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <span>Model Configuration</span>
                {isLoadingModels ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2" disabled={models.length === 0}>
                        {selectedModel ? selectedModel.split("/")[1] : "Select Model"}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[300px]">
                      <div className="p-2 space-y-2">
                        <div className="flex items-center border rounded-md px-3 py-1">
                          <Search className="h-4 w-4 mr-2 text-muted-foreground" />
                          <Input
                            placeholder="Search models..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                        <Toggle
                          pressed={showOnlyStructuredModels}
                          onPressedChange={setShowOnlyStructuredModels}
                          className="w-full justify-start"
                        >
                          Show supported models only
                        </Toggle>
                      </div>
                      <div className="h-px bg-border my-1" />
                      <div className="relative">
                        <ScrollArea className="h-[300px] overflow-y-auto">
                          {filteredModels.length > 0 ? (
                            filteredModels.map((model) => (
                              <DropdownMenuItem
                                key={model.id}
                                onClick={() => {
                                  setSelectedModel(model.id)
                                  setDropdownOpen(false)
                                }}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  <span>{model.name}</span>
                                  {supportsStructuredOutput(model) && (
                                    <Badge
                                      variant="outline"
                                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                    >
                                      JSON
                                    </Badge>
                                  )}
                                </div>
                                {selectedModel === model.id && <Check className="h-4 w-4 ml-2" />}
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                              No models found matching "{debouncedSearchTerm}"
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {modelError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{modelError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="system-prompt" className="block text-sm font-medium mb-2">
                    System Prompt
                  </label>
                  <Textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter system prompt..."
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>JSON Schema</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={jsonSchema}
                onChange={(e) => setJsonSchema(e.target.value)}
                placeholder="Enter JSON schema..."
                className={`font-mono text-sm min-h-[300px] ${schemaError ? "border-red-500" : ""}`}
              />
              <div className="flex justify-between items-center mt-2">
                <div className="text-sm">
                  {schemaError ? (
                    <span className="text-red-700">{schemaError}</span>
                  ) : validationMessage ? (
                    <span className="text-green-700">{validationMessage}</span>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => validateSchema(jsonSchema, true)}
                  className="ml-auto"
                >
                  Validate Schema
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Input</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Enter user prompt..."
                className="min-h-[150px]"
              />
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleRunTest}
                className="w-full"
                disabled={isLoading || !selectedModel || !apiKey || !!schemaError || runningAllScenarios}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Run Test
                  </span>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {scenarios.map((scenario) => (
                    <div key={scenario.id} className="flex items-center">
                      <Button
                        variant={selectedScenario === scenario.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => loadScenario(scenario.id)}
                        className="mr-1"
                      >
                        {scenario.name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteScenario(scenario.id)}
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addScenario} className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    Add Current
                  </Button>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleRunAllScenarios}
                    disabled={!apiKey || !selectedModel || runningAllScenarios || isLoading}
                    className="w-full"
                  >
                    {runningAllScenarios ? (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        Running All Scenarios...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        Run All Scenarios
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OpenRouter Output</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={selectedScenario || "current"}>
                <ScrollArea>
                  <TabsList className="mb-2 overflow-x-auto">
                    <TabsTrigger value="current">Current</TabsTrigger>
                    {scenarios.map((scenario) => (
                      <TabsTrigger key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>

                <TabsContent value="current">
                  <Tabs defaultValue="formatted">
                    <TabsList className="mb-2">
                      <TabsTrigger value="formatted">Formatted</TabsTrigger>
                      <TabsTrigger value="raw">Raw</TabsTrigger>
                    </TabsList>
                    <TabsContent value="formatted">
                      {output ? (
                        <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[400px] font-mono text-sm">
                          {JSON.stringify(formatJson(output), null, 2)}
                        </pre>
                      ) : (
                        <div className="bg-muted p-4 rounded-md text-muted-foreground text-center">
                          Output will appear here after running the test
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="raw">
                      {output ? (
                        <Textarea readOnly value={JSON.stringify(formatJson(output))} className="font-mono text-sm min-h-[400px]" />
                      ) : (
                        <div className="bg-muted p-4 rounded-md text-muted-foreground text-center">
                          Output will appear here after running the test
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                {scenarios.map((scenario) => (
                  <TabsContent key={scenario.id} value={scenario.id}>
                    {scenarioResults[scenario.id] ? (
                      <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[400px] font-mono text-sm">
                        {scenarioResults[scenario.id]}
                      </pre>
                    ) : (
                      <div className="bg-muted p-4 rounded-md text-muted-foreground text-center">
                        Run all scenarios to see results
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
