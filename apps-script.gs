// Paste this into the Apps Script editor bound to your Google Sheet (Extensions > Apps Script).
// Appends each order submission as a new row.
//
// Sheet column order (row 1 header, exact order matters):
// Timestamp | Name | Email | Status | Order Size | Img Source Flag | Img Source |
// Cardlist | Price Quote | Paid | Custom Requests
//
// `status` defaults to "new" and `paid` defaults to unchecked (false) on every
// submission — those, plus Price Quote, are meant to be edited by you directly
// in the sheet, not by the client submitting the form.

const UPLOAD_FOLDER_NAME = 'Order Submissions';

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);

  const imgSource = resolveImgSource(data);

  sheet.appendRow([
    new Date(),
    data.name || '',
    data.email || '',
    'new',
    data.orderSize || '',
    data.imgSourceFlag || '',
    imgSource,
    data.cardlist || '',
    '',
    false,
    data.customRequests || '',
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function resolveImgSource(data) {
  if (data.imgSourceFile && data.imgSourceFile.data) {
    const folder = getOrCreateFolder(UPLOAD_FOLDER_NAME);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(data.imgSourceFile.data),
      data.imgSourceFile.mimeType || 'application/octet-stream',
      data.imgSourceFile.filename || 'upload'
    );
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  }
  if (data.imgSourceLink) {
    return data.imgSourceLink;
  }
  return '';
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}
