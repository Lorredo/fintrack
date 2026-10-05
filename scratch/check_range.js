function getRangeKey(start, end) {
  const getLocalISODate = (d) => {
    const dt = new Date(d);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    return dt.toISOString().split('T')[0];
  };
  const d = new Date();
  
  const today = getLocalISODate(d);
  if (start === today && end === today) return 'today';
  
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterday = getLocalISODate(yest);
  if (start === yesterday && end === yesterday) return 'yesterday';
  
  const day = d.getDay();
  const diff = d.getDate() - day + (day == 0 ? -6 : 1);
  const twStart = getLocalISODate(new Date(new Date().setDate(diff)));
  const twEnd = getLocalISODate(new Date(new Date(twStart).setDate(new Date(twStart).getDate() + 6)));
  if (start === twStart && end === twEnd) return 'this_week';
  
  const lw = new Date();
  const lwDay = lw.getDay();
  const lwDiff = lw.getDate() - lwDay + (lwDay == 0 ? -6 : 1) - 7;
  const lwStart = getLocalISODate(new Date(lw.setDate(lwDiff)));
  const lwEnd = getLocalISODate(new Date(new Date(lwStart).setDate(new Date(lwStart).getDate() + 6)));
  if (start === lwStart && end === lwEnd) return 'last_week';
  
  const tmStart = getLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  const tmEnd = getLocalISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  if (start === tmStart && end === tmEnd) return 'this_month';
  
  const lmStart = getLocalISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const lmEnd = getLocalISODate(new Date(d.getFullYear(), d.getMonth(), 0));
  if (start === lmStart && end === lmEnd) return 'last_month';
  
  const tyStart = getLocalISODate(new Date(d.getFullYear(), 0, 1));
  const tyEnd = getLocalISODate(new Date(d.getFullYear(), 11, 31));
  if (start === tyStart && end === tyEnd) return 'this_year';
  
  if (start === '2000-01-01') return 'all_time';
  
  return null;
}
console.log(getRangeKey('2026-10-01', '2026-10-31'));
