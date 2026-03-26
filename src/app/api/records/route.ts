import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const vehicleNo = searchParams.get('vehicleNo')
    const sheetName = searchParams.get('sheetName')
    
    // Build where clause
    const where: Record<string, unknown> = {}
    
    // Vehicle filter - case insensitive contains
    if (vehicleNo && vehicleNo.trim()) {
      where.vehicleNo = { contains: vehicleNo.trim() }
    }
    
    // Date filter
    if (fromDate || toDate) {
      const dateFilter: Record<string, Date> = {}
      if (fromDate) {
        dateFilter.gte = new Date(fromDate + 'T00:00:00.000Z')
      }
      if (toDate) {
        dateFilter.lte = new Date(toDate + 'T23:59:59.999Z')
      }
      where.recordDate = dateFilter
    }
    
    // Sheet filter
    if (sheetName && sheetName !== 'all') {
      where.sheetName = sheetName
    }
    
    console.log('Filter query:', JSON.stringify(where, null, 2))
    
    // Query records
    const records = await db.jobRecord.findMany({
      where,
      orderBy: { recordDate: 'desc' },
      take: 1000,
    })
    
    console.log('Found records:', records.length)
    
    // Parse raw data and return
    const parsedRecords = records.map(record => ({
      id: record.id,
      sheetName: record.sheetName,
      vehicleNo: record.vehicleNo,
      recordDate: record.recordDate.toISOString(),
      rawData: JSON.parse(record.rawData) as Record<string, unknown>,
    }))
    
    return NextResponse.json({
      success: true,
      count: parsedRecords.length,
      records: parsedRecords,
    })
    
  } catch (error) {
    console.error('Filter error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to filter records', details: String(error) },
      { status: 500 }
    )
  }
}

// Get distinct sheet names and vehicles for dropdowns
export async function POST() {
  try {
    const [sheets, vehicles] = await Promise.all([
      db.jobRecord.findMany({
        select: { sheetName: true },
        distinct: ['sheetName'],
      }),
      db.jobRecord.findMany({
        select: { vehicleNo: true },
        distinct: ['vehicleNo'],
        orderBy: { vehicleNo: 'asc' },
      }),
    ])
    
    return NextResponse.json({
      success: true,
      sheets: sheets.map(s => s.sheetName),
      vehicles: vehicles.map(v => v.vehicleNo).filter(v => v && v.trim()),
    })
    
  } catch (error) {
    console.error('Metadata error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get metadata' },
      { status: 500 }
    )
  }
}
