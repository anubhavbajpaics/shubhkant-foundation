/**
 * Saves website registrations into a Google Sheet.
 *
 * SET UP (5 minutes)
 * 1. Create a new Google Sheet (any name, for example "Event registrations").
 * 2. In the sheet: Extensions > Apps Script. Delete the sample code and paste this whole file.
 * 3. Optional: Project Settings (gear icon) > Script properties > add  SECRET = any long random text.
 *    Use the same text as REGISTRATION_WEBHOOK_SECRET in Vercel.
 * 4. Deploy > New deployment > type "Web app".
 *      Execute as: Me      Who has access: Anyone
 *    Click Deploy, allow access, and copy the Web app URL.
 * 5. In Vercel: Project > Settings > Environment Variables > add
 *      REGISTRATION_WEBHOOK_URL = (the Web app URL)
 *    then redeploy.
 *
 * Each event gets its own tab. Registering twice with the same email for the same event is saved once.
 */
var SEND_CONFIRMATION_EMAIL = false; // set to true to email each person (uses your Gmail quota)

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (secret && data.secret !== secret) return out_({ ok: false, error: 'unauthorized' });

    var book = SpreadsheetApp.getActiveSpreadsheet();
    var name = String(data.event.title).replace(/[\\\/\?\*\[\]:]/g, ' ').substring(0, 90);
    var sheet = book.getSheetByName(name) || book.insertSheet(name);
    var ids = Object.keys(data.fields);
    if (sheet.getLastRow() === 0) {
      var head = ['Reference', 'Submitted (IST)'].concat(ids.map(function (id) { return data.fieldLabels[id] || id; }));
      sheet.appendRow(head);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, head.length).setFontWeight('bold');
    }
    var emailCol = ids.indexOf('email');
    if (emailCol >= 0 && sheet.getLastRow() > 1) {
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3 + emailCol).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][2 + emailCol]).toLowerCase() === String(data.fields.email).toLowerCase()) {
          return out_({ ok: true, duplicate: true, ref: rows[i][0] });
        }
      }
    }
    var when = Utilities.formatDate(new Date(data.submittedAt), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');
    var row = [data.ref, when].concat(ids.map(function (id) { return safe_(data.fields[id]); }));
    sheet.appendRow(row);

    if (SEND_CONFIRMATION_EMAIL && data.fields.email) {
      MailApp.sendEmail(data.fields.email, 'Registration received: ' + data.event.title,
        'Hello ' + (data.fields.name || '') + ',\n\nWe have received your registration for ' + data.event.title +
        '.\nYour reference: ' + data.ref + '\n\nShubhkant Foundation');
    }
    return out_({ ok: true, ref: data.ref });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// stops values like =HYPERLINK(...) from running as formulas in the sheet
function safe_(v) {
  v = v === true ? 'Yes' : String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
