import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!type || !['users', 'products', 'orders'].includes(type)) {
      return NextResponse.json(
        { error: 'Valid type (users, products, or orders) is required' },
        { status: 400 }
      );
    }

    // Read CSV file
    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must have at least a header row and one data row' },
        { status: 400 }
      );
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    const supabase = getAdminSupabaseClient();
    let imported = 0;
    const errors: string[] = [];

    if (type === 'users') {
      for (const row of rows) {
        try {
          // Parse business_details if it's a JSON string
          let businessDetails = {};
          if (row.business_details) {
            try {
              businessDetails = JSON.parse(row.business_details);
            } catch {
              businessDetails = { shopName: row.business_details };
            }
          }

          const { error } = await supabase.from('profiles').insert({
            phone_number: row.phone_number,
            role: row.role || 'retailer',
            status: row.status || 'active',
            business_details: businessDetails,
          });

          if (error) {
            errors.push(`Row ${imported + 1}: ${error.message}`);
          } else {
            imported++;
          }
        } catch (error: any) {
          errors.push(`Row ${imported + 1}: ${error.message}`);
        }
      }
    } else if (type === 'products') {
      for (const row of rows) {
        try {
          const { error } = await supabase.from('products').insert({
            name: row.name,
            price: parseFloat(row.price) || 0,
            stock_available: parseInt(row.stock_available) || 0,
            category_name: row.category_name,
            seller_id: row.seller_id,
            status: row.status || 'available',
            is_active: row.is_active !== 'false',
          });

          if (error) {
            errors.push(`Row ${imported + 1}: ${error.message}`);
          } else {
            imported++;
          }
        } catch (error: any) {
          errors.push(`Row ${imported + 1}: ${error.message}`);
        }
      }
    } else if (type === 'orders') {
      for (const row of rows) {
        try {
          const { error } = await supabase.from('orders').insert({
            retailer_id: row.retailer_id,
            seller_id: row.seller_id,
            total_amount: parseFloat(row.total_amount) || 0,
            status: row.status || 'pending',
          });

          if (error) {
            errors.push(`Row ${imported + 1}: ${error.message}`);
          } else {
            imported++;
          }
        } catch (error: any) {
          errors.push(`Row ${imported + 1}: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error importing CSV:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import CSV' },
      { status: 500 }
    );
  }
}

