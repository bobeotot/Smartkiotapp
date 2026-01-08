export default function handler(req, res) {
  const room = req.query.room || "101";

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");

  const today = new Date();
  const start = today.toISOString().slice(0, 10).replaceAll("-", "");
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 2);
  const end = endDate.toISOString().slice(0, 10).replaceAll("-", "");

  const ics = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SmartKiot//iCal//EN
BEGIN:VEVENT
UID:${room}-${start}@smartkiot
DTSTAMP:${start}T000000Z
DTSTART:${start}
DTEND:${end}
SUMMARY:BOOKED ROOM ${room}
END:VEVENT
END:VCALENDAR
`.trim();

  res.status(200).send(ics);
}
