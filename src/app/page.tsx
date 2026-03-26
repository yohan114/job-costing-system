'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Upload, 
  Search, 
  FileSpreadsheet, 
  Truck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Database
} from 'lucide-react'

interface Record {
  id: string
  sheetName: string
  vehicleNo: string
  recordDate: string
  rawData: Record<string, unknown>
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{totalRecords: number; sheets: {name: string; records: number}[]} | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [selectedSheet, setSelectedSheet] = useState('')
  
  const [sheets, setSheets] = useState<string[]>([])
  const [vehicles, setVehicles] = useState<string[]>([])
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(false)
  const [hasData, setHasData] = useState(false)

  // Load metadata on mount
  useEffect(() => {
    loadMetadata()
  }, [])

  // Auto-load records when data exists
  useEffect(() => {
    if (hasData && records.length === 0) {
      searchRecords()
    }
  }, [hasData])

  const loadMetadata = async () => {
    try {
      const response = await fetch('/api/records', { method: 'POST' })
      const data = await response.json()
      if (data.sheets && data.sheets.length > 0) {
        setSheets(data.sheets)
        setVehicles(data.vehicles || [])
        setHasData(true)
      }
    } catch (err) {
      console.error('Metadata error:', err)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      const result = await response.json()

      if (result.success) {
        setUploadResult(result)
        setFile(null)
        const fileInput = document.getElementById('file-upload') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        await loadMetadata()
        // Auto-search after upload
        searchRecords()
      } else {
        setError(result.error || 'Upload failed')
      }
    } catch (err) {
      setError('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const searchRecords = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      if (vehicleNo) params.append('vehicleNo', vehicleNo)
      if (selectedSheet && selectedSheet !== 'all') params.append('sheetName', selectedSheet)
      
      const queryString = params.toString()
      const url = queryString ? `/api/records?${queryString}` : '/api/records'
      
      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setRecords(result.records)
      } else {
        setError(result.error || 'Search failed')
      }
    } catch (err) {
      setError('Failed to search records')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setFromDate('')
    setToDate('')
    setVehicleNo('')
    setSelectedSheet('')
    searchRecords()
  }

  // Get all unique columns
  const columns = Array.from(new Set(records.flatMap(r => Object.keys(r.rawData)))).sort()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Job Costing System</h1>
                <p className="text-sm text-muted-foreground">Upload Excel • Filter • View Results</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasData && (
                <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> {records.length} Records</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
        {/* Upload Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" />
              Upload Excel File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              <Button onClick={handleUpload} disabled={!file || uploading} className="px-8">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload
              </Button>
            </div>
            {uploadResult && (
              <Alert className="mt-3 border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700">Success!</AlertTitle>
                <AlertDescription className="text-green-600">
                  Loaded {uploadResult.totalRecords} records from: {uploadResult.sheets.map(s => s.name).join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Filter Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5" />
              Filter Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
              <div>
                <Label className="text-xs">From Date</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">To Date</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Vehicle No</Label>
                <Input 
                  placeholder="Type or select..."
                  value={vehicleNo} 
                  onChange={(e) => setVehicleNo(e.target.value)}
                  list="vehicle-list"
                />
                <datalist id="vehicle-list">
                  {vehicles.slice(0, 50).map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <Label className="text-xs">Sheet</Label>
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sheets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sheets</SelectItem>
                    {sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={searchRecords} disabled={loading || !hasData} className="h-10">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Search
              </Button>
              <Button onClick={clearFilters} disabled={loading || !hasData} variant="outline" className="h-10">
                Clear
              </Button>
            </div>

            {/* Quick vehicle selection */}
            {hasData && vehicles.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">Quick select vehicle:</p>
                <div className="flex flex-wrap gap-1.5">
                  {vehicles.slice(0, 10).map(v => (
                    <Badge
                      key={v}
                      variant={vehicleNo === v ? 'default' : 'secondary'}
                      className="cursor-pointer text-xs"
                      onClick={() => setVehicleNo(vehicleNo === v ? '' : v)}
                    >
                      <Truck className="h-3 w-3 mr-1" />{v}
                    </Badge>
                  ))}
                  {vehicles.length > 10 && <Badge variant="outline" className="text-xs">+{vehicles.length - 10} more</Badge>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {records.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5" />
                  Results: {records.length} records
                </CardTitle>
                <Badge variant="outline">{columns.length} columns</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px] rounded border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted">
                        <TableHead className="sticky left-0 bg-muted min-w-[100px]">Sheet</TableHead>
                        <TableHead className="sticky bg-muted min-w-[100px]">Date</TableHead>
                        <TableHead className="sticky bg-muted min-w-[150px]">Vehicle</TableHead>
                        {columns.map(col => (
                          <TableHead key={col} className="whitespace-nowrap bg-muted">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.slice(0, 500).map(record => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium"><Badge variant="outline">{record.sheetName}</Badge></TableCell>
                          <TableCell>{new Date(record.recordDate).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium text-primary">{record.vehicleNo}</TableCell>
                          {columns.map(col => (
                            <TableCell key={col} className="whitespace-nowrap">{String(record.rawData[col] ?? '')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
              {records.length > 500 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Showing first 500 of {records.length} records
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading records...</span>
          </div>
        )}

        {/* No data state */}
        {!hasData && !loading && (
          <Card className="bg-muted/30">
            <CardContent className="py-12 text-center">
              <FileSpreadsheet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Data Yet</h3>
              <p className="text-muted-foreground">Upload an Excel file above to get started.</p>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t bg-card mt-auto py-3 text-center text-sm text-muted-foreground">
        Job Costing System • {hasData ? `${records.length} records loaded` : 'No data'}
      </footer>
    </div>
  )
}
