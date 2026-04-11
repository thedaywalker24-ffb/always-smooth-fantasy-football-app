function getSleeperPlayers() {
  const url = 'https://api.sleeper.app/v1/players/nfl';

  // Replace with your authorization token (if required)
  // const authorization = 'Token YOUR_API_TOKEN';

  const options = {
    'method' : 'get',
    //'headers' : {  // Uncomment if authorization is required
    //  'Authorization': authorization
    //}
  };

  const response = UrlFetchApp.fetch(url, options);
  const playerData = JSON.parse(response.getContentText());

  // Create a new sheet for the results
  const sheet = SpreadsheetApp.getActiveSpreadsheet();

  // Headers for the player data
  const headers = ['Player ID', 'First Name', 'Last Name', 'Status'];

  // Write headers to the first row
  const headerRow = sheet.getRange(1, 1, 1, headers.length);
  headerRow.setValues([headers]);

  // Starting row for player data
  let dataRow = 2;

  // Loop through each player object in the response
  for (const playerId in playerData) {
    const player = playerData[playerId];
    const playerValues = [
      playerId,
      player.first_name,
      player.last_name,
      player.status
    ];

    // Write player data to a new row
    const dataCellRange = sheet.getRange(dataRow, 1, 1, playerValues.length);
    dataCellRange.setValues([playerValues]);

    dataRow++;
  }
}
