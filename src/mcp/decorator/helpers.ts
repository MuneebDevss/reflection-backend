/**
   * Helper method to parse a pure YYYY-MM-DD string into a safe JS Date object
   * that aligns precisely with the user's local midnight or local end-of-day.
   */
  
export function getUtcDateForTimezone(dateStr: string, timeZone: string, endOfDay = false): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    
    const h = endOfDay ? 23 : 0;
    const m = endOfDay ? 59 : 0;
    const s = endOfDay ? 59 : 0;
    const ms = endOfDay ? 999 : 0;
    
    // 1. Establish a baseline target at standard UTC
    const utcBaseline = new Date(Date.UTC(year, month - 1, day, h, m, s, ms));
    
    // 2. Discover how the target timezone translates this baseline moment
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    });
    
    const parts = tzFormatter.formatToParts(utcBaseline);
    const partVal = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10);
    
    let hour = partVal('hour');
    if (hour === 24) hour = 0; // Normalize runtime environments outputting 24 instead of 00
    
    // 3. Reverse calculate the localized offset safely
    const localizedUtcTime = Date.UTC(
      partVal('year'),
      partVal('month') - 1,
      partVal('day'),
      hour,
      partVal('minute'),
      partVal('second')
    );
    
    const offset = utcBaseline.getTime() - localizedUtcTime;
    return new Date(utcBaseline.getTime() + offset);
  }