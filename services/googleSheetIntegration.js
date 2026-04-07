import fetch from 'node-fetch';

export async function runGoogleSheetIntegration(template) {
  const integ = template.integration || {};
  if (integ.type !== 'GOOGLE_SHEET_STATUS') return;

  const { endpointUrl, sheetName, row, doneValue } = integ;

  if (!endpointUrl || !sheetName || !row) {
    console.log("Integration skipped: missing endpointUrl/sheetName/row");
    return;
  }

  const url = `${endpointUrl}?sheet=${encodeURIComponent(sheetName)}&row=${encodeURIComponent(row)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doneValue || "DONE")
  });

  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`AppsScript error ${res.status}: ${txt}`);
  }
  return txt;
}
