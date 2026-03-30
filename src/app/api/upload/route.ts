import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'

function findDateColumn(headers: string[]): string | null {
  const keywords = ['date', 'tanggal', 'tarikh', 'dt']
  for (const h of headers) {
    if (keywords.some(k => h.toLowerCase().includes(k))) return h
  }
  return null
}

function findVehicleColumn(headers: string[]): string | null {
  const keywords = ['vehicle', 'veh', 'truck', 'equipment']
  for (const h of headers) {
    if (keywords.some(k => h.toLowerCase().includes(k))) return h
  }
  return null
}

function parseDate(val: unknown): Date {
  if (val instanceof Date) return val
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return new Date(d.y, d.m - 1, d.d)
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheets = workbook.SheetNames
    let total = 0
    const sheetInfo: { name: string; records: number }[] = []

    await db.jobRecord.deleteMany()

    for (const sheetName of sheets) {
      const ws = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
      if (data.length === 0) continue

      const headers = Object.keys(data[0])
      const dateCol = findDateColumn(headers)
      const vehCol = findVehicleColumn(headers)

      const records = data.map(row => ({
        sheetName,
        vehicleNo: vehCol ? String(row[vehCol] || '') : '',
        recordDate: dateCol ? parseDate(row[dateCol]) : new Date(),
        rawData: JSON.stringify(row),
      }))

      if (records.length > 0) {
        await db.jobRecord.createMany({ data: records })
        total += records.length
        sheetInfo.push({ name: sheetName, records: records.length })
      }
    }

    return NextResponse.json({ success: true, totalRecords: total, sheets: sheetInfo })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
