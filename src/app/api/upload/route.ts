import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'

// Helper to find date column
function findDateColumn(headers: string[]): string | null {
  const dateKeywords = ['date', 'tanggal', 'tarikh', 'dt', 'record_date', 'recorddate']
  for (const header of headers) {
    const lower = header.toLowerCase().trim()
    if (dateKeywords.some(k => lower.includes(k))) {
      return header
    }
  }
  return null
}

// Helper to find vehicle column
function findVehicleColumn(headers: string[]): string | null {
  const vehicleKeywords = ['vehicle', 'veh', 'veh_no', 'vehno', 'vehicle_no', 'vehicleno', 'no_vehicle', 'novehicle', 'truck', 'lorry', 'van']
  for (const header of headers) {
    const lower = header.toLowerCase().trim()
    if (vehicleKeywords.some(k => lower.includes(k))) {
      return header
    }
  }
  return null
}

// Helper to parse Excel date
function parseExcelDate(value: unknown): Date | null {
  if (!value) return null
  
  // If it's already a Date
  if (value instanceof Date) return value
  
  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    // Excel dates are number of days since 1900-01-01
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      return new Date(date.y, date.m - 1, date.d)
    }
  }
  
  // If it's a string
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) return parsed
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Read file as buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    
    const sheetNames = workbook.SheetNames
    let totalRecords = 0
    const sheetInfo: { name: string; records: number; dateColumn: string | null; vehicleColumn: string | null }[] = []
    
    // Clear existing records
    await db.jobRecord.deleteMany()
    
    // Process each sheet
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[]
      
      if (jsonData.length === 0) continue
      
      // Find date and vehicle columns
      const headers = Object.keys(jsonData[0])
      const dateColumn = findDateColumn(headers)
      const vehicleColumn = findVehicleColumn(headers)
      
      // Prepare records for batch insert
      const records = []
      
      for (const row of jsonData) {
        const dateValue = dateColumn ? row[dateColumn] : null
        const vehicleValue = vehicleColumn ? String(row[vehicleColumn] || '') : ''
        const recordDate = parseExcelDate(dateValue)
        
        // Create record
        records.push({
          sheetName: sheetName,
          vehicleNo: vehicleValue,
          recordDate: recordDate || new Date(),
          rawData: JSON.stringify(row),
        })
      }
      
      // Batch insert
      if (records.length > 0) {
        await db.jobRecord.createMany({ data: records })
        totalRecords += records.length
      }
      
      sheetInfo.push({
        name: sheetName,
        records: records.length,
        dateColumn,
        vehicleColumn,
      })
    }
    
    // Save file info
    await db.uploadedFile.create({
      data: {
        fileName: file.name,
        sheetCount: sheetNames.length,
        recordCount: totalRecords,
      },
    })
    
    return NextResponse.json({
      success: true,
      message: 'File processed successfully',
      totalRecords,
      sheets: sheetInfo,
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process file', details: String(error) },
      { status: 500 }
    )
  }
}
