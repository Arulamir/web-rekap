// Atomic counters persist across Vercel instances. Attempts include failed calls.
export async function claimOcrQuota(sql, scope, minuteLimit, dayLimit) {
  const rows = await sql`
    INSERT INTO ocr_usage (scope, minute_start, minute_count, day_start, day_count)
    VALUES (${scope}, date_trunc('minute', NOW()), 1, (NOW() AT TIME ZONE 'Asia/Jakarta')::date, 1)
    ON CONFLICT (scope) DO UPDATE SET
      minute_start = date_trunc('minute', NOW()),
      minute_count = CASE WHEN ocr_usage.minute_start = date_trunc('minute', NOW()) THEN ocr_usage.minute_count + 1 ELSE 1 END,
      day_start = (NOW() AT TIME ZONE 'Asia/Jakarta')::date,
      day_count = CASE WHEN ocr_usage.day_start = (NOW() AT TIME ZONE 'Asia/Jakarta')::date THEN ocr_usage.day_count + 1 ELSE 1 END
    WHERE (ocr_usage.minute_start <> date_trunc('minute', NOW()) OR ocr_usage.minute_count < ${minuteLimit})
      AND (ocr_usage.day_start <> (NOW() AT TIME ZONE 'Asia/Jakarta')::date OR ocr_usage.day_count < ${dayLimit})
    RETURNING scope`;
  return rows.length > 0;
}
